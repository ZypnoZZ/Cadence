// Audit de sécurité des abonnements (Worker) : plusieurs comptes de test, Stripe simulé
import W from '../worker.js';
const kv=new Map();const env={STRIPE_SECRET_KEY:'sk_test_x',STRAVA_CLIENT_ID:'1',STRAVA_CLIENT_SECRET:'s',STRIPE_WEBHOOK_SECRET:'whsec_test',GEMINI_KEY:'g',LICENSES:{get:async(k,o)=>{const v=kv.get(k);return v==null?null:(o&&o.type==='json'?JSON.parse(v):v)},put:async(k,v)=>kv.set(k,v),delete:async k=>kv.delete(k),list:async()=>({keys:[],list_complete:true})}};
const NOW=Math.floor(Date.now()/1000),OLD=Math.floor(Date.UTC(2026,9,1)/1000);
const CUST={cus_A:{email:'alice@x.fr',created:NOW},cus_B:{email:'bob@x.fr',created:NOW},cus_OLD:{email:'ancien@x.fr',created:OLD},cus_EVIL:{email:'alice@x.fr',created:NOW}};
const SESS={cs_A:{status:'complete',customer:'cus_A',customer_details:{email:'alice@x.fr'},created:NOW},cs_B:{status:'complete',customer:'cus_B',customer_details:{email:'bob@x.fr'},created:NOW},
  cs_open:{status:'open',customer_email:'alice@x.fr',created:NOW},cs_vieux:{status:'complete',customer:'cus_A',customer_details:{email:'alice@x.fr'},created:NOW-30*86400},
  cs_EVIL:{status:'complete',customer:'cus_EVIL',customer_details:{email:'alice@x.fr'},created:NOW}};
globalThis.fetch=async(u,o)=>{u=String(u);
  if(u.includes('/checkout/sessions/')){const id=u.split('/').pop();return new Response(JSON.stringify(SESS[id]||{error:{}}),{status:SESS[id]?200:404})}
  if(u.includes('/checkout/sessions'))return new Response(JSON.stringify({url:'https://checkout.stripe.com/x'}));
  if(u.includes('/customers/')){const id=u.split('/').pop();return new Response(JSON.stringify(CUST[id]||{}))}
  if(u.includes('billing_portal'))return new Response(JSON.stringify({url:'https://billing.stripe.com/x'}));
  if(u.includes('generativelanguage'))return new Response('{"ok":1}');
  return new Response('{}')};
const req=(p,m,b,h)=>W.fetch(new Request('https://w.dev'+p,{method:m||'GET',headers:Object.assign({'CF-Connecting-IP':'9.9.9.9'},h||{}),body:b}),env);
const get=async p=>{const r=await req(p);let j=null;try{j=await r.clone().json()}catch(e){}return {s:r.status,j,loc:r.headers.get('location')}};
const post=async(p,b,h)=>{const r=await req(p,'POST',b,h);let j=null;try{j=await r.clone().json()}catch(e){}return {s:r.status,j}};
const fails=[];const ok=(n,c,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?' :: '+JSON.stringify(x):''));if(!c)fails.push(n)};
const E=encodeURIComponent;
kv.set('lic:alice@x.fr',JSON.stringify({active:true,plan:'coach',customerId:'cus_A',subscriptionId:'sub_A',updated:Date.now()}));
kv.set('lic:bob@x.fr',JSON.stringify({active:true,plan:'base',customerId:'cus_B',subscriptionId:'sub_B',updated:Date.now()}));
kv.set('lic:ancien@x.fr',JSON.stringify({active:true,plan:'coach',customerId:'cus_OLD',updated:Date.now()}));
// --- sans preuve
let r=await get('/status?email=alice@x.fr');ok('e-mail seul (compte récent) : rien révélé',r.j.active===false&&r.j.auth==='required'&&!r.j.tok);
for(const p of ['/portal?email=alice@x.fr','/purchases?email=alice@x.fr','/transfer/new?email=alice@x.fr'])ok('sans jeton refusé : '+p.split('?')[0],(await get(p)).s===401);
for(const p of ['/change?email=alice@x.fr&plan=base','/resume?email=alice@x.fr','/account/delete?email=alice@x.fr'])ok('sans jeton refusé : '+p.split('?')[0],(await post(p)).s===401);
r=await post('/ai?email=alice@x.fr','{}');ok('analyse photo refusée sans jeton',r.s===403);
// --- paiement Stripe
ok('session non payée : pas de jeton',(await get('/claim?sid=cs_open')).s===409);
ok('session trop ancienne : refusée',(await get('/claim?sid=cs_vieux')).s===410);
ok('identifiant de session invalide refusé',(await get('/claim?sid=../x')).s===400);
const tA=(await get('/claim?sid=cs_A')).j.tok,tB=(await get('/claim?sid=cs_B')).j.tok;ok('jetons délivrés après paiement (Alice, Bob)',!!tA&&!!tB);
r=await get('/status?email=alice@x.fr&tok='+E(tA));ok('Alice + son jeton : actif coach',r.j.active===true&&r.j.plan==='coach');
// --- isolation entre comptes
r=await get('/status?email=bob@x.fr&tok='+E(tA));ok('jeton d\'Alice sur le compte de Bob : refusé',r.j.active===false);
ok('portail de Bob avec le jeton d\'Alice : refusé',(await get('/portal?email=bob@x.fr&tok='+E(tA))).s===401);
ok('changement de formule de Bob avec le jeton d\'Alice : refusé',(await post('/change?email=bob@x.fr&plan=coach&tok='+E(tA))).s===401);
ok('suppression du compte de Bob avec le jeton d\'Alice : refusée',(await post('/account/delete?email=bob@x.fr&tok='+E(tA))).s===401&&kv.has('lic:bob@x.fr'));
// --- jeton falsifié ou expiré
const [pA]=tA.split('.');const forged=btoa('bob@x.fr|1|9999999999').replace(/=+$/,'')+'.'+tA.split('.')[1];
ok('jeton falsifié (e-mail changé) : refusé',(await get('/status?email=bob@x.fr&tok='+E(forged))).j.active===false);
const realNow=Date.now;Date.now=()=>realNow()+181*86400000;ok('jeton expiré (181 jours) : refusé',(await get('/status?email=alice@x.fr&tok='+E(tA))).j.active===false);Date.now=realNow;
Date.now=()=>realNow()+160*86400000;r=await get('/status?email=alice@x.fr&tok='+E(tA));ok('jeton proche de l\'expiration : renouvelé',r.j.active===true&&!!r.j.tok&&r.j.tok!==tA);Date.now=realNow;
// --- rachat du compte d'un autre
r=await get('/checkout?email=alice@x.fr&plan=coach');ok('payer avec l\'e-mail d\'un compte existant sans jeton : refusé',r.s===302&&/lic=auth/.test(r.loc));
r=await get('/checkout?email=alice@x.fr&plan=coach&tok='+E(tA));ok('Alice depuis son appareil : paiement possible',r.s===302&&/stripe/.test(r.loc));
ok('achat boutique pour un compte existant sans jeton : refusé',/buy=auth/.test((await get('/buy?email=alice@x.fr&item=wp-ocean')).loc||''));
ok('session payée par un autre client Stripe avec l\'e-mail d\'Alice : pas de jeton',(await get('/claim?sid=cs_EVIL')).s===409);
r=await get('/checkout?email=nouveau@x.fr&plan=base');ok('nouvel e-mail : paiement possible',r.s===302&&/stripe/.test(r.loc));
r=await get('/checkout?email=nouveau@x.fr&plan=base&return='+E('https://pirate.example/'));
// --- redirection vers un autre site
r=await get('/portal?email=alice@x.fr&tok='+E(tA)+'&return='+E('https://pirate.example/x'));ok('portail : retour vers un autre site impossible',r.s===302);
// --- ancien abonné (client Stripe créé avant la v109)
r=await get('/status?email=ancien@x.fr');const tO=r.j.tok;ok('ancien abonné : 1er appareil récupère son jeton',r.j.active===true&&!!tO);
ok('ancien abonné : 2e appareil sans preuve refusé',(await get('/status?email=ancien@x.fr')).j.auth==='required');
// --- codes de transfert
const c1=(await get('/transfer/new?email=alice@x.fr&tok='+E(tA))).j.code;ok('code de transfert : 8 caractères sans ambiguïté',/^[A-HJ-NP-Z2-9]{8}$/.test(c1||''),c1);
ok('code avec le TTL de 10 min dans le stockage',kv.has('xfer:'+c1));
r=await get('/transfer/use?code='+c1.toLowerCase().slice(0,4)+'-'+c1.slice(4).toLowerCase());ok('code utilisé (format libre) → jeton d\'Alice',r.j.email==='alice@x.fr'&&!!r.j.tok);
ok('code réutilisé : refusé',(await get('/transfer/use?code='+c1)).s===404);
let blocked=false;for(let i=0;i<12;i++){const x=await get('/transfer/use?code=AAAAAAA'+i);if(x.s===429){blocked=true;break}}ok('essais de codes en rafale : bloqués (10/h par IP)',blocked);
// --- webhook
const body=JSON.stringify({type:'customer.subscription.deleted',data:{object:{id:'sub_B',customer:'cus_B',status:'canceled',items:{data:[]}}}});
const sign=async(t,b)=>{const k=await crypto.subtle.importKey('raw',new TextEncoder().encode('whsec_test'),{name:'HMAC',hash:'SHA-256'},false,['sign']);const s=await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(t+'.'+b));return [...new Uint8Array(s)].map(x=>x.toString(16).padStart(2,'0')).join('')};
ok('webhook sans signature : refusé',(await post('/webhook',body)).s===400);
let t=NOW-600;ok('webhook rejoué (10 min) : refusé',(await post('/webhook',body,{'Stripe-Signature':'t='+t+',v1='+await sign(t,body)})).s===400);
t=NOW;ok('webhook signé et récent : accepté',(await post('/webhook',body,{'Stripe-Signature':'t='+t+',v1=bad,v1='+await sign(t,body)})).s===200);
// --- suppression
ok('suppression refusée tant que l\'abonnement est actif',(await post('/account/delete?email=alice@x.fr&tok='+E(tA))).s===409);
kv.set('lic:alice@x.fr',JSON.stringify({active:true,plan:'coach',customerId:'cus_A',cancelAt:Date.now()+864e5,updated:Date.now()}));
ok('suppression après résiliation',(await post('/account/delete?email=alice@x.fr&tok='+E(tA))).j.ok===true&&!kv.has('lic:alice@x.fr'));
ok('tous les jetons d\'Alice révoqués',(await get('/transfer/new?email=alice@x.fr&tok='+E(tA))).s===401);
// --- Strava : contrôle serveur de l'abonnement Coach
kv.set('strava:SK1',JSON.stringify({email:'bob@x.fr',access:'a',refresh:'r',exp:NOW+3600}));
ok('activités Strava refusées à un abonné sans Coach (contrôle serveur)',(await get('/strava/activities?sk=SK1')).s===403);
console.log(fails.length?'ECHECS: '+fails.join(' | '):'TOUT PASSE');process.exit(fails.length?1:0);
