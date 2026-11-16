// Reprise de séance : une seule proposition par interruption, décisions respectées, aucune perte, aucun doublon
const {boot}=require('./lib');
(async()=>{const T=await boot({clock:'2026-11-17T10:00:00'});const {p,ok}=T;
const relaunch=async()=>{await p.reload();await p.waitForTimeout(1900);await p.addStyleTag({content:'#gate,#license,#toast,#lock,#splash{display:none!important}'})};
const st=()=>p.evaluate(()=>({popup:!$('#lvsheet').hidden,player:!$('#player').hidden,i:PL.i,set:PL.set,ph:PL.phase,n:S.workouts.length,live:JSON.parse(localStorage.getItem('cadence-live')||'null')}));
await p.evaluate(()=>{S.profile=Object.assign(S.profile||{},{sex:'h',age:22,h:180,w:75,act:1.55,goal:'maintien'});
  S.coach=Object.assign(coachCfg(),{start:iso(monday(today)),style:'muscu',level:'inter',days:4,place:'gym'});S.prefs=Object.assign(prefs(),{anim:'never'});touch();V.tab='coach';render()});
const ti=await p.evaluate(()=>{const tw=(today.getDay()+6)%7;return (V.coachWeek||[]).findIndex(s=>s.wd===tw)});
// 1) démarrer, faire 2 séries (repos en cours), « fermer l'app »
await p.evaluate(i=>document.querySelector('[data-act=cstart][data-i="'+i+'"]').click(),ti);await p.waitForTimeout(300);
await p.evaluate(()=>{$('#pl-kg')&&($('#pl-kg').value='62.5');document.querySelector('[data-act=psetdone]').click()});await p.waitForTimeout(200);
await p.evaluate(()=>{PL.t&&PL.t.done&&(()=>{const d=PL.t.done;stopTimer();PL.phase='work';d()})();document.querySelector('[data-act=psetdone]').click()});await p.waitForTimeout(300);
const before=await st();const sets=await p.evaluate(()=>JSON.stringify(curPW().ex[0].sets));
ok('état sauvegardé pendant la séance (exercice, série, repos)',before.live&&before.live.open&&before.live.set===before.set,{i:before.i,set:before.set,ph:before.ph});
await relaunch();let s=await st();
ok('1er lancement après fermeture : UNE proposition de reprise',s.popup&&!s.player);
// 2) reprendre
await p.evaluate(()=>document.querySelector('[data-act=lv-go]').click());await p.waitForTimeout(400);s=await st();
ok('reprise : bon exercice, bonne série, repos recalculé',s.player&&s.i===before.i&&s.set===before.set&&s.ph==='rest',{i:s.i,set:s.set,ph:s.ph});
ok('séries et charges conservées',await p.evaluate(x=>JSON.stringify(curPW().ex[0].sets)===x,sets));
// 3) fermer l'app pendant la séance reprise, rouvrir : pas de question, reprise directe
await relaunch();s=await st();
ok('après « Reprendre » : plus de question, la séance se rouvre directement',!s.popup&&s.player&&s.set===before.set,{popup:s.popup,player:s.player});
await relaunch();s=await st();ok('3e lancement : toujours aucune fenêtre',!s.popup&&s.player);
// 4) « Plus tard »
await p.evaluate(()=>{const x=JSON.parse(localStorage.getItem('cadence-live'));x.choice=null;x.open=true;localStorage.setItem('cadence-live',JSON.stringify(x))});
await relaunch();s=await st();ok('nouvelle interruption sans décision : une proposition',s.popup);
await p.evaluate(()=>document.querySelector('[data-act=lv-later]').click());
await relaunch();s=await st();ok('« Plus tard » respecté : pas de fenêtre au lancement suivant',!s.popup&&!s.player);
await relaunch();s=await st();ok('… ni au suivant',!s.popup);
ok('séance toujours disponible dans Séances (bandeau Reprendre)',await p.evaluate(()=>{V.tab='seances';V.wseg='hist';V.wfull=1;render();return !!document.querySelector('.livebar')}));
// reprendre depuis le bandeau garde la position
await p.evaluate(()=>document.querySelector('.livebar').click());await p.waitForTimeout(300);s=await st();
ok('reprise depuis Séances : même position',s.player&&s.set===before.set);
// 5) quitter le lecteur soi-même : pas de fenêtre
await p.evaluate(()=>document.querySelector('[data-act=pquit]')?document.querySelector('[data-act=pquit]').click():closePlayer());await p.waitForTimeout(200);
await relaunch();s=await st();ok('quitter la séance soi-même : pas de fenêtre au lancement',!s.popup&&!s.player);
// 6) pas de doublon en relançant la séance du jour
await p.evaluate(i=>{lastStartAt=0;V.tab='coach';render();document.querySelector('[data-act=cstart][data-i="'+i+'"]').click()},ti);await p.waitForTimeout(300);
ok('relancer la séance du jour : même séance, aucun doublon',(await st()).n===before.n);
// 7) terminer : plus aucune reprise
await p.evaluate(()=>{PL.i=curPW().ex.length;finishPlayer()});await p.evaluate(()=>closePlayer());
await relaunch();s=await st();ok('séance terminée : aucune reprise proposée, état supprimé',!s.popup&&!s.player&&!s.live);
ok('séance terminée comptée, données intactes',await p.evaluate(x=>{const w=S.workouts.find(w=>w.st==='done');return !!w&&JSON.stringify(w.ex[0].sets)===x&&actIn(todayISO,todayISO).n===1},sets));
// 8) abandon : nouvelle séance, interruption, « Arrêter cette séance »
await p.evaluate(()=>{const w={id:'ab1',date:todayISO,title:'Cardio',note:'Programme du coach',st:'live',ex:[{name:'Burpees',kind:'force',sets:[{r:10,kg:''},{r:10,kg:''}]}]};S.workouts.push(w);touch();openPlayer('ab1',false)});await p.waitForTimeout(200);
await relaunch();s=await st();ok('autre séance interrompue : proposition',s.popup);
await p.evaluate(()=>document.querySelector('[data-act=lv-stop]').click());await p.waitForTimeout(200);
ok('« Arrêter » : séance non comptée (rien fait), gardée dans l\'historique, état supprimé',await p.evaluate(()=>{const w=S.workouts.find(w=>w.id==='ab1');return w&&w.st==='abandoned'&&!wDone(w)&&!localStorage.getItem('cadence-live')}));
await relaunch();s=await st();ok('après abandon : plus aucune proposition',!s.popup&&!s.player);
// 9) ancien état de la v110 (sans décision enregistrée) : pas de fenêtre au lancement
await p.evaluate(()=>{const w={id:'old1',date:todayISO,title:'Push',note:'Programme du coach',st:'live',ex:[{name:'Pompes',kind:'force',sets:[{r:10,kg:''}]}]};S.workouts.push(w);touch();localStorage.setItem('cadence-live',JSON.stringify({w:'old1',i:0,set:0,phase:'work',at:Date.now()}))});
await relaunch();s=await st();ok('ancien état v110 : plus de fenêtre automatique (bandeau seulement)',!s.popup);
await T.done()})();
