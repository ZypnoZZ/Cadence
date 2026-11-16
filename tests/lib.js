// Helpers communs aux tests Playwright de Cadence
const {chromium,devices}=require('playwright');
const URL0='http://localhost:8765/index.html';
async function boot(opts={}){
  const b=await chromium.launch();
  const ctx=await b.newContext({...devices['iPhone 13'],serviceWorkers:'block',...(opts.ctx||{})});
  if(opts.clock)await ctx.clock.install({time:new Date(opts.clock)});
  const p=await ctx.newPage();const er=[];p.on('pageerror',e=>er.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|ERR_|net::/.test(m.text()))er.push('console: '+m.text())});
  if(opts.init)await p.addInitScript(opts.init);
  await p.goto(URL0);await p.waitForTimeout(700);
  await p.evaluate(()=>{try{localStorage.setItem('cadence-glass-asked','1')}catch(e){}S.tuto=1;S.tutoC=1;S.setup=1;S.onb=1;
    licenseSet({type:'sub',email:'a@b.fr',active:true,plan:'coach',checked:Date.now()});
    ['gate','license','tuto','setup','onb','lock','splash'].forEach(i=>{const e=document.getElementById(i);if(e)e.hidden=true});touch();render()});
  await p.addStyleTag({content:'#gate,#license,#toast,#lock,#splash{display:none!important}'});
  await p.evaluate(()=>{document.body.style.position=''});
  const clk=async(sel,i=0)=>{const ok=await p.evaluate(([s,i])=>{const e=[...document.querySelectorAll(s)].filter(x=>x.offsetParent||x.closest('#player'))[i];if(!e)return false;e.click();return true},[sel,i]);if(!ok)throw new Error('introuvable: '+sel);await p.waitForTimeout(150)};
  const fails=[];const ok=(n,c,extra)=>{console.log((c?'PASS ':'FAIL ')+n+(extra!==undefined?' :: '+JSON.stringify(extra):''));if(!c)fails.push(n)};
  const done=async()=>{ok('aucune erreur JS',er.length===0,er.slice(0,3));await b.close();console.log(fails.length?'ECHECS: '+fails.join(' | '):'TOUT PASSE');process.exit(fails.length?1:0)};
  return {b,ctx,p,er,clk,ok,done,fails};
}
module.exports={boot};
