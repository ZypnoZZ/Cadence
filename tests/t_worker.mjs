// Worker : un rappel déjà envoyé ne repart pas quand l'app renvoie son planning
import W from '../worker.js';
const kv=new Map();const env={LICENSES:{get:async(k,o)=>{const v=kv.get(k);return v==null?null:(o&&o.type==='json'?JSON.parse(v):v)},put:async(k,v)=>kv.set(k,v),delete:async k=>kv.delete(k),list:async({prefix})=>({keys:[...kv.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true})}};
let pushes=0;globalThis.fetch=async(u)=>{pushes++;return new Response('',{status:201})};
const req=(path,body)=>new Request('https://w.dev'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const sub={endpoint:'https://push.example/abc',keys:{}};
const r1=await (await W.fetch(req('/push/subscribe',{sub}),env)).json();
const t=Date.now()+30000,ev=[{t,title:'⚡ Séance',body:'b',tag:'c1'}];
await W.fetch(req('/push/schedule',{id:r1.id,events:ev}),env);
const run=async()=>{let w;await W.scheduled({},env,{waitUntil:x=>w=x});await w};
await run();const after1=pushes;
await W.fetch(req('/push/schedule',{id:r1.id,events:ev}),env); // l'app renvoie le même planning
await run();await run();
console.log('envois:',after1,'->',pushes);
const ok=after1===1&&pushes===1;console.log(ok?'PASS worker : 1 seul envoi malgré le renvoi du planning et 3 passages':'FAIL');process.exit(ok?0:1);
