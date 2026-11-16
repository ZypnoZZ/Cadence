// Assiettes : classement, filtres vérifiés, fiche avec portions
const {boot}=require('./lib');
(async()=>{const T=await boot();const {p,ok}=T;
await p.evaluate(()=>{S.profile=Object.assign(S.profile||{},{sex:'h',age:22,h:180,w:75,act:1.55,goal:'maintien'});V.tab='journal';V.jseg='plats';V.jday=todayISO;touch();render()});await p.waitForTimeout(200);
const D=await p.evaluate(()=>{const all=platsAll();return {n:all.length,miss:all.filter(x=>x.miss.length).map(x=>x.n+':'+x.miss),dup:all.map(x=>x.n).filter((n,i,a)=>a.indexOf(n)!==i),
  noCat:all.filter(x=>!x.cats.length).length,cats:Object.fromEntries(PLAT_CATS.map(c=>[c[0],all.filter(x=>x.cats.includes(c[0])).length])),multi:all.filter(x=>x.cats.length>1).length,
  tags:Object.fromEntries(PLAT_TAGS.map(t=>[t[0],all.filter(x=>x.tags.includes(t[0])).length]))}});
console.log(JSON.stringify(D));
ok('92 recettes conservées (84 + 8 boissons), aucun doublon, tous les ingrédients reconnus',D.n===92&&!D.dup.length&&!D.miss.length,{dup:D.dup,miss:D.miss});
ok('chaque recette a au moins une catégorie, plusieurs pour certaines',D.noCat===0&&D.multi>20);
ok('catégorie Boisson remplie',D.cats.drink>=8);
// cohérence des filtres avec les valeurs
const chk=await p.evaluate(()=>{const bad=[];for(const x of platsAll()){const t=x.t,eP=t.p*4/t.k,eC=t.c*4/t.k;
  if(x.tags.includes('prot')&&!(eP>=.2&&t.p>=15))bad.push('prot:'+x.n);
  if(!x.tags.includes('prot')&&eP>=.2&&t.p>=15)bad.push('prot manquant:'+x.n);
  if(x.tags.includes('gluc')&&eC<.55)bad.push('gluc:'+x.n);
  if(x.tags.includes('veg')&&x.ing.some(z=>z[2][5]==='Viandes'||z[2][5]==='Poissons'))bad.push('veg:'+x.n);
  if(x.tags.includes('light')&&x.tags.includes('masse')&&x.t.k>450)bad.push('light/masse:'+x.n);
  if(x.tags.includes('rapide')&&x.min>15)bad.push('rapide:'+x.n);
  if(x.tags.includes('loss')&&!x.tags.includes('light'))bad.push('loss:'+x.n)}return bad});
ok('filtres cohérents avec les valeurs nutritionnelles et les ingrédients',chk.length===0,chk);
ok('un plat avec poisson n\'est pas végétarien',await p.evaluate(()=>!platInfo(PLATS.findIndex(x=>x[0]==='Poke bowl thon')).tags.includes('veg')));
ok('« Lasagnes » renommées selon leur vrai ingrédient (bolognaise, non végétarien)',await p.evaluate(()=>{const i=PLATS.findIndex(x=>/^Lasagnes/.test(x[0]));return PLATS[i][0]==='Lasagnes bolognaise et salade'&&!platInfo(i).tags.includes('veg')}));
await p.screenshot({path:'p_list.png'});
// catégorie + filtres combinés
await p.evaluate(()=>{document.querySelector('[data-act=plcat][data-c=dinner]').click()});
await p.evaluate(()=>{document.querySelector('[data-act=pltag][data-t=prot]').click()});await p.evaluate(()=>{document.querySelector('[data-act=pltag][data-t=rapide]').click()});
const comb=await p.evaluate(()=>[...document.querySelectorAll('.pl-card')].map(b=>platInfo(+b.dataset.i)).every(x=>x.cats.includes('dinner')&&x.tags.includes('prot')&&x.tags.includes('rapide')));
ok('Dîner + Riches en protéines + Rapide : résultats conformes',comb);
await p.evaluate(()=>{document.querySelector('[data-act=plclear]').click();V.plCat='all';render()});
// recherche par ingrédient
await p.evaluate(()=>{V.plQ='quinoa';render()});
ok('recherche par ingrédient (quinoa)',await p.evaluate(()=>{const l=[...document.querySelectorAll('.pl-card')].map(b=>platInfo(+b.dataset.i));return l.length>=3&&l.every(x=>x.ing.some(z=>/quinoa/i.test(z[0]))||/quinoa/i.test(x.n))}));
await p.evaluate(()=>{V.plQ='';V.plSort='prot';render()});
ok('tri par protéines',await p.evaluate(()=>{const l=[...document.querySelectorAll('.pl-card')].map(b=>platInfo(+b.dataset.i).t.p);return l.every((v,i)=>i===0||l[i-1]>=v)}));
// fiche + portions
await p.evaluate(()=>{V.plSort='name';render();openPlat(PLATS.findIndex(x=>x[0]==='Poulet, riz et brocoli'))});await p.waitForTimeout(200);
const f1=await p.evaluate(()=>({ing:[...$('#r-ing').children].map(li=>li.lastChild.textContent),meta:$('#r-meta').textContent,mac:$('#r-mac').textContent,tags:$('#r-tags').textContent}));
await p.screenshot({path:'p_sheet.png'});
await p.evaluate(()=>{document.querySelector('[data-act=plport][data-d="1"]').click();document.querySelector('[data-act=plport][data-d="1"]').click()});
const f3=await p.evaluate(()=>({ing:[...$('#r-ing').children].map(li=>li.lastChild.textContent),head:$('#r-ingh').textContent,tot:($('.r-tot')||{}).textContent}));
ok('fiche : préparation, cuisson, portions, macros par portion',/préparation/.test(f1.meta)&&/cuisson/.test(f1.meta)&&/kcal/.test(f1.mac),f1);
ok('3 portions : quantités ×3 et total recalculé',f3.ing[0]==='450 g'&&f1.ing[0]==='150 g'&&/3 portions/.test(f3.head)&&/Pour 3 portions/.test(f3.tot||''),f3);
const k0=await p.evaluate(()=>(S.log[todayISO]||[]).length);
await p.evaluate(()=>document.querySelector('[data-act=pladd][data-m=dinner]').click());
ok('ajout au journal : 1 portion avec ses valeurs',await p.evaluate(k=>{const l=S.log[todayISO];const e=l[l.length-1];const x=platInfo(PLATS.findIndex(z=>z[0]==='Poulet, riz et brocoli'));return l.length===k+1&&e.k===Math.round(x.t.k)&&e.meal==='dinner'},k0));
await T.done()})();
