'use strict';
const {chromium,devices}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ARTIFACT=process.env.TEST_ARTIFACT_DIR||'test-artifacts';
fs.mkdirSync(ARTIFACT,{recursive:true});
const URL=process.env.TEST_URL||'http://127.0.0.1:8765/';
const KEY='ki-fighter-cedar-journey-v1';
const bridge=`
window.__kiTest={
 state(){return {mode,step:journeyStep,items:[...inventory],equipment:{...equipment},effects:itemEffects(),xp:player.xp,level:player.level,position:{x:player.x,y:player.y},cleared:[...clearedCamps],enemies:enemies.map(e=>e.id)}},
 give(id){return collectItem(id)},
 equip(id){return equipItem(id)},
 xp(amount){return grantExperience(amount)},
 position(x,y){player.x=x;player.y=y;player.vx=0;player.vy=0;player.hurt=0;player.inv=0;},
 step(step){journeyStep=step;spawnJourneyEnemies();saveJourney()},
 defeat(id){updateJourneyDefeat({id});saveJourney()},
 interact(){interact()},
 save(){saveJourney()},
 resetXP(){player.xp=0;player.level=1;player.points=0},
 clearEnemies(){enemies=[]},
 measureMovement(multiplier){enemies=[];player.x=1250;player.y=290;player.vx=0;player.vy=0;player.hurt=0;player.beam=0;player.beamCharge=null;player.cd=0;held.clear();held.add('right');for(let i=0;i<30;i++)update(1/60);held.clear();return player.x-1250},
 forceSave(data){localStorage.setItem(journeyKey,JSON.stringify(data));loadJourney()},
 closeTalk(){closeStory()},
 render(){render()}
};
`;
async function run(name,opts){
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext(opts);
 const page=await context.newPage();
 await page.route('**/*',async route=>{
  if(new URL(route.request().url()).pathname!=='/')return route.continue();
  const response=await route.fetch();const html=await response.text();
  const marker='})();\n</script></div>';
  if(!html.includes(marker))throw new Error('Game test bridge injection marker missing');
  await route.fulfill({response,body:html.replace(marker,bridge+'\n})();\n</script></div>')});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const report={name,checks:[],errors};
 const check=(label,fn)=>{report.checks.push(label);return fn()};
 try{
  await page.goto(URL,{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/New Game/i}).first().click();
  await check('Character/NPC and dojo artwork decodes',async()=>{
   const result=await page.evaluate(async()=>{
    const paths=[0,1,2,3].map(i=>'assets/dojo-master-production-'+i+'.svg');
    const images=await Promise.all(paths.map(async src=>{const img=new Image();img.src=src;await img.decode();return [img.naturalWidth,img.naturalHeight]}));
    return images;
   });
   assert.deepEqual(result,[[64,96],[64,96],[64,96],[64,96]]);
  });
  await check('Initial inventory and modifiers',async()=>{
   const st=await page.evaluate(()=>window.__kiTest.state());
   assert.deepEqual(st.items,[]);assert.equal(st.effects.speed,1);assert.equal(st.effects.xp,1);
  });
  await check('Reject unknown and unowned items',async()=>{
   assert.equal(await page.evaluate(()=>window.__kiTest.equip('training_weights')),false);
   assert.equal(await page.evaluate(()=>window.__kiTest.give('__unknown')),false);
  });
  await check('Collection is unique and equip toggles',async()=>{
   const result=await page.evaluate(()=>{
    const api=window.__kiTest;
    return [api.give('training_weights'),api.give('training_weights'),api.equip('training_weights'),api.state(),api.equip('training_weights'),api.state()];
   });
   assert.deepEqual(result.slice(0,3),[true,false,true]);
   assert.equal(result[3].effects.speed,.8);assert.equal(result[3].effects.xp,1.3);
   assert.equal(result[5].effects.speed,1);
  });
  await check('Exclusive slots and multiplicative stat modifiers',async()=>{
   const st=await page.evaluate(()=>{
    const a=window.__kiTest;
    a.give('iron_weights');a.give('wind_charm');a.give('scholar_charm');
    a.equip('training_weights');a.equip('wind_charm');
    const mixed=a.state();
    a.equip('iron_weights');a.equip('scholar_charm');
    return {mixed,final:a.state()};
   });
   assert.equal(st.mixed.equipment.training,'training_weights');
   assert.equal(st.mixed.equipment.charm,'wind_charm');
   assert.ok(Math.abs(st.mixed.effects.speed-.896)<1e-8);
   assert.equal(st.final.equipment.training,'iron_weights');
   assert.equal(st.final.equipment.charm,'scholar_charm');
   assert.ok(Math.abs(st.final.effects.xp-1.736)<1e-8);
  });
  await check('XP modifier applies once and rounds correctly',async()=>{
   const out=await page.evaluate(()=>{
    const a=window.__kiTest;a.resetXP();const earned=a.xp(17);
    return {earned,xp:a.state().xp};
   });
   assert.deepEqual(out,{earned:30,xp:30});
  });
  await check('Movement penalty affects real movement integration',async()=>{
   const out=await page.evaluate(()=>{
    const a=window.__kiTest;
    a.equip('iron_weights'); // unequip
    a.equip('scholar_charm'); // unequip
    const normal=a.measureMovement();
    a.equip('training_weights');
    const weighted=a.measureMovement();
    return {normal,weighted};
   });
   assert.ok(out.normal>0,'Normal movement must advance');
   assert.ok(out.weighted>0&&out.weighted<out.normal*.90,'Weights must measurably reduce actual movement '+JSON.stringify(out));
  });
  await check('Inventory UI opens and shows owned items and modifiers',async()=>{
   await page.locator('#kf-inventory-open').click();
   const dialog=page.locator('#kf-inventory');
   await dialog.waitFor({state:'visible'});
   assert.match(await dialog.innerText(),/Training Weights/);
   assert.match(await dialog.innerText(),/Movement/);
   await page.screenshot({path:path.join(ARTIFACT,name+'-inventory.png')});
   await dialog.getByRole('button',{name:'Close'}).click();
  });
  await check('Quest acceptance via real NPC interaction',async()=>{
   await page.evaluate(()=>{const a=window.__kiTest;a.step('done');a.position(1255,197);a.interact()});
   assert.match(await page.locator('#kfstory-text').innerText(),/three disciples/i);
   await page.getByRole('button',{name:/Accept: Trial of Discipline/i}).click();
   const st=await page.evaluate(()=>window.__kiTest.state());
   assert.equal(st.step,'trial');
   assert.equal(st.enemies.filter(id=>id?.startsWith('trial-')).length,3);
  });
  await check('Three distinct kills required; explicit turn-in',async()=>{
   const result=await page.evaluate(()=>{
    const a=window.__kiTest;a.clearEnemies();
    a.defeat('trial-one');const one=a.state();
    a.defeat('trial-two');const two=a.state();
    a.defeat('trial-three');const three=a.state();
    return {one,two,three};
   });
   assert.equal(result.one.step,'trial');
   assert.equal(result.two.step,'trial');
   assert.equal(result.three.step,'trial-cleared');
   assert.ok(!result.three.items.includes('cedar_token'),'No reward before master turn-in');
  });
  await check('Master reward is claimable exactly once',async()=>{
   await page.evaluate(()=>{const a=window.__kiTest;a.position(1255,197);a.interact()});
   assert.match(await page.locator('#kfstory-text').innerText(),/Training weights/i);
   await page.getByRole('button',{name:/Claim training reward/i}).click();
   const first=await page.evaluate(()=>window.__kiTest.state());
   assert.equal(first.step,'mastered');
   assert.ok(first.items.includes('cedar_token'));
   assert.ok(first.items.includes('training_weights'));
   await page.evaluate(()=>window.__kiTest.interact());
   assert.equal(await page.getByRole('button',{name:/Claim training reward/i}).count(),0);
   await page.evaluate(()=>window.__kiTest.closeTalk());
  });
  await check('Saved quest, items and equipment survive reload',async()=>{
   await page.evaluate(()=>{window.__kiTest.equip('iron_weights');window.__kiTest.save()});
   const before=await page.evaluate(()=>window.__kiTest.state());
   await page.reload();
   await page.getByRole('button',{name:/Continue/i}).first().click();
    const after=await page.evaluate(()=>window.__kiTest.state());
   assert.equal(after.step,before.step);
   assert.deepEqual(after.items.sort(),before.items.sort());
   assert.deepEqual(after.equipment,before.equipment);
  });
  await check('Legacy save v2 migrates safely; invalid IDs rejected',async()=>{
   const out=await page.evaluate(()=>{
    const a=window.__kiTest;
    a.forceSave({version:2,step:'done',cleared:[],stats:{level:1,xp:0},items:['not_real','training_weights'],equipment:{training:'not_real',charm:'wind_charm'}});
    return a.state();
   });
   assert.equal(out.step,'done');
   assert.deepEqual(out.items,['training_weights']);
   assert.equal(out.equipment.training,null);
   assert.equal(out.equipment.charm,null);
  });
  await check('Dojo screenshot and rendering without browser errors',async()=>{
   await page.evaluate(()=>{const a=window.__kiTest;a.clearEnemies();a.position(1255,270);a.render()});
   await page.waitForTimeout(250);
   await page.screenshot({path:path.join(ARTIFACT,name+'-dojo.png')});
   assert.deepEqual(errors,[],'Browser errors: '+errors.join('; '));
  });
  report.status='passed';
 }catch(e){
  report.status='failed';report.failure=e.stack||String(e);
  await page.screenshot({path:path.join(ARTIFACT,name+'-failure.png')}).catch(()=>{});
 }finally{
  fs.writeFileSync(path.join(ARTIFACT,name+'-report.json'),JSON.stringify(report,null,2));
  await context.close();await browser.close();
 }
 console.log(name,report.status,report.checks.length+' checks',report.failure||'');
 return report;
}
(async()=>{
 const results=[];
 results.push(await run('desktop',{viewport:{width:1280,height:720}}));
 results.push(await run('iphone',{...devices['iPhone 13'],browserName:undefined}));
 if(results.some(r=>r.status!=='passed'))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
