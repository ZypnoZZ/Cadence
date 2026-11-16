// Test du service worker : anti-doublon des notifications push
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const c=await b.newContext();const p=await c.newPage();
await p.goto('http://localhost:8765/version.json');
const r=await p.evaluate(async()=>{
  // exécute le gestionnaire « push » de sw.js dans la page, avec des API simulées
  const src=await (await fetch('/sw.js')).text();const shown=[];let pending=[];const H={};
  const self={addEventListener:(t,f)=>H[t]=f,registration:{showNotification:async(t,o)=>shown.push(o.tag+'|'+t),getNotifications:async()=>shown.slice(),pushManager:{getSubscription:async()=>({endpoint:'x'})}},location:{origin:location.origin},skipWaiting(){},clients:{claim(){}}};
  const fetch2=async u=>/pending/.test(u)?{json:async()=>{const it=pending;pending=[];return {items:it}}}:fetch(u);
  new Function('self','caches','fetch','clients',src)(self,caches,fetch2,self.clients);
  const push=async()=>{let w;H.push({data:null,waitUntil:x=>w=x});await w};
  await caches.delete('cadence-notif');
  pending=[{title:'⚡ Séance du jour',body:'b',tag:'c2026-11-18'}];await push();
  pending=[{title:'⚡ Séance du jour',body:'b',tag:'c2026-11-18'}];await push(); // même rappel renvoyé
  await push(); // réveil sans message
  pending=[{title:'🏋️ Foot',body:'b',tag:'i1'}];await push();
  return shown});
console.log(JSON.stringify(r));const ok=r.length===2&&r[0].startsWith('c2026')&&r[1].startsWith('i1');console.log(ok?'PASS anti-doublon push (2 notifications pour 4 réveils dont 1 doublon et 1 vide)':'FAIL');
await b.close();process.exit(ok?0:1)})();
