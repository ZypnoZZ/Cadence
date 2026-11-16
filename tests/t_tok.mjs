// Faille de l'abonnement : l'e-mail seul ne suffit plus
import W from '../worker.js';
const kv=new Map();const env={STRIPE_SECRET_KEY:'sk_test_x',LICENSES:{get:async(k,o)=>{const v=kv.get(k);return v==null?null:(o&&o.type==='json'?JSON.parse(v):v)},put:async(k,v)=>kv.set(k,v),delete:async k=>kv.delete(k),list:async()=>({keys:[],list_complete:true})}};
const SESS={cs_ok:{status:'complete',customer_details:{email:'paye@x.fr'},created:Math.floor(Date.now()/1000)},cs_open:{status:'open',customer_email:'paye@x.fr',created:Math.floor(Date.now()/1000)}};
let stripeCalls=[];
globalThis.fetch=async(u,o)=>{u=String(u);stripeCalls.push(u);
  if(u.includes('/checkout/sessions/')){const id=u.split('/').pop();return new Response(JSON.stringify(SESS[id]||{error:1}),{status:SESS[id]?200:404})}
  if(u.includes('billing_portal'))return new Response(JSON.stringify({url:'https://billing.stripe.com/x'}));
  return new Response(JSON.stringify({}),{status:200})};
const get=async p=>{const r=await W.fetch(new Request('https://w.dev'+p,{headers:{'CF-Connecting-IP':'1.1.1.1'}}),env);let j=null;try{j=await r.clone().json()}catch(e){}return {s:r.status,j,loc:r.headers.get('location')}};
const post=async p=>{const r=await W.fetch(new Request('https://w.dev'+p,{method:'POST'}),env);return {s:r.status,j:await r.json().catch(()=>null)}};
const fails=[];const ok=(n,c,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?' :: '+JSON.stringify(x):''));if(!c)fails.push(n)};
// abonné ancien (avant la v108) et abonné récent
kv.set('lic:ancien@x.fr',JSON.stringify({active:true,plan:'coach',updated:Date.UTC(2026,10,1)}));
kv.set('lic:paye@x.fr',JSON.stringify({active:true,plan:'coach',customerId:'cus_1',updated:Date.UTC(2026,10,20)}));kv.set('lic:autre@x.fr',JSON.stringify({active:true,plan:'coach',updated:Date.UTC(2026,10,20)}));
let r=await get('/status?email=paye@x.fr');ok('e-mail seul : pas d\'accès à un abonnement récent',r.j.active===false&&r.j.auth==='required',r.j);
r=await get('/portal?email=paye@x.fr');ok('portail Stripe refusé sans jeton',r.s===401);
r=await post('/change?email=paye@x.fr&plan=base');ok('changement de formule refusé sans jeton',r.s===401);
r=await post('/resume?email=paye@x.fr');ok('reprise refusée sans jeton',r.s===401);
r=await get('/purchases?email=paye@x.fr');ok('achats refusés sans jeton',r.s===401);
r=await get('/claim?sid=cs_open');ok('paiement non terminé : pas de jeton',r.s===409);
r=await get('/claim?sid=cs_ok');const tok=r.j&&r.j.tok;ok('après paiement : jeton délivré pour l\'e-mail payé',r.j.email==='paye@x.fr'&&!!tok);
r=await get('/status?email=paye@x.fr&tok='+encodeURIComponent(tok));ok('avec jeton : abonnement actif',r.j.active===true&&r.j.plan==='coach');
r=await get('/status?email=autre@x.fr&tok='+encodeURIComponent(tok));ok('jeton d\'un autre e-mail refusé',r.j.active===false);
r=await get('/portal?email=paye@x.fr&tok='+encodeURIComponent(tok));ok('portail avec jeton',r.s===302);
// ancien abonné : récupération unique
r=await get('/status?email=ancien@x.fr');const t2=r.j.tok;ok('ancien abonné : 1er appareil récupère son jeton',r.j.active===true&&!!t2);
r=await get('/status?email=ancien@x.fr');ok('ancien abonné : 2e appareil sans preuve refusé',r.j.active===false&&r.j.auth==='required');
// code de transfert
r=await get('/transfer/new?email=paye@x.fr');ok('code de transfert refusé sans jeton',r.s===401);
r=await get('/transfer/new?email=paye@x.fr&tok='+encodeURIComponent(tok));const code=r.j.code;ok('code de transfert créé',/^[A-Z0-9]{8}$/.test(code||''),code);
r=await get('/transfer/use?code='+code);ok('code utilisé sur un autre appareil → jeton',r.j.email==='paye@x.fr'&&!!r.j.tok);
r=await get('/transfer/use?code='+code);ok('code à usage unique',r.s===404);
// suppression du compte
r=await post('/account/delete?email=paye@x.fr&tok='+encodeURIComponent(tok));ok('suppression refusée si abonnement encore actif',r.s===409);
kv.set('lic:paye@x.fr',JSON.stringify({active:true,plan:'coach',cancelAt:Date.now()+864e5,updated:Date.now()}));
r=await post('/account/delete?email=paye@x.fr&tok='+encodeURIComponent(tok));ok('suppression après résiliation',r.j&&r.j.ok&&!kv.has('lic:paye@x.fr'));
r=await get('/status?email=paye@x.fr&tok='+encodeURIComponent(tok));ok('ancien jeton invalidé après suppression',r.j.active===false);
console.log(fails.length?'ECHECS: '+fails.join(' | '):'TOUT PASSE');process.exit(fails.length?1:0);
