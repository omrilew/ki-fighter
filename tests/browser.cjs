const {chromium,devices}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const url=process.env.TEST_URL||'http://127.0.0.1:8765/';
const artifactDirectory=process.env.TEST_ARTIFACT_DIR||'/tmp';

async function run(browser,name,options){
 const context=await browser.newContext(options);
 try{
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
   window.__draws=[];
   const draw=CanvasRenderingContext2D.prototype.drawImage;
   CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
    const asset=image?.src?.split('/').at(-1)?.split('?')[0];
    if(asset&&this.canvas===document.querySelector('#kfg canvas')){
     const [x,y,w,h]=args;
     window.__draws.push({asset,x,y,w,h,side:Math.sign(this.getTransform().a)});
     if(window.__draws.length>2500)window.__draws.shift();
    }
    return draw.apply(this,[image,...args]);
   };
  });

  const waitForAsset=asset=>page.waitForFunction(asset=>__draws.some(draw=>draw.asset===asset),asset);
  const clearDraws=()=>page.evaluate(()=>__draws.length=0);
  const waitForClip=(form,action,facing,side=1)=>page.waitForFunction(({form,action,facing,side})=>{
   const frames=KiHeroManifest.clips[form][action][facing].frames;
   return frames.some(({rect:[x,y]})=>__draws.some(draw=>
    draw.asset==='body-atlas.png'&&draw.x===x&&draw.y===y&&draw.side===side
   ));
  },{form,action,facing,side});

  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/New Game/i}).first().click();
  await waitForClip('normal','idle','down');
  await page.screenshot({path:path.join(artifactDirectory,name+'-game.png')});

  if(name==='desktop'){
   for(const [key,side] of [['KeyD',1],['KeyA',-1]]){
    await clearDraws();
    await page.keyboard.down(key);
    await waitForClip('normal','walk','right',side);
    await page.keyboard.up(key);
   }
   await clearDraws();
   await page.keyboard.down('KeyB');
   await waitForAsset('cinematic-kamehameha-layer.svg');
   await page.keyboard.up('KeyB');
   await clearDraws();
   await page.keyboard.down('KeyR');
   await waitForAsset('transformation-fit.png');
   await page.keyboard.up('KeyR');
   await page.waitForFunction(()=>document.querySelector('#kfki').textContent.includes('SSJ'));
   await page.keyboard.down('KeyD');
   await waitForClip('ssj','walk','right');
   await page.keyboard.up('KeyD');
  }else{
   await page.locator('[data-a=hit]').tap();
   await waitForClip('normal','punch','down');
   const stick=page.locator('.stick');
   const box=await stick.boundingBox();
   assert(box,'Mobile joystick must be visible');
   const point={x:Math.round(box.x+box.width/2),y:Math.round(box.y+box.height/2)};
   const touch=await context.newCDPSession(page);
   await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
   await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,x:point.x+24}]});
   await waitForClip('normal','walk','right');
   await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await page.waitForFunction(()=>!document.querySelector('.stick').classList.contains('active'));
   await page.locator('#kfpause').tap();
   assert(await page.locator('#kfmenu').isVisible(),'Pause menu must open on touch');
   await page.screenshot({path:path.join(artifactDirectory,name+'-menu.png')});
  }
  assert.deepEqual(errors,[]);
  console.log(name,'animation and input checks passed');
 }finally{
  await context.close();
 }
}

(async()=>{
 fs.mkdirSync(artifactDirectory,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  await run(browser,'desktop',{viewport:{width:1280,height:720}});
  await run(browser,'iphone',devices['iPhone 13']);
 }finally{
  await browser.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1});
