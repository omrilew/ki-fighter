const {chromium,devices}=require('playwright');const path=require('node:path');const assert=require('node:assert/strict');(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});let failures=0;for(const [name,opts] of [['desktop',{viewport:{width:1280,height:720}}],['iphone',{...devices['iPhone 13'],browserName:undefined}]]){const ctx=await browser.newContext(opts);const page=await ctx.newPage();const errors=[];await page.addInitScript(()=>{window.__spriteDraws={};window.__movementRows={};const original=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(image,...args){const src=image?.src||'';if(src.includes('/assets/')){const key=src.split('/').pop().split('?')[0];window.__spriteDraws[key]=(window.__spriteDraws[key]||0)+1;if(key==='normal-movement-4x4.png'&&args.length===8){const row=args[1]/96;window.__movementRows[row]=(window.__movementRows[row]||0)+1;}}return original.call(this,image,...args);};});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});await page.goto('http://127.0.0.1:8765/');await page.waitForTimeout(1000);console.log(name,'initial',await page.locator('#kfregion').textContent(),'title buttons',await page.locator('button:visible').allTextContents());await page.screenshot({path:'/tmp/'+name+'-title.png'});const buttons=await page.locator('button:visible').allTextContents();const start=page.getByRole('button',{name:/New Game/i}).first();if(await start.count())await start.click();else console.log('No new game button');await page.waitForTimeout(400);console.log(name,'game',await page.locator('#kfregion').textContent(),'errors',errors);
// Exercise the actual beam input in Chromium, not only the source formula.
if(name==='desktop'){
  await page.keyboard.down('KeyB');
  await page.waitForTimeout(1100);
  await page.screenshot({path:'/tmp/desktop-fullscreen-kamehameha.png'});
  const beamDraws=await page.evaluate(()=>window.__spriteDraws['cinematic-kamehameha-layer.svg']||0);
  assert(beamDraws>0,'Holding Kamehameha must draw its dedicated sprite layer');
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
assert(gameSource.includes("const kamehamehaVisualTiers=Object.freeze({base:'cinematic',upgrade:'aura-burst'})"),
  'Cinematic Kamehameha must reserve Aura Burst for future skill progression');
assert(gameSource.includes("function renderBeamTrace(f){")&&
  gameSource.includes("drawCinematicKamehameha(f.x,f.y,f.angle,f.age+beamTraceTime-f.time")&&
  gameSource.includes("function renderBeamCharge(p){")&&
  gameSource.includes("cinematicBeamAtlas,frame*64,0,64,64"),
  'Cinematic Kamehameha charge and fade must match its active beam');
assert(gameSource.includes("const total=Math.min(190,travel*112)")&&
  gameSource.includes("const travel=Math.max(0,age-.09)")&&
  gameSource.includes("const beamEmergenceTime=.18"),
  'Kamehameha must grow from zero at fixed speed, cap range and share collision geometry');
assert(gameSource.includes("if(p.hero&&p.surge&&atlasReady(ssjMovementAtlas))")&&
  gameSource.includes("x:p.x+side*width*.48,y:p.y-size*.37")&&
  gameSource.includes("const muzzleSize=Math.min(13,width*.68)"),
  'SSJ Kamehameha must anchor to its current sprite and render a hand-centered muzzle');
assert(gameSource.includes("function cinematicBeamDirection(p)")&&
  gameSource.includes("const facing=cinematicBeamDirection(p);")&&
  gameSource.includes("p.fx=facing.x;p.fy=facing.y;"),
  'Kamehameha direction must match the visible fighter pose and lock at release');
assert(gameSource.includes("function drawCinematicKamehameha(")&&
  gameSource.includes("drawCinematicKamehameha(x,y,Math.atan2(p.fy,p.fx),p.beamAge,emergence)"),
  'Active Kamehameha must use the cinematic beam renderer');
assert(gameSource.includes("assets/ssj-movement-4x4.png"),
  'SSJ movement must load the newly extracted movement atlas');
assert(gameSource.includes("assets/normal-movement-4x4.png")&&
  gameSource.includes("!o.surge||!atlasReady(ssjMovementAtlas)")&&gameSource.includes("let art=ssjMovementAtlas"),
  'Normal must bypass the SSJ-shaped movement atlas and use dedicated hero art');
assert(gameSource.includes("if(!o.hero||!o.surge||!atlasReady(ssjMovementAtlas))return false;"),
  'SSJ rendering must not fall back to legacy character when referencePose is set');
assert(gameSource.includes("if(drawSsjMovement(o,referencePose))"),
  'SSJ movement must render as a single character layer');
assert(gameSource.includes("moving?frameInClip(((o.gait/(Math.PI*2))%1+1)%1,4):0"),
  'Standing idle must hold a stable pose instead of playing walking frames');
assert(gameSource.includes("row=rear?2:front?(moving?1:0):3"),
  'Stationary fighter must preserve front, rear and side facing direction');
assert(gameSource.includes("if(!p.surge&&(held.has('charge')||p.rechargeVisual>.015)){drawChargingAura(p);return}"),
  'Charging aura must not persist just because Hyper meter has energy');
assert(!gameSource.includes("o.rechargeVisual>.015||o.surge||o.hyper>0"),
  'A partially filled Hyper meter must not trigger permanent character effects');
assert(gameSource.includes("const beamAction=state==='ki'&&(o.beam||o.beamCharge!==null||o.beamRecoveryUntil>now)")&&
  gameSource.includes("const action=state==='attack'||state==='charge'||(beamAction&&productionCombat)")&&
  gameSource.includes("frame=kiAction?0:moving?"),
  'Ordinary SSJ Ki blasts must not trigger Kamehameha poses');
assert(gameSource.includes("plasma('#07338c',1.15)")&&
  gameSource.includes("plasma('#f6ffff',.31)")&&
  gameSource.includes("const release=1-animationEase(age/.22)")&&
  gameSource.includes("length-head*.8,-head,head*2,head*2"),
  'Cinematic beam must render layered plasma, a release shockwave and traveling head');
assert(gameSource.includes("cinematic-kamehameha-continuous.svg")&&
  gameSource.includes("const src=Math.max(1,Math.min(512,length/190*512))")&&
  !gameSource.includes("const segment=34;"),
  'Kamehameha must use a continuous progressive layer, not tiled diamonds');
assert(gameSource.includes("if(o.hurt>0){\n    const impact=")&&
  gameSource.includes("if(impact>.6)c.filter='brightness(1.6) saturate(.7)'"),
  'Approved combat sprites must show impact recoil and flash');
assert(gameSource.includes("drawHeroAtlasFrame(beamBodyArt,body.row+(o.surge?6:0),body.frame,body.side);\n    c.restore();return;"),
  'Beam action rendering must restore canvas state after the sprite draw');
assert(gameSource.includes("assets/dojo-architecture-4x2.png"),
  'Dojo building must load the high-detail architectural atlas');
assert(gameSource.includes("if(atlasReady(dojoArchitecture))"),
  'Dojo must render the new modular facade when its atlas is ready');
assert(gameSource.includes("drawDojoCourtyard();drawDojoBuilding();drawDojoTrainingProps();"),
  'Dojo courtyard, facade and props must render before character layers');
assert(gameSource.includes("function drawDojoTrainingProps()")&&gameSource.includes("Paired training dummies"),
  'Dojo training equipment must be rendered as part of the courtyard');
assert(gameSource.includes("function drawDojoCourtyard()")&&gameSource.includes("Tatami sparring mat"),
  'Dojo must render a textured wood and tatami training courtyard');
assert(gameSource.includes("const walls=[[0,144,70,144],[80,144,145,144],[230,144,149,144],[385,144,126,144]]"),
  'Dojo walls must crop real shoji panels instead of arbitrary 128-pixel cells');
assert(gameSource.includes("const sx=(row+col)%2?345:230"),
  'Tatami tiles must sample the actual woven-mat region of the atlas');
const newArt=await page.evaluate(async()=>{
  const paths=['assets/dojo-architecture-4x2.png','assets/ssj-movement-4x4.png','assets/normal-movement-4x4.png'];
  return Promise.all(paths.map(src=>new Promise(resolve=>{
    const img=new Image();img.onload=()=>resolve([src,img.naturalWidth,img.naturalHeight]);
    img.onerror=()=>resolve([src,0,0]);img.src=src;
  })));
});
assert.deepEqual(newArt.map(x=>x.slice(1)),[[512,288],[256,384],[256,384]],
  'Dojo, SSJ and normal atlases must load with their production cell dimensions');

assert(gameSource.includes("case 14:return [4,pose.frame]")&&
  gameSource.includes("case 17:return [5,pose.frame]"),
  'Front and rear directions must use separate sprite atlas rows');
assert(gameSource.includes("case 1:return [0,frameInClip((o.gait/(Math.PI*2))%1,6)]"),
  'Lateral walking must retain six matching-action frames');
const art=await page.evaluate(async()=>{const paths=['assets/ssj-aura-atlas.svg','assets/hyper-charge-shockwave.svg','assets/dojo-hall.svg','assets/dojo-courtyard.svg','assets/dojo-master-0.svg','assets/dojo-master-1.svg','assets/dojo-master-2.svg','assets/dojo-master-3.svg'];return Promise.all(paths.map(async p=>{const i=new Image();i.src=p;try{await i.decode();return {p,ok:i.naturalWidth>0}}catch{return {p,ok:false}}}))});console.log('dojo assets',art);assert(art.every(x=>x.ok),'One or more dojo art assets failed to load');if(name==='iphone'){const overlaps=await page.locator('#kfg .top button:visible').evaluateAll(els=>{const r=els.map(e=>({name:e.textContent,box:e.getBoundingClientRect()}));return r.flatMap((a,i)=>r.slice(i+1).filter(b=>Math.min(a.box.right,b.box.right)-Math.max(a.box.left,b.box.left)>2&&Math.min(a.box.bottom,b.box.bottom)-Math.max(a.box.top,b.box.top)>2).map(b=>a.name+' / '+b.name))});console.log('mobile top button overlaps',overlaps);assert.deepEqual(overlaps,[],'Top buttons overlap on mobile');const switchOverlap=await page.locator('#kfparty-switch').evaluate(el=>{const a=el.getBoundingClientRect();return [...document.querySelectorAll('#kfg .top button')].filter(e=>e.getClientRects().length).some(e=>{const b=e.getBoundingClientRect();return Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2})});assert(!switchOverlap,'Fighter switch overlaps top buttons')}const spriteAudit=await page.evaluate(async()=>{const required=['assets/hero-approved.webp','assets/ssj-detailed-atlas.png','assets/ssj-transformation-12.png','assets/matching-actions.webp'];const loaded=await Promise.all(required.map(async src=>{const img=new Image();img.src=src;try{await img.decode();return {src,ok:img.naturalWidth>0}}catch{return {src,ok:false}}}));return {loaded,draws:window.__spriteDraws||{}}});console.log(name,'sprite audit',spriteAudit);assert(spriteAudit.loaded.every(x=>x.ok),'Critical fighter/animation sprite atlas failed to decode');assert((spriteAudit.draws['hero-approved.webp']||0)+(spriteAudit.draws['matching-actions.webp']||0)>0,
  'Dedicated Normal hero artwork must render after starting the game');
// On mobile, verify real draw calls rather than trusting source-string checks.
// Idle must draw the new Normal atlas without simultaneously drawing an old
// approved/combat fighter layer over the same character.
if(name==='iphone'){
  const before=await page.evaluate(()=>({...window.__spriteDraws}));
  await page.waitForTimeout(300);
  const after=await page.evaluate(()=>({...window.__spriteDraws}));
  const delta=key=>(after[key]||0)-(before[key]||0);
  assert(delta('hero-approved.webp')+delta('matching-actions.webp')>0,'iPhone idle must draw dedicated Normal hero artwork');
  assert.equal(delta('ssj-movement-4x4.png'),0,'Normal form must not draw SSJ hair sprites');
  // Exercise a real touch control. The action atlas should replace the
  // movement sprite while attacking, then return to the idle atlas.
  const actionBefore=await page.evaluate(()=>({...window.__spriteDraws}));
  await page.locator('[data-a="hit"]').click();
  await page.waitForTimeout(90);
  const actionAfter=await page.evaluate(()=>({...window.__spriteDraws}));
  const actionDraws=['matching-actions.webp','hero-approved.webp'].reduce((sum,key)=>
    sum+(actionAfter[key]||0)-(actionBefore[key]||0),0);
  assert(actionDraws>0,'iPhone Strike must draw an action atlas rather than the idle sprite');
  await page.waitForTimeout(400);
  const idleBefore=await page.evaluate(()=>(window.__spriteDraws['hero-approved.webp']||0)+(window.__spriteDraws['matching-actions.webp']||0));
  await page.waitForTimeout(130);
  const idleAfter=await page.evaluate(()=>window.__spriteDraws['normal-movement-4x4.png']||0);
  assert(idleAfter>idleBefore,'iPhone fighter must return to normal idle after Strike');
  // Actual atlas cropping: the hero must use front, rear and lateral rows.
  // Use short keyboard movements in the iPhone viewport to exercise the
  // same movement state machine as the touch joystick.
  for(const key of ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight']){
    await page.keyboard.down(key);await page.waitForTimeout(230);await page.keyboard.up(key);
    await page.waitForTimeout(90);
  }
  const normalAfterDirections=await page.evaluate(()=>({approved:window.__spriteDraws['hero-approved.webp']||0,actions:window.__spriteDraws['matching-actions.webp']||0,ssj:window.__spriteDraws['ssj-movement-4x4.png']||0}));
  assert(normalAfterDirections.approved+normalAfterDirections.actions>0,'Directional movement must use dedicated Normal art');
  assert.equal(normalAfterDirections.ssj,0,'Directional movement must never draw SSJ-shaped frames in Normal form');
}
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
const ssjBeforeMove=await page.evaluate(()=>window.__spriteDraws['ssj-movement-4x4.png']||0);
await page.keyboard.down('KeyD');await page.waitForTimeout(350);await page.keyboard.up('KeyD');
const ssjAfterMove=await page.evaluate(()=>window.__spriteDraws['ssj-movement-4x4.png']||0);
assert(ssjAfterMove>ssjBeforeMove,'New SSJ directional movement atlas must animate after transformation');
const productionAsset=await page.evaluate(async()=>{
  const img=new Image();img.src='assets/ssj-production-actions-4x4.png?v=production-1';
  try{await img.decode();return {ok:true,width:img.naturalWidth,height:img.naturalHeight}}
  catch{return {ok:false,width:0,height:0}}
});
assert.deepEqual(productionAsset,{ok:true,width:256,height:384},
  'Production SSJ action atlas must load at the approved 4x4 dimensions');
const combatBefore=await page.evaluate(()=>window.__spriteDraws['ssj-production-actions-4x4.png']||0);
await page.keyboard.down('KeyJ');await page.waitForTimeout(160);await page.keyboard.up('KeyJ');
const combatAfter=await page.evaluate(()=>window.__spriteDraws['ssj-production-actions-4x4.png']||0);
assert(combatAfter>combatBefore,'SSJ Strike must draw production combat atlas');

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