// Refonte des interfaces v108 : rendu + données réelles
const {boot}=require('./lib');
(async()=>{const T=await boot({clock:'2026-11-18T10:00:00'});const {p,clk,ok}=T;
await p.evaluate(()=>{
  S.profile=Object.assign(S.profile||{},{sex:'h',age:22,h:180,w:75,act:1.55,goal:'maintien'});
  S.coach=Object.assign(coachCfg(),{start:iso(addDays(monday(today),-21)),style:'muscu',level:'inter',days:3,place:'gym'});
  S.prefs=Object.assign(prefs(),{ui:'full',anim:'never'});
  const W=(d,t,ex,o)=>Object.assign({id:'w'+Math.random().toString(36).slice(2,8),date:iso(addDays(today,d)),title:t,dur:60,note:'',ex},o||{});
  const bench=(kg)=>({name:'Développé couché',kind:'force',sets:[{r:8,kg},{r:8,kg},{r:7,kg}]});
  const sq=(kg)=>({name:'Squat barre',kind:'force',sets:[{r:5,kg},{r:5,kg}]});
  S.workouts=[W(-20,'Haut du corps',[bench(60)]),W(-13,'Haut du corps',[bench(62.5)]),W(-12,'Bas du corps',[sq(90)]),W(-6,'Haut du corps',[bench(65)]),W(-5,'Course',[{name:'Course à pied',kind:'cardio',sets:[],min:40,km:7.5}]),
    W(-1,'Bas du corps',[sq(95)]),
    // séance du coach ouverte mais pas faite (préremplie) : ne doit pas compter
    W(0,'Haut du corps',[{name:'Tractions',kind:'force',sets:[{r:8,kg:''},{r:8,kg:''}]}],{note:'Programme du coach',st:'live'})];
  S.items.push({id:'ag1',type:'sport',title:'Foot',date:iso(addDays(today,2)),time:'19:00'});
  touch();V.tab='seances';V.wseg='hist';V.wfull=1;render()});
await p.waitForTimeout(300);await p.screenshot({path:'u_hist.png',fullPage:false});
const wk=await p.evaluate(()=>{const d=weekPlan(monday(today));return d.map(x=>x.state)});
ok('semaine : états des jours (lun..dim)',wk.length===7&&wk[1]==='done'&&wk[2]!=='done'&&wk[4]==='plan',wk);
ok('séance en cours : bandeau Reprendre',await p.evaluate(()=>!!document.querySelector('.livebar')));
ok('plus de « kg soulevés » ni « volume » dans Séances',await p.evaluate(()=>!/soulev|Volume/i.test($('#view').textContent)));
await p.evaluate(()=>{V.wseg='suivi';V.sper=30;render()});await p.waitForTimeout(200);
ok('statistiques : séances faites = 5 sur 30 jours (séance ouverte exclue)',await p.evaluate(()=>actIn(iso(addDays(today,-29)),todayISO).n)===6);
ok('plus de volume soulevé dans les stats',await p.evaluate(()=>!/soulev/i.test($('#view').textContent)));
await p.screenshot({path:'u_stats.png',fullPage:true});
const ms=await p.evaluate(()=>[...document.querySelectorAll('.msc-r')].map(r=>r.querySelector('.msc-n').textContent+':'+r.querySelector('.msc-v b').textContent));
ok('séries par muscle : pectoraux comptés sur séries faites',ms.some(x=>/Pectoraux/.test(x)),ms.slice(0,4));
await p.evaluate(()=>{V.wseg='prog';render()});await p.waitForTimeout(200);
const ex=await p.evaluate(()=>[...document.querySelectorAll('.exchips button')].map(b=>b.firstChild.textContent));
ok('par exercice : seuls les exercices réellement faits',ex.length===3&&!ex.includes('Tractions'),ex);
await p.evaluate(()=>{document.querySelector('.exchips button[data-n="Développé couché"]').click()});await p.waitForTimeout(150);
ok('par exercice : courbe + 3 séances',await p.evaluate(()=>!!document.querySelector('#view svg.chart polyline')&&/3/.test(document.querySelectorAll('.stats .stat')[3].textContent)));
await p.screenshot({path:'u_prog.png',fullPage:true});
await p.evaluate(()=>{S.workouts=[];touch();render()});
ok('par exercice : état vide clair',await p.evaluate(()=>/Aucun exercice/.test($('#view').textContent)));
// Coach
await p.evaluate(()=>{V.tab='coach';V.cours=false;V.endu=false;render()});await p.waitForTimeout(200);
const order=await p.evaluate(()=>{const v=$('#view');const pc=v.querySelector('.progcard'),op=v.querySelector('.copts');return pc&&op&&(pc.compareDocumentPosition(op)&Node.DOCUMENT_POSITION_FOLLOWING)?'ok':'ko'});
ok('coach : « Mon programme » en haut, options juste après',order==='ok');
await p.screenshot({path:'u_coach.png'});
await p.evaluate(()=>document.querySelector('[data-act=goobj]').click());await p.waitForTimeout(300);
ok('kcal du coach → Nutrition › Objectifs',await p.evaluate(()=>V.tab==='nutrition'&&V.nseg==='macros'));
await p.evaluate(()=>{V.tab='coach';render();document.querySelector('[data-act=ptoggle][data-k=cours]').click()});await p.waitForTimeout(200);
ok('« Proposer les autres cours » désactivable (sauvé)',await p.evaluate(()=>S.prefs.cours===false&&!document.querySelector('[data-act=coursopen]')));
await p.evaluate(()=>{V.tab='settings';V.sec='train';render()});
ok('même option dans les Réglages',await p.evaluate(()=>!!document.querySelector('[data-act=pset][data-k=cours][data-v=false][aria-pressed=true]')));
await p.evaluate(()=>{S.prefs.cours=true;S.endu={sport:'run',goal:'10k',level:'inter',days:[1,3,6],longDay:6,start:iso(monday(today)),created:todayISO,pr:{k10:3000}};enInval();touch();V.tab='coach';render()});await p.waitForTimeout(200);
ok('endurance activée : séances Sports dans la semaine du coach',await p.evaluate(()=>document.querySelectorAll('.enwk-r').length>0));
await p.evaluate(()=>document.querySelector('[data-act=ptoggle][data-k=sports]').click());await p.waitForTimeout(200);
ok('endurance désactivée : séances Sports retirées, programme gardé',await p.evaluate(()=>!document.querySelector('.enwk-r')&&!!S.endu&&S.prefs.sports===false));
await p.reload();await p.waitForTimeout(1500);
ok('choix conservé après réouverture',await p.evaluate(()=>prefs().sports===false&&prefs().cours===true));
await p.addStyleTag({content:'#gate,#license,#toast,#lock,#splash{display:none!important}'});
// Menus
await p.evaluate(()=>{$('#lvsheet').hidden=true;V.tab='nutrition';V.nseg='repas';render()});
ok('menus : boutons explicites',await p.evaluate(()=>/Changer les repas de/.test($('#view').textContent)&&/Changer les 7 jours/.test($('#view').textContent)));
// Notification dans l'app
await p.evaluate(()=>{V.tab='agenda';render();pushAlert({id:'z',type:'sport',title:'Haut du corps',date:todayISO,time:'18:00'})});await p.waitForTimeout(400);
await p.screenshot({path:'u_alert.png'});
ok('notification : 1 bandeau avec Ouvrir/OK',await p.evaluate(()=>document.querySelectorAll('#alerts .alert .al-go').length===1));
await T.done()})();
