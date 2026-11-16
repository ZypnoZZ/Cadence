// v110 : icône iOS, sauvegarde par fichier, son du minuteur
const {boot}=require('./lib');const fs=require('fs');
(async()=>{const T=await boot({init:()=>{window.__as={type:'auto'};Object.defineProperty(navigator,'audioSession',{value:window.__as,configurable:true});window.__plays=0;const op=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.__plays++;return op.call(this)}}});const {p,ok}=T;
// icône
const ic=await p.evaluate(()=>{const l=document.querySelector('link[rel=apple-touch-icon]');return {href:l.getAttribute('href'),sizes:l.getAttribute('sizes')}});
ok('icône iOS déclarée (fichier v108, 180×180)',ic.href==='apple-touch-icon-v108.png'&&ic.sizes==='180x180',ic);
const r=await p.evaluate(async()=>{const x=await fetch('apple-touch-icon-v108.png');const b=await x.blob();const im=await createImageBitmap(b);return {ok:x.ok,w:im.width,h:im.height}});
ok('fichier de l\'icône servi, 180×180',r.ok&&r.w===180&&r.h===180,r);
const mf=await p.evaluate(async()=>(await (await fetch('manifest.webmanifest')).json()).icons.map(i=>i.src+':'+i.purpose));
ok('manifest : icônes 192, 512 et maskable',mf.length===3&&mf.some(x=>/maskable/.test(x)),mf);
ok('plus aucune référence à l\'ancienne icône',await p.evaluate(async()=>!(await (await fetch('index.html')).text()).includes('"apple-touch-icon.png"')&&!(await (await fetch('sw.js')).text()).includes("'apple-touch-icon.png'")));
// sauvegarde par fichier
await p.evaluate(()=>{S.workouts.push({id:'bk1',date:todayISO,title:'Test sauvegarde',note:'',ex:[{name:'Squat',kind:'force',sets:[{r:5,kg:80}]}]});touch()});
const [dl]=await Promise.all([p.waitForEvent('download'),p.evaluate(()=>exportData())]);const path='bk.json';await dl.saveAs(path);
await p.evaluate(()=>{S.workouts=[];touch();V.tab='settings';V.sec='backup';render()});
await p.setInputFiles('#bk-file',path);await p.waitForTimeout(400);
ok('fichier lu : confirmation avant de remplacer',await p.evaluate(()=>!!document.querySelector('[data-act=bkapply]')&&S.workouts.length===0));
await p.evaluate(()=>document.querySelector('[data-act=bkapply]').click());
ok('restauration depuis le fichier : séance retrouvée',await p.evaluate(()=>S.workouts.some(w=>w.id==='bk1')));
await p.evaluate(()=>{V.sec='backup';render();$('#bk-text').value='{"x":1}';document.querySelector('[data-act=restore]').click()});
ok('texte invalide : refusé sans rien effacer',await p.evaluate(()=>S.workouts.some(w=>w.id==='bk1')&&/invalide/.test($('#bk-msg').textContent)));
// son : contexte ambiant pendant le minuteur, libéré ensuite, aucun lecteur audio
await p.evaluate(()=>{S.prefs=Object.assign({},S.prefs,{lock:'cadence'});delete S.prefs.lockSet;touch();rtStart(2,'Repos')});await p.waitForTimeout(300);
ok('pendant le repos : session ambiant, contexte actif, aucun lecteur audio',await p.evaluate(()=>__as.type==='ambient'&&PL.ac&&PL.ac.state==='running'&&__plays===0));
await p.waitForTimeout(4600);
ok('fin du repos : son libéré (contexte suspendu)',await p.evaluate(()=>PL.ac.state==='suspended'&&__plays===0),await p.evaluate(()=>PL.ac.state));
await p.evaluate(()=>beep(1));await p.waitForTimeout(300);
ok('bip après libération : contexte relancé',await p.evaluate(()=>PL.ac.state==='running'));
await T.done()})();
