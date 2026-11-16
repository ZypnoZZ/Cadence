// Non-régression : chaque onglet, chaque section des réglages, gestes principaux, données conservées
const {boot}=require('./lib');
(async()=>{const T=await boot({clock:'2026-11-18T10:00:00'});const {p,ok}=T;
await p.evaluate(()=>{S.profile=Object.assign(S.profile||{},{name:'Thibaut',sex:'h',age:22,h:180,w:75,act:1.55,goal:'maintien'});
  S.coach=Object.assign(coachCfg(),{start:iso(addDays(monday(today),-7)),style:'muscu',level:'inter',days:4,place:'gym'});
  S.items.push({id:'i1',type:'sport',title:'Foot',date:todayISO,time:'19:00'},{id:'i2',type:'todo',title:'Courses',date:todayISO});
  S.workouts.push({id:'w1',date:iso(addDays(today,-2)),title:'Push',dur:50,note:'',ex:[{name:'Développé couché',kind:'force',sets:[{r:8,kg:60}]}]});
  S.log[todayISO]=[{id:'l1',meal:'lunch',name:'Riz',g:200,k:260,p:5,c:56,f:1,src:'liste'}];
  S.weights=[{d:iso(addDays(today,-10)),w:76},{d:iso(addDays(today,-3)),w:75.4},{d:todayISO,w:75}];
  S.endu={sport:'run',goal:'10k',level:'inter',days:[1,3,6],longDay:6,start:iso(monday(today)),created:todayISO,pr:{k10:3000}};enInval();touch()});
const tabs=[['agenda'],['seances',{wseg:'hist',wfull:1}],['seances',{wseg:'suivi'}],['seances',{wseg:'prog'}],['coach'],['coach',{endu:true,enTab:'home'}],['coach',{endu:true,enTab:'cal'}],['coach',{endu:true,enTab:'stats'}],['coach',{endu:true,enTab:'watch'}],['coach',{endu:true,enTab:'prof'}],['coach',{cours:true}],
  ['journal',{jseg:'log'}],['journal',{jseg:'plats'}],['nutrition',{nseg:'jour'}],['nutrition',{nseg:'suivi'}],['nutrition',{nseg:'macros'}],['nutrition',{nseg:'repas'}],['nutrition',{nseg:'courses'}],['records'],['suivi'],['poids']];
const bad=[];
for(const [t,o] of tabs){const r=await p.evaluate(([t,o])=>{try{Object.assign(V,{endu:false,cours:false,enSess:null,wEdit:null},o||{});V.tab=t;render();return $('#view').textContent.length}catch(e){return 'ERR '+e.message}},[t,o]);if(typeof r!=='number'||r<40)bad.push(t+JSON.stringify(o||{})+':'+r)}
ok('tous les onglets s\'affichent',bad.length===0,bad);
const secs=['account','abo','train','notif','theme','security','backup','privacy','legalmenu','data','profiles'];const bs=[];
for(const s of secs){const r=await p.evaluate(s=>{try{V.tab='settings';V.sec=s;render();return $('#view').textContent.length}catch(e){return 'ERR '+e.message}},s);if(typeof r!=='number'||r<20)bs.push(s+':'+r)}
ok('toutes les sections des réglages s\'affichent',bs.length===0,bs);
ok('volet de réglages : entrée « Confidentialité et données »',await p.evaluate(()=>{openDrawer();const t=$('#dr-items').textContent;closeDrawer();return /Confidentialité et données/.test(t)}));
// éditeur de séance + agenda + courbe de poids (cassée depuis la v103)
ok('éditeur de séance',await p.evaluate(()=>{V.tab='seances';V.wEdit='w1';render();return !!document.querySelector('[data-act=wclose]')}));
ok('courbe de poids réparée (Nutrition › Suivi)',await p.evaluate(()=>{V.wEdit=null;V.tab='nutrition';V.nseg='suivi';V.sper=30;render();return !!document.querySelector('#view svg.chart polyline')}));
ok('agenda : fiche du jour au double toucher',await p.evaluate(()=>{V.tab='agenda';render();return typeof openDay==='function'}));
// export des données
const dl=await Promise.all([p.waitForEvent('download',{timeout:3000}).catch(()=>null),p.evaluate(()=>exportData())]);
ok('export des données : fichier JSON',!!dl[0]&&/cadence-donnees-.*\.json/.test(dl[0].suggestedFilename()),dl[0]&&dl[0].suggestedFilename());
// persistance après réouverture
await p.reload();await p.waitForTimeout(1500);
ok('données conservées après réouverture',await p.evaluate(()=>S.workouts.some(w=>w.id==='w1')&&S.items.some(i=>i.id==='i1')&&!!S.endu&&(S.log[todayISO]||[]).length===1));
// suppression du compte : confirmation en deux temps
await p.addStyleTag({content:'#gate,#license,#toast,#lock,#splash{display:none!important}'});
await p.evaluate(()=>{$('#lvsheet').hidden=true;V.tab='settings';V.sec='privacy';render();document.querySelector('[data-act=delacct]').click()});
ok('suppression : demande de confirmation',await p.evaluate(()=>/Confirmer/.test(document.querySelector('[data-act=delacct]').textContent)&&S.workouts.length>0));
await p.evaluate(()=>{window.__nav=null;document.querySelector('[data-act=delacct]').click()});await p.waitForTimeout(600);
ok('suppression confirmée : données du profil effacées',await p.evaluate(()=>S.workouts.length===0&&!S.endu));
await T.done()})();
