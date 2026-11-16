// Affichage mobile : aucun débordement horizontal sur petit écran (iPhone SE) et grand (Pro Max)
const {boot}=require('./lib');const {devices}=require('playwright');
(async()=>{for(const dev of ['iPhone SE','iPhone 14 Pro Max']){const T=await boot({clock:'2026-11-18T10:00:00',ctx:{...devices[dev],serviceWorkers:'block'}});const {p,ok}=T;
 await p.evaluate(()=>{S.profile=Object.assign(S.profile||{},{sex:'h',age:22,h:180,w:75,act:1.55,goal:'maintien'});S.coach=Object.assign(coachCfg(),{start:iso(monday(today)),style:'muscu',days:3});S.prefs=Object.assign(prefs(),{ui:'full'});touch()});
 const views=[['seances',{wseg:'hist',wfull:1}],['seances',{wseg:'suivi'}],['seances',{wseg:'prog'}],['coach',{}],['journal',{jseg:'plats'}],['journal',{jseg:'log'}],['nutrition',{nseg:'repas'}],['settings',{sec:'privacy'}],['settings',{sec:'backup'}],['settings',{sec:'abo'}]];
 const bad=[];for(const [t,o] of views){const w=await p.evaluate(([t,o])=>{Object.assign(V,{endu:false,cours:false},o);V.tab=t;render();return [document.documentElement.scrollWidth,innerWidth]},[t,o]);if(w[0]>w[1]+1)bad.push(t+JSON.stringify(o)+':'+w)}
 await p.evaluate(()=>{V.tab='journal';V.jseg='plats';render();openPlat(12)});const sw=await p.evaluate(()=>{const pn=$('#rsheet .panel');return [pn.scrollWidth,pn.clientWidth]});if(sw[0]>sw[1]+1)bad.push('fiche:'+sw);
 ok(dev+' : aucun débordement horizontal',bad.length===0,bad);
 if(dev==='iPhone SE'){await p.evaluate(()=>{$('#rsheet').hidden=true;V.tab='journal';V.jseg='plats';render()});await p.screenshot({path:'m_se.png'})}
 if(T.er.length)console.log(T.er);await T.b.close();if(T.fails.length)process.exitCode=1}
 console.log(process.exitCode?'ECHECS':'TOUT PASSE')})();
