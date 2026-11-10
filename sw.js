const CACHE='cadence-v92';
const WORKER='https://cadence-license.m6hkhvkg5v.workers.dev';
const CORE=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(/version\.json$/.test(url.pathname)){e.respondWith(fetch(req,{cache:'no-store'}));return}
  const isPage=req.mode==='navigate'||(url.origin===self.location.origin&&/\/(index\.html)?$/.test(url.pathname));
  if(isPage){
    // Réseau d'abord : la dernière version s'affiche dès l'ouverture quand il y a internet.
    e.respondWith(fetch(req,{cache:'no-store'}).then(res=>{
      if(res&&res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put('./',cp))}
      return res;
    }).catch(()=>caches.match('./').then(r=>r||caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then(hit=>{
    const net=fetch(req).then(res=>{
      if(res&&(res.ok||res.type==='opaque')){const cp=res.clone();caches.open(CACHE).then(c=>c.put(req,cp))}
      return res;
    }).catch(()=>hit);
    return hit||net;
  }));
});
self.addEventListener('message',e=>{if(e.data==='skip')self.skipWaiting()});
// Notifications push : le serveur envoie un signal, le contenu est récupéré ici.
self.addEventListener('push',e=>{
  e.waitUntil((async()=>{
    let list=[];
    try{const d=e.data&&e.data.json();if(d&&d.title)list=[d]}catch(_){}
    if(!list.length){try{const s=await self.registration.pushManager.getSubscription();const r=await fetch(WORKER+'/push/pending',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:s&&s.endpoint})});const j=await r.json();list=j.items||[]}catch(_){}}
    if(!list.length)list=[{title:'Cadence',body:'Tu as une séance de sport de prévue.'}];
    await Promise.all(list.map(n=>self.registration.showNotification(n.title,{body:n.body||'',tag:n.tag||undefined,icon:'icon-192.png',badge:'icon-192.png',data:{url:'./'}})));
  })());
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window'}).then(l=>l[0]?l[0].focus():clients.openWindow('./')));
});
