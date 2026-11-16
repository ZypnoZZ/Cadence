// Corrections prioritaires v108
const {boot}=require('./lib');
(async()=>{const T=await boot({clock:'2026-11-17T10:00:00'});const {p,clk,ok}=T;
// --- Coach configuré, séance du jour (mardi)
await p.evaluate(()=>{S.profile=Object.assign(S.profile||{},{sex:'h',age:22,h:180,w:75,act:1.55,goal:'maintien'});
  S.coach=Object.assign(coachCfg(),{start:iso(monday(today)),style:'muscu',level:'inter',days:4,place:'gym'});S.prefs=Object.assign(prefs(),{anim:'never'});touch();V.tab='coach';render()});
const ti=await p.evaluate(()=>{const tw=(today.getDay()+6)%7;return (V.coachWeek||[]).findIndex(s=>s.wd===tw)});
ok('séance du coach aujourd\'hui',ti>=0,ti);
const n0=await p.evaluate(()=>S.workouts.length);
// 1) doublons : double toucher + relance
await p.evaluate(i=>{const b=document.querySelector('[data-act=cstart][data-i="'+i+'"]');b.click();b.click()},ti);await p.waitForTimeout(300);
ok('double toucher sur Commencer : 1 seule séance',await p.evaluate(()=>S.workouts.length)===n0+1);
await p.evaluate(()=>closePlayer());await p.waitForTimeout(1700);
await p.evaluate(i=>{V.tab='coach';render();document.querySelector('[data-act=cstart][data-i="'+i+'"]').click()},ti);await p.waitForTimeout(300);
ok('relancer la séance du jour : reprise, pas de nouvelle séance',await p.evaluate(()=>S.workouts.length)===n0+1);
// 2) stats : séance ouverte mais pas faite ne compte pas
ok('séance seulement ouverte : non comptée',await p.evaluate(()=>actIn(todayISO,todayISO).n)===0);
// valider 2 séries dans le lecteur
await p.evaluate(()=>{document.querySelector('[data-act=psetdone]').click()});await p.waitForTimeout(200);
ok('série validée : séance comptée',await p.evaluate(()=>actIn(todayISO,todayISO).n)===1);
// 3) séance en cours : snapshot pendant le repos
const snap=await p.evaluate(()=>JSON.parse(localStorage.getItem('cadence-live')||'null'));
ok('état de la séance sauvegardé (repos)',snap&&snap.phase==='rest'&&snap.nx&&snap.t&&snap.t.d>0,snap&&{ph:snap.phase,nx:snap.nx});
// simule la fermeture de l'app : rechargement
await p.reload();await p.waitForTimeout(2200);
await p.addStyleTag({content:'#gate,#license,#toast,#lock,#splash{display:none!important}'});
const lv=await p.evaluate(()=>({open:!$('#lvsheet').hidden,t:$('#lv-t').textContent,s:$('#lv-s').textContent}));
ok('après réouverture : proposition de reprendre',lv.open,lv);
await p.screenshot({path:'a_lv.png'});
await p.evaluate(()=>document.querySelector('[data-act=lv-go]').click());await p.waitForTimeout(500);
const st=await p.evaluate(()=>({open:!$('#player').hidden,ph:PL.phase,i:PL.i,set:PL.set,t:$('#pl-time')&&$('#pl-time').textContent}));
ok('reprise : lecteur rouvert pendant le repos, temps recalculé',st.open&&st.ph==='rest'&&/^[0-2]:\d\d$/.test(st.t),st);
// la reprise ne crée pas de séance
ok('reprise sans nouvelle séance',await p.evaluate(()=>S.workouts.filter(w=>w.date===todayISO).length)===1);
// terminer la séance
await p.evaluate(()=>{PL.i=curPW().ex.length;finishPlayer()});
ok('séance terminée : statut fait + plus de reprise',await p.evaluate(()=>curPW().st==='done'&&!localStorage.getItem('cadence-live')));
await p.evaluate(()=>closePlayer());
// 4) migration doublons exacts
const mig=await p.evaluate(()=>{const w={id:'d1',date:'2026-11-10',title:'Haut du corps',note:'Programme du coach',ex:[{name:'Tractions',kind:'force',sets:[{r:8,kg:''}]}]};
  const s=normalize({items:[],workouts:[w,Object.assign({},w,{id:'d2'}),Object.assign({},w,{id:'d3',ex:[{name:'Tractions',kind:'force',sets:[{r:10,kg:''}]}]})]});
  return {n:s.workouts.length,b:(s.dupBackup||[]).length,ids:s.workouts.map(w=>w.id)}});
ok('doublons exacts fusionnés, séance différente gardée, copie de sauvegarde',mig.n===2&&mig.b===1&&mig.ids.includes('d3'),mig);
// 5) séance future créée depuis l'agenda : pas comptée
await p.evaluate(()=>{S.workouts.push({id:'fut',date:iso(addDays(today,3)),title:'Jambes',note:'',ex:[{name:'Squat',kind:'force',sets:[{r:5,kg:100}]}]});touch()});
ok('séance future non comptée dans la semaine',await p.evaluate(()=>actIn(iso(monday(today)),iso(addDays(monday(today),6))).ws.every(w=>w.id!=='fut')));
// 6) glisser : la carte ne reste pas rouge
await p.evaluate(()=>{V.tab='seances';V.wEdit=null;V.wseg='hist';S.prefs.ui='full';V.wfull=1;render()});
const r0=await p.$('.swr .swf');const bx=await r0.boundingBox();
const sw=async(dx,cancel)=>{await p.evaluate(([x,y,dx,c])=>{const f=document.querySelector('.swr .swf');const mk=(t,x)=>new TouchEvent(t,{bubbles:true,cancelable:true,touches:t==='touchend'||t==='touchcancel'?[]:[new Touch({identifier:1,target:f,clientX:x,clientY:y})],changedTouches:[new Touch({identifier:1,target:f,clientX:x,clientY:y})]});
  f.dispatchEvent(mk('touchstart',x));for(let k=1;k<=6;k++)f.dispatchEvent(mk('touchmove',x+dx*k/6));f.dispatchEvent(mk(c?'touchcancel':'touchend',x+dx))},[bx.x+bx.width/2,bx.y+20,dx,cancel]);await p.waitForTimeout(300)};
await sw(-50);ok('glisser court à gauche : plus de rouge',await p.evaluate(()=>{const r=document.querySelector('.swr');return !r.classList.contains('dl')&&getComputedStyle(r.querySelector('.swd')).visibility==='hidden'}));
await sw(-60,true);ok('geste interrompu : plus de rouge',await p.evaluate(()=>{const r=document.querySelector('.swr');return !r.classList.contains('dl')&&!r.classList.contains('dr')&&r.querySelector('.swf').style.transform===''}));
await sw(90);ok('glisser à droite : menu ouvert',await p.evaluate(()=>document.querySelector('.swr').classList.contains('open-r')));
// 7) barre d'onglets : geste annulé (quitter l'app) ne change pas d'onglet
await p.evaluate(()=>{V.tab='agenda';render()});
const tb=await p.evaluate(()=>{const b=document.querySelector('.tabs');const r=b.getBoundingClientRect();return {y:r.top+20,x:r.left+40}});
const bar=async(kind,dy)=>p.evaluate(([y,x,kind,dy])=>{const t=document.querySelector('.tabs button');const mk=(ty,x,y)=>new TouchEvent(ty,{bubbles:true,cancelable:true,touches:ty==='touchmove'||ty==='touchstart'?[new Touch({identifier:2,target:t,clientX:x,clientY:y})]:[],changedTouches:[new Touch({identifier:2,target:t,clientX:x,clientY:y})]});
  t.dispatchEvent(mk('touchstart',x,y));for(let k=1;k<=8;k++)t.dispatchEvent(mk('touchmove',x+30*k,y+dy*k/8));t.dispatchEvent(mk(kind,x+240,y+dy));return V.tab},[tb.y,tb.x,kind,dy]);
ok('barre : geste annulé par iOS → onglet inchangé',await bar('touchcancel',0)==='agenda');
await p.waitForTimeout(400);
ok('barre : vrai glissement → onglet changé',await bar('touchend',0)!=='agenda');
await p.evaluate(()=>{V.tab='agenda';render()});await p.waitForTimeout(400);
ok('barre : geste vers le haut (quitter) → onglet inchangé',await bar('touchend',-160)==='agenda');
// 8) notifications : pas de doublon local quand le push est actif
const nt=await p.evaluate(()=>{let sys=0;window.Notification=function(){sys++};Notification.permission='granted';localStorage.setItem('cadence-push',JSON.stringify({id:'x',h:''}));
  const t=new Date(Date.now()+60000),hh=String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0');
  S.items.push({id:'n1',type:'sport',title:'Footing',date:todayISO,time:hh,remind:0});touch();
  const ft=fireTime(S.items[S.items.length-1]);const real=Date.now;Date.now=()=>ft+5000;checkReminders();checkReminders();Date.now=real;
  return {sys,banners:document.querySelectorAll('#alerts .alert').length}});
ok('rappel de séance avec push actif : aucune notification système en double, 1 seul bandeau',nt.sys===0&&nt.banners===1,nt);
// 9) recette
await p.evaluate(()=>{V.tab='nutrition';V.nseg='repas';render();openRecipe(0)});await p.waitForTimeout(300);
ok('recette : ingrédients en liste (pas en cercle)',await p.evaluate(()=>{const u=$('#r-ing');return getComputedStyle(u).borderRadius==='0px'&&u.getBoundingClientRect().width>250}));
await T.done()})();
