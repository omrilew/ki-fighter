const {chromium,devices}=require('playwright');const path=require('node:path');const assert=require('node:assert/strict');(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});let failures=0;for(const [name,opts] of [['desktop',{viewport:{width:1280,height:720}}],['iphone',{...devices['iPhone 13'],browserName:undefined}]]){const ctx=await browser.newContext(opts);const page=await ctx.newPage();const errors=[];await page.addInitScript(()=>{window.__spriteDraws={};const original=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(image,...args){const src=image?.src||'';if(src.includes('/assets/')){const key=src.split('/').pop().split('?')[0];window.__spriteDraws[key]=(window.__spriteDraws[key]||0)+1;}return original.call(this,image,...args);};});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});await page.goto('http://127.0.0.1:8765/');await page.waitForTimeout(1000);console.log(name,'initial',await page.locator('#kfregion').textContent(),'title buttons',await page.locator('button:visible').allTextContents());await page.screenshot({path:'/tmp/'+name+'-title.png'});const buttons=await page.locator('button:visible').allTextContents();const start=page.getByRole('button',{name:/New Game/i}).first();if(await start.count())await start.click();else console.log('No new game button');await page.waitForTimeout(400);console.log(name,'game',await page.locator('#kfregion').textContent(),'errors',errors);
// Exercise the actual beam input in Chromium, not only the source formula.
if(name==='desktop'){
  await page.keyboard.down('KeyB');
  await page.waitForTimeout(1100);
  await page.screenshot({path:'/tmp/desktop-fullscreen-kamehameha.png'});
  const beamDraws=await page.evaluate(()=>window.__spriteDraws['beam-plasma.webp']||0);
  assert(beamDraws>0,'Holding Kamehameha must draw its animated plasma atlas');
  await page.keyboard.up('KeyB');
  await page.waitForTimeout(200);
}

// Regression: the Kamehameha must cover the entire visible playfield, not a short 54-unit burst.
// Verify the actual script used by the browser rather than a duplicated test constant.
const animationSource=await page.locator('#kfg script').allTextContents();
const gameSource=animationSource.join('\n');
const beamMatch=gameSource.match(/const beam=\{start:[^}]*body:Math\.ceil\(Math\.hypot\(W,H\)\*([\d.]+)\),tip:(\d+)/);
assert(beamMatch,'Charged beam must derive its reach from the viewport dimensions');
const beamReach=Math.ceil(Math.hypot(240,160)*Number(beamMatch[1]))+Number(beamMatch[2]);
assert(beamReach>Math.hypot(240,160),'Charged beam must extend beyond the farthest viewport corner');
const stateStart=gameSource.indexOf('function fighterAnimationState(o)');
const stateEnd=gameSource.indexOf('function detailedSsjIdle(',stateStart);
const stateSource=gameSource.slice(stateStart,stateEnd);
assert(stateStart>=0&&stateSource.indexOf("return 'transform'")<stateSource.indexOf("return 'walk'"),
  'SSJ transformation must take precedence over walking');
assert(stateSource.indexOf("return 'transform'")<stateSource.indexOf("return 'ki'"),
  'SSJ cinematic must not be overridden by beam poses');
assert(gameSource.includes("return pose(1,frameInClip(gait,6),side)"),
  'Horizontal walking must cycle through six directional atlas frames');
assert(gameSource.includes("return pose(directionRow,1+frameInClip(gait,5),1)"),
  'Front and rear walking must animate through five moving frames');
assert(gameSource.includes("assets/ssj-movement-4x4.png"),
  'SSJ movement must load the newly extracted movement atlas');
assert(gameSource.includes("if(drawSsjMovement(o,referencePose))"),
  'SSJ movement must render as a single character layer');
assert(gameSource.includes("assets/dojo-architecture-4x2.png"),
  'Dojo building must load the high-detail architectural atlas');
assert(gameSource.includes("if(atlasReady(dojoArchitecture))"),
  'Dojo must render the new modular facade when its atlas is ready');
assert(gameSource.includes("case 14:return [4,pose.frame]")&&
  gameSource.includes("case 17:return [5,pose.frame]"),
  'Front and rear directions must use separate sprite atlas rows');
assert(gameSource.includes("case 1:return [0,frameInClip((o.gait/(Math.PI*2))%1,6)]"),
  'Lateral walking must retain six matching-action frames');
const art=await page.evaluate(async()=>{const paths=['assets/ssj-aura-atlas.svg','assets/hyper-charge-shockwave.svg','assets/dojo-hall.svg','assets/dojo-courtyard.svg','assets/dojo-master-0.svg','assets/dojo-master-1.svg','assets/dojo-master-2.svg','assets/dojo-master-3.svg'];return Promise.all(paths.map(async p=>{const i=new Image();i.src=p;try{await i.decode();return {p,ok:i.naturalWidth>0}}catch{return {p,ok:false}}}))});console.log('dojo assets',art);assert(art.every(x=>x.ok),'One or more dojo art assets failed to load');if(name==='iphone'){const overlaps=await page.locator('#kfg .top button:visible').evaluateAll(els=>{const r=els.map(e=>({name:e.textContent,box:e.getBoundingClientRect()}));return r.flatMap((a,i)=>r.slice(i+1).filter(b=>Math.min(a.box.right,b.box.right)-Math.max(a.box.left,b.box.left)>2&&Math.min(a.box.bottom,b.box.bottom)-Math.max(a.box.top,b.box.top)>2).map(b=>a.name+' / '+b.name))});console.log('mobile top button overlaps',overlaps);assert.deepEqual(overlaps,[],'Top buttons overlap on mobile');const switchOverlap=await page.locator('#kfparty-switch').evaluate(el=>{const a=el.getBoundingClientRect();return [...document.querySelectorAll('#kfg .top button')].filter(e=>e.getClientRects().length).some(e=>{const b=e.getBoundingClientRect();return Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2})});assert(!switchOverlap,'Fighter switch overlaps top buttons')}const spriteAudit=await page.evaluate(async()=>{const required=['assets/hero-approved.webp','assets/ssj-detailed-atlas.png','assets/ssj-transformation-12.png','assets/matching-actions.webp'];const loaded=await Promise.all(required.map(async src=>{const img=new Image();img.src=src;try{await img.decode();return {src,ok:img.naturalWidth>0}}catch{return {src,ok:false}}}));return {loaded,draws:window.__spriteDraws||{}}});console.log(name,'sprite audit',spriteAudit);assert(spriteAudit.loaded.every(x=>x.ok),'Critical fighter/animation sprite atlas failed to decode');assert((spriteAudit.draws['hero-approved.webp']||0)+(spriteAudit.draws['matching-actions.webp']||0)>0,'No fighter sprite draw calls after starting game');const oldIdleDraws=await page.evaluate(()=>(window.__spriteDraws['hero-approved.webp']||0)+(window.__spriteDraws['matching-actions.webp']||0));
assert(oldIdleDraws>0,'Approved directional fighter atlas not rendered in normal idle');
await page.screenshot({path:'/tmp/'+name+'-game.png'});if(name==='desktop'){
assert(await page.locator('#kfhyper-meter').count(),'Missing yellow hyper gauge');
const scaling=await page.evaluate(()=>{const source=[...document.scripts].map(x=>x.textContent).join('');const fn=source.match(/function maxResourceAtLevel\(level\)\{([^}]+)\}/);if(!fn)return null;const compute=new Function('level',fn[1]);return [1,2,3,5].map(compute)});assert.deepEqual(scaling,[100,125,156,244],'Compounded 25% HP/Ki progression is incorrect');
await page.keyboard.down('KeyR');
await page.waitForTimeout(900);
await page.screenshot({path:'/tmp/desktop-ssj-charge.png'});
await page.waitForTimeout(5100);
await page.keyboard.up('KeyR');
const kiText=await page.locator('#kfki').textContent();
console.log('hyper charge result',kiText);
assert.match(kiText,/SSJ/,'Holding Charge at full Ki should transform fighter');
assert(await page.locator('#kfg').evaluate(el=>el.classList.contains('super-saiyan')),'Super Saiyan HUD state missing');
await page.waitForTimeout(100);
const ssjDraws=await page.evaluate(()=>window.__spriteDraws['ssj-transformation-12.png']||0);
console.log('12-frame SSJ render count',ssjDraws);
assert(ssjDraws>0,'12-frame atlas was not drawn during Super Saiyan transformation');
const oldBeforeMove=await page.evaluate(()=>(window.__spriteDraws['hero-approved.webp']||0)+(window.__spriteDraws['matching-actions.webp']||0));
await page.keyboard.down('KeyD');await page.waitForTimeout(350);await page.keyboard.up('KeyD');
const oldAfterMove=await page.evaluate(()=>(window.__spriteDraws['hero-approved.webp']||0)+(window.__spriteDraws['matching-actions.webp']||0));
assert(oldAfterMove>oldBeforeMove,'Directional movement sprites did not resume during SSJ');
await page.screenshot({path:'/tmp/desktop-super-saiyan.png'});
}
if(name==='desktop'){
await page.getByRole('button',{name:'Menu',exact:true}).click();
await page.locator('[data-menu="map"]').click();
assert(await page.locator('.map-destination-note').isVisible(),'Continuous-world dojo guidance missing');
assert.equal(await page.locator('#kfmap-travel-dojo').count(),0,'Teleport button must be removed');
await page.screenshot({path:'/tmp/desktop-world-map.png'});
await page.getByRole('button',{name:'Resume',exact:true}).click();
await page.keyboard.down('KeyD');await page.waitForTimeout(10000);await page.keyboard.up('KeyD');
await page.waitForTimeout(300);
console.log('walking east',await page.locator('#kfregion').textContent());
assert.equal(await page.locator('#kfdojo-shortcut').count(),0,'Dojo shortcut must be removed');
assert.equal(await page.locator('#kfdojo-travel').count(),0,'Dojo teleport must be removed');
await page.screenshot({path:'/tmp/desktop-east.png'});
}else{const stick=page.locator('.stick');const box=await stick.boundingBox();if(box){const x=box.x+box.width/2,y=box.y+box.height/2;await page.touchscreen.tap(x,y);await page.waitForTimeout(200);console.log('joystick after tap',await stick.getAttribute('class'));assert(!(await stick.getAttribute('class')).includes('active'),'Joystick stuck after touch tap');await stick.evaluate(el=>{const r=el.getBoundingClientRect();el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:71,pointerType:'touch',button:0,clientX:r.x+r.width/2,clientY:r.y+r.height/2}));});assert((await stick.getAttribute('class')).includes('active'),'Joystick did not activate');await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:71,pointerType:'touch'})));assert(!(await stick.getAttribute('class')).includes('active'),'Joystick did not release after global pointerup');await page.locator('#kfpause').click();await page.waitForTimeout(200);assert(await page.locator('#kfmenu').isVisible(),'Pause menu missing');await page.screenshot({path:'/tmp/iphone-menu.png'});} }console.log(name,'errors',errors);if(errors.length)failures++;await ctx.close();}await browser.close();if(failures)process.exitCode=1})().catch(e=>{console.error(e);process.exitCode=1});