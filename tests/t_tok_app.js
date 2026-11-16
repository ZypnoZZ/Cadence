// App : jeton d'abonnement, code de transfert, et son du minuteur (migration du réglage)
const {boot}=require('./lib');
(async()=>{const T=await boot({init:()=>{window.__plays=0;const op=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.__plays++;return op.call(this)};window.__as={type:'auto'};Object.defineProperty(navigator,'audioSession',{value:window.__as,configurable:true})}});const {p,ok,ctx}=T;
const seen=[];
await ctx.route(/workers\.dev\/(status|claim|transfer|portal)/,r=>{const u=new URL(r.request().url());seen.push(u.pathname+'?'+u.search);const tok=u.searchParams.get('tok');const j=x=>r.fulfill({contentType:'application/json',body:JSON.stringify(x),headers:{'access-control-allow-origin':'*'}});
  if(u.pathname==='/status')return j(tok==='T1'?{active:true,plan:'coach'}:{active:false,plan:'base',auth:'required'});
  if(u.pathname==='/claim')return j({email:'moi@x.fr',tok:'T1'});
  if(u.pathname==='/transfer/use')return j(u.searchParams.get('code')==='ABCD2345'?{email:'moi@x.fr',tok:'T1'}:{error:'Code inconnu ou expiré'});
  if(u.pathname==='/transfer/new')return j(tok==='T1'?{code:'ZZZZ9999'}:{auth:'required'});
  return j({})});
// 1) e-mail d'un autre sans jeton : refusé, explication
await p.evaluate(()=>{localStorage.removeItem('cadence-license');V.lic=true;updateGate();$('#lic-email').value='moi@x.fr';document.querySelector('[data-act=liccheck]').click()});await p.waitForTimeout(500);
ok('e-mail seul : pas d\'abonnement, explication du code de transfert',await p.evaluate(()=>!licenseOK()&&/code/.test($('#lic-msg').textContent)));
// 2) code de transfert
await p.evaluate(()=>{$('#lic-code').value='abcd-2345';document.querySelector('[data-act=licadmin]').click()});await p.waitForTimeout(800);
ok('code de transfert → abonnement activé',await p.evaluate(()=>licenseOK()&&licensePlan()==='coach'&&tokFor('moi@x.fr')==='T1'));
ok('les appels suivants envoient le jeton',seen.some(x=>x.startsWith('/status')&&x.includes('tok=T1')));
// 3) retour de paiement : jeton via la session Stripe
await p.evaluate(()=>{localStorage.removeItem('cadence-toks');localStorage.removeItem('cadence-license');V.licSid='cs_test_1';licenseActivate()});await p.waitForTimeout(1500);
ok('retour de paiement : jeton récupéré, abonnement actif',await p.evaluate(()=>tokFor('moi@x.fr')==='T1'&&licenseOK()));
// 4) créer un code pour un autre appareil
await p.evaluate(()=>{V.tab='settings';V.sec='abo';render();document.querySelector('[data-act=xfernew]').click()});await p.waitForTimeout(500);
ok('Mon abonnement : code pour un autre appareil affiché',await p.evaluate(()=>/ZZZZ 9999/.test($('#view').textContent)));
// 5) son : ancien réglage « Lecteur » enregistré sans choix explicite → minuteur intégré, aucune lecture audio
await p.evaluate(()=>{S.prefs=Object.assign({},S.prefs,{lock:'cadence'});delete S.prefs.lockSet;touch();rtStart(60,'Repos')});await p.waitForTimeout(700);
ok('ancien réglage hérité : minuteur intégré, musique non coupée',await p.evaluate(()=>prefs().lock==='none'&&__plays===0&&__as.type==='ambient'),await p.evaluate(()=>({l:prefs().lock,plays:__plays,as:__as.type})));
await p.evaluate(()=>rtStop());
// choix explicite du mode Lecteur
await p.evaluate(()=>{V.tab='settings';V.sec='train';render();document.querySelector('[data-act=pset][data-k=lock][data-v=cadence]').click();rtStart(60,'Repos')});await p.waitForTimeout(700);
ok('« Lecteur » choisi exprès : conservé',await p.evaluate(()=>prefs().lock==='cadence'&&__plays>0));
await p.evaluate(()=>{rtStop();document.querySelector('[data-act=pset][data-k=lock][data-v=none]').click()});
ok('retour à « Dans Cadence »',await p.evaluate(()=>prefs().lock==='none'));
await T.done()})();
