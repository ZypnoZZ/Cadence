// Cadence — Worker Cloudflare : vérifie les abonnements Stripe
// À coller dans Cloudflare Dashboard > Workers > ton worker > Quick Edit.
// Variables à définir dans Settings > Variables (3 "Secrets") :
//   STRIPE_SECRET_KEY     clé secrète Stripe (sk_live_... ou sk_test_...)
//   STRIPE_WEBHOOK_SECRET  clé du endpoint webhook (whsec_...)
//   STRIPE_PRICE_ID        id du prix récurrent de la formule Cadence (price_...)
//   STRIPE_PRICE_COACH     id du prix récurrent de la formule Cadence + Coach (price_...)
//   GEMINI_KEY             (facultatif) clé Google AI Studio pour l'analyse photo sans clé perso
// Et une liaison KV (Settings > Bindings > KV Namespace) nommée : LICENSES
// Notifications push : ajoute un déclencheur Cron (Settings > Triggers > Cron) : */5 * * * *
//   (les clés VAPID sont créées automatiquement et gardées dans LICENSES ; VAPID_SUBJECT facultatif)
// Changement de formule : dans Stripe, portail client > autoriser le changement d'abonnement entre les deux prix.

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

async function stripeGet(env, path) {
  const r = await fetch('https://api.stripe.com/v1/' + path, { headers: { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY } });
  return r.json();
}
// Date de fin d'accès si la résiliation est programmée (ms), sinon null
function cancelAtOf(sub) {
  if (!sub) return null;
  if (sub.cancel_at) return sub.cancel_at * 1000;
  if (sub.cancel_at_period_end) {
    const end = sub.current_period_end || (sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].current_period_end);
    return end ? end * 1000 : null;
  }
  return null;
}
async function saveSub(env, sub, activeOverride) {
  const cust = await stripeGet(env, 'customers/' + sub.customer);
  if (!cust || !cust.email) return;
  const active = activeOverride !== undefined ? activeOverride : (sub.status === 'active' || sub.status === 'trialing');
  await env.LICENSES.put('lic:' + cust.email.toLowerCase(), JSON.stringify({
    active, customerId: sub.customer, subscriptionId: sub.id, plan: active ? planOf(env, sub) : 'base',
    cancelAt: active ? cancelAtOf(sub) : null, updated: Date.now()
  }));
}
// Formule d'un abonnement : d'après le prix (fiable après un changement de formule), sinon les métadonnées.
function planOf(env, sub) {
  const price = sub && sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].price && sub.items.data[0].price.id;
  if (price && env.STRIPE_PRICE_COACH) return price === env.STRIPE_PRICE_COACH ? 'coach' : 'base';
  return (sub && sub.metadata && sub.metadata.plan) === 'coach' ? 'coach' : 'base';
}

/* ---------- Notifications push (Web Push, VAPID, sans contenu chiffré) ---------- */
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function vapid(env) {
  let v = await env.LICENSES.get('vapid', { type: 'json' });
  if (!v) {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    v = { priv: await crypto.subtle.exportKey('jwk', kp.privateKey), pub: b64u(await crypto.subtle.exportKey('raw', kp.publicKey)) };
    await env.LICENSES.put('vapid', JSON.stringify(v));
  }
  return v;
}
async function vapidHeader(env, endpoint) {
  const v = await vapid(env);
  const enc = o => b64u(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = enc({ typ: 'JWT', alg: 'ES256' }) + '.' + enc({
    aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: env.VAPID_SUBJECT || 'https://zypnozz.github.io/Cadence/'
  });
  const key = await crypto.subtle.importKey('jwk', v.priv, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
  return 'vapid t=' + unsigned + '.' + b64u(sig) + ', k=' + v.pub;
}
// Envoie un « réveil » : l'app récupère ensuite le message avec /push/pending.
async function sendPush(env, sub) {
  return fetch(sub.endpoint, { method: 'POST', headers: { Authorization: await vapidHeader(env, sub.endpoint), TTL: '3600', Urgency: 'high', 'Content-Length': '0' } });
}
async function subId(endpoint) {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint))).slice(0, 32);
}
const clip = (x, n) => String(x == null ? '' : x).slice(0, n);
async function deliver(env, id, items) {
  const sub = await env.LICENSES.get('psub:' + id, { type: 'json' });
  if (!sub) return 'nosub';
  const box = (await env.LICENSES.get('inbox:' + id, { type: 'json' })) || [];
  await env.LICENSES.put('inbox:' + id, JSON.stringify(box.concat(items).slice(-10)), { expirationTtl: 86400 });
  const r = await sendPush(env, sub);
  if (r.status === 404 || r.status === 410) {
    await env.LICENSES.delete('psub:' + id); await env.LICENSES.delete('sched:' + id);
    return 'gone';
  }
  return r.ok ? 'ok' : 'err ' + r.status;
}
// Toutes les 5 minutes (déclencheur Cron) : envoie les rappels arrivés à échéance.
async function runSchedules(env) {
  const now = Date.now();
  let cursor;
  do {
    const page = await env.LICENSES.list({ prefix: 'sched:', cursor });
    for (const k of page.keys) {
      const id = k.name.slice(6), sc = await env.LICENSES.get(k.name, { type: 'json' });
      if (!sc || !Array.isArray(sc.events)) continue;
      const due = sc.events.filter(e => !e.sent && e.t <= now + 60000 && e.t > now - 30 * 60000);
      if (!due.length) continue;
      due.forEach(e => { e.sent = 1; });
      const st = await deliver(env, id, due.map(e => ({ title: e.title, body: e.body, tag: e.tag })));
      if (st === 'gone') continue;
      sc.events = sc.events.filter(e => e.t > now - 3600000);
      await env.LICENSES.put(k.name, JSON.stringify(sc));
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
}
async function pushRoutes(request, env, url) {
  const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
  if (url.pathname === '/push/key') return json({ key: (await vapid(env)).pub });
  if (url.pathname === '/push/subscribe') {
    const sub = body.sub;
    if (!sub || !/^https:\/\//.test(sub.endpoint || '')) return json({ error: 'abonnement invalide' }, 400);
    const id = await subId(sub.endpoint);
    await env.LICENSES.put('psub:' + id, JSON.stringify({ endpoint: sub.endpoint, keys: sub.keys || {} }));
    return json({ id });
  }
  if (url.pathname === '/push/unsubscribe') {
    const id = clip(body.id, 32);
    await env.LICENSES.delete('psub:' + id); await env.LICENSES.delete('sched:' + id);
    return json({ ok: true });
  }
  if (url.pathname === '/push/schedule') {
    const id = clip(body.id, 32);
    if (!(await env.LICENSES.get('psub:' + id))) return json({ error: 'inconnu' }, 404);
    const now = Date.now();
    const events = (Array.isArray(body.events) ? body.events : []).slice(0, 60)
      .filter(e => +e.t > now - 60000 && +e.t < now + 15 * 86400000)
      .map(e => ({ t: +e.t, title: clip(e.title, 80), body: clip(e.body, 160), tag: clip(e.tag, 40) }));
    await env.LICENSES.put('sched:' + id, JSON.stringify({ events }));
    return json({ ok: true, n: events.length });
  }
  if (url.pathname === '/push/pending') {
    if (!body.endpoint) return json({ items: [] });
    const id = await subId(body.endpoint);
    const box = (await env.LICENSES.get('inbox:' + id, { type: 'json' })) || [];
    if (box.length) await env.LICENSES.delete('inbox:' + id);
    return json({ items: box });
  }
  if (url.pathname === '/push/test') {
    const id = clip(body.id, 32);
    const st = await deliver(env, id, [{ title: '✅ Cadence', body: 'Les notifications push marchent. Tu recevras tes rappels de séances ici.', tag: 'test' }]);
    return json({ ok: st === 'ok', st }, st === 'ok' ? 200 : 502);
  }
  return null;
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runSchedules(env));
  },
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (url.pathname.startsWith('/push/')) {
      const r = await pushRoutes(request, env, url);
      if (r) return r;
    }

    // GET /status?email=... -> { active: bool }
    if (url.pathname === '/status') {
      const email = (url.searchParams.get('email') || '').trim().toLowerCase();
      if (!email) return json({ error: 'email manquant' }, 400);
      const v = await env.LICENSES.get('lic:' + email);
      const data = v ? JSON.parse(v) : null;
      return json({ active: !!(data && data.active), plan: (data && data.plan) || 'base', cancelAt: (data && data.cancelAt) || null });
    }

    // GET /checkout?email=... -> redirige vers Stripe Checkout
    if (url.pathname === '/checkout') {
      const email = (url.searchParams.get('email') || '').trim().toLowerCase();
      if (!email) return json({ error: 'email manquant' }, 400);
      const appUrl = url.searchParams.get('return') || 'https://zypnozz.github.io/Cadence/';
      const plan = url.searchParams.get('plan') === 'coach' ? 'coach' : 'base';
      try {
        const session = await stripe(env, 'checkout/sessions', {
          mode: 'subscription',
          customer_email: email,
          'metadata[plan]': plan,
          'subscription_data[metadata][plan]': plan,
          'line_items[0][price]': plan === 'coach' ? env.STRIPE_PRICE_COACH : env.STRIPE_PRICE_ID,
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
      const flow = url.searchParams.get('flow');
      const back = appUrl + '?lic=changed';
      try {
        const params = { customer: data.customerId, return_url: back };
        if (flow === 'cancel' || flow === 'update') {
          let subId = data.subscriptionId;
          if (!subId) {
            const list = await stripeGet(env, 'subscriptions?customer=' + encodeURIComponent(data.customerId) + '&status=active&limit=1');
            subId = list && list.data && list.data[0] && list.data[0].id;
          }
          if (subId) {
            params['flow_data[type]'] = flow === 'cancel' ? 'subscription_cancel' : 'subscription_update';
            params['flow_data[' + (flow === 'cancel' ? 'subscription_cancel' : 'subscription_update') + '][subscription]'] = subId;
            // Après confirmation, Stripe se ferme tout seul et revient dans Cadence
            params['flow_data[after_completion][type]'] = 'redirect';
            params['flow_data[after_completion][redirect][return_url]'] = back;
          }
        }
        let session;
        try { session = await stripe(env, 'billing_portal/sessions', params); }
        catch (e) { session = await stripe(env, 'billing_portal/sessions', { customer: data.customerId, return_url: back }); }
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
        const key = 'lic:' + obj.customer_email.toLowerCase();
        const prev = JSON.parse((await env.LICENSES.get(key)) || '{}');
        await env.LICENSES.put(key, JSON.stringify(Object.assign(prev, {
          active: true, customerId: obj.customer, plan: (obj.metadata && obj.metadata.plan) || prev.plan || 'base',
          subscriptionId: obj.subscription || prev.subscriptionId || null, updated: Date.now()
        })));
      }
      if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.created') {
        try { await saveSub(env, obj); } catch (e) {}
      }
      if (event.type === 'customer.subscription.deleted') {
        try { await saveSub(env, obj, false); } catch (e) {}
      }
      return new Response('ok');
    }

    return json({ error: 'not found' }, 404);
  }
};
