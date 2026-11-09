// Cadence — Worker Cloudflare : vérifie les abonnements Stripe
// À coller dans Cloudflare Dashboard > Workers > ton worker > Quick Edit.
// Variables à définir dans Settings > Variables (3 "Secrets") :
//   STRIPE_SECRET_KEY     clé secrète Stripe (sk_live_... ou sk_test_...)
//   STRIPE_WEBHOOK_SECRET  clé du endpoint webhook (whsec_...)
//   STRIPE_PRICE_ID        id du prix récurrent créé dans Stripe (price_...)
//   GEMINI_KEY             (facultatif) clé Google AI Studio pour l'analyse photo sans clé perso
// Et une liaison KV (Settings > Bindings > KV Namespace) nommée : LICENSES

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS }
  });
}

async function stripe(env, path, body) {
  const r = await fetch('https://api.stripe.com/v1/' + path, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(body)
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error ? d.error.message : 'Erreur Stripe');
  return d;
}

function toHex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(sigHeader.split(',').map(p => p.split('=')));
  const t = parts.t, v1 = parts.v1;
  if (!t || !v1) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(t + '.' + rawBody));
  return toHex(sig) === v1;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    // GET /status?email=... -> { active: bool }
    if (url.pathname === '/status') {
      const email = (url.searchParams.get('email') || '').trim().toLowerCase();
      if (!email) return json({ error: 'email manquant' }, 400);
      const v = await env.LICENSES.get('lic:' + email);
      const data = v ? JSON.parse(v) : null;
      return json({ active: !!(data && data.active) });
    }

    // GET /checkout?email=... -> redirige vers Stripe Checkout
    if (url.pathname === '/checkout') {
      const email = (url.searchParams.get('email') || '').trim().toLowerCase();
      if (!email) return json({ error: 'email manquant' }, 400);
      const appUrl = url.searchParams.get('return') || 'https://zypnozz.github.io/Cadence/';
      try {
        const session = await stripe(env, 'checkout/sessions', {
          mode: 'subscription',
          customer_email: email,
          'line_items[0][price]': env.STRIPE_PRICE_ID,
          'line_items[0][quantity]': '1',
          success_url: appUrl + '?lic=ok',
          cancel_url: appUrl + '?lic=cancel'
        });
        return Response.redirect(session.url, 302);
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // GET /portal?email=... -> redirige vers le portail client Stripe (gérer/annuler l'abonnement)
    if (url.pathname === '/portal') {
      const email = (url.searchParams.get('email') || '').trim().toLowerCase();
      const appUrl = url.searchParams.get('return') || 'https://zypnozz.github.io/Cadence/';
      const v = await env.LICENSES.get('lic:' + email);
      const data = v ? JSON.parse(v) : null;
      if (!data || !data.customerId) return json({ error: 'Aucun abonnement trouvé pour cet email' }, 404);
      try {
        const session = await stripe(env, 'billing_portal/sessions', {
          customer: data.customerId,
          return_url: appUrl
        });
        return Response.redirect(session.url, 302);
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // POST /ai -> analyse photo Gemini avec la clé du serveur (secret GEMINI_KEY), pour les utilisateurs sans clé
    if (url.pathname === '/ai' && request.method === 'POST') {
      if (!env.GEMINI_KEY) return json({ error: 'GEMINI_KEY manquant sur le serveur' }, 500);
      const body = await request.text();
      if (body.length > 6000000) return json({ error: 'Image trop lourde' }, 413);
      // Limite simple : 30 analyses par heure et par adresse IP
      const ip = request.headers.get('CF-Connecting-IP') || 'x', k = 'ai:' + ip + ':' + Math.floor(Date.now() / 3600000);
      const n = +(await env.LICENSES.get(k) || 0);
      if (n >= 30) return json({ error: 'Trop d\'analyses, réessaie dans une heure' }, 429);
      await env.LICENSES.put(k, String(n + 1), { expirationTtl: 3700 });
      for (const m of ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-2.5-flash']) {
        const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_KEY }, body
        });
        if (r.status === 404) continue;
        return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json', ...CORS } });
      }
      return json({ error: 'Aucun modèle Gemini disponible' }, 502);
    }

    // POST /webhook -> Stripe appelle cette URL sur chaque évènement d'abonnement
    if (url.pathname === '/webhook' && request.method === 'POST') {
      const raw = await request.text();
      const ok = await verifyStripeSignature(raw, request.headers.get('Stripe-Signature'), env.STRIPE_WEBHOOK_SECRET);
      if (!ok) return new Response('signature invalide', { status: 400 });
      const event = JSON.parse(raw);
      const obj = event.data && event.data.object;

      if (event.type === 'checkout.session.completed' && obj.customer_email) {
        await env.LICENSES.put('lic:' + obj.customer_email.toLowerCase(), JSON.stringify({
          active: true, customerId: obj.customer
        }));
      }
      if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.created') {
        const email = (obj.metadata && obj.metadata.email) || null;
        const active = obj.status === 'active' || obj.status === 'trialing';
        // On retrouve l'email via le customer Stripe si besoin
        try {
          const cust = await (await fetch('https://api.stripe.com/v1/customers/' + obj.customer, {
            headers: { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY }
          })).json();
          if (cust.email) {
            await env.LICENSES.put('lic:' + cust.email.toLowerCase(), JSON.stringify({
              active, customerId: obj.customer
            }));
          }
        } catch (e) {}
      }
      if (event.type === 'customer.subscription.deleted') {
        try {
          const cust = await (await fetch('https://api.stripe.com/v1/customers/' + obj.customer, {
            headers: { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY }
          })).json();
          if (cust.email) {
            await env.LICENSES.put('lic:' + cust.email.toLowerCase(), JSON.stringify({
              active: false, customerId: obj.customer
            }));
          }
        } catch (e) {}
      }
      return new Response('ok');
    }

    return json({ error: 'not found' }, 404);
  }
};
