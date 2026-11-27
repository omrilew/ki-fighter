const assert = require('node:assert/strict');
const {chromium, devices} = require('playwright');
const url=process.env.TEST_URL||'http://127.0.0.1:8765/';
const campaignUrl=new URL('campaign.html',url).href;
(async () => {
  const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
  try {
    const page = await browser.newPage({viewport: {width: 920, height: 690}});
    const errors = [], maps = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.npcAtlasDraws = 0;
      const drawImage = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function(image, ...args) {
        if (this.canvas.id === 'world' && image.src?.endsWith('/npc-atlas.png')) window.npcAtlasDraws++;
        return drawImage.call(this, image, ...args);
      };
    });
    page.on('request', request => {
      const map = request.url().match(/\/areas\/([^/]+)\.json$/);
      if (map) maps.push(map[1]);
    });
    const walk = async (key, ms) => {
      await page.keyboard.down(key);
      await page.waitForTimeout(ms);
      await page.keyboard.up(key);
    };
    const activate = async name => {
      await page.waitForFunction(name => [name, `Talk to ${name}`].includes(document.querySelector('#notice').textContent), name);
      await page.keyboard.press('e');
    };
    const close = async speaker => {
      assert.equal(await page.locator('#speaker').textContent(), speaker);
      // Step through the typed lines, then leave the conversation.
      const next = page.locator('#next');
      for (let i = 0; i < 12 && await next.isVisible(); i++) await next.click();
      await page.getByRole('button', {name:'Goodbye'}).click();
    };
    await page.goto(campaignUrl);
    await page.waitForFunction(() => document.querySelector('#area-name').textContent === 'Kame Coast');
    assert.deepEqual(maps, ['kame-coast']);
    await page.waitForFunction(() => window.npcAtlasDraws > 0);
    await page.screenshot({path:'/tmp/ki-campaign-coast.png'});
    await walk('w', 190);
    await activate('Bulma');
    await close('Bulma');
    assert.match(await page.locator('#objective').textContent(), /impact site/);
    await walk('d', 2350);
    await walk('w', 240);
    await activate('Ravine trail');
    await page.waitForFunction(() => document.querySelector('#area-name').textContent === 'Landing Ravine');
    assert.deepEqual(maps, ['kame-coast','landing-ravine']);
    await walk('d', 2320);
    await activate('Impact site');
    await close('Impact site');
    await page.screenshot({path:'/tmp/ki-campaign-ravine.png'});
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#area-name').textContent === 'Landing Ravine');
    assert.match(await page.locator('#objective').textContent(), /Piccolo/);
    await walk('d', 1680);
    await walk('w', 270);
    await page.evaluate(() => {window.npcAtlasDraws = 0});
    await activate('Ridge ascent');
    await page.waitForFunction(() => document.querySelector('#area-name').textContent === 'Standoff Ridge');
    assert.deepEqual(maps, ['kame-coast', 'landing-ravine', 'landing-ravine', 'standoff-ridge']);
    await walk('d', 1740);
    await walk('w', 395);
    await activate('Piccolo');
    await page.waitForFunction(() => window.npcAtlasDraws > 0);
    await close('Piccolo');
    await walk('d', 1500);
    await activate('Raditz');
    await close('Raditz');
    assert.equal(await page.locator('#objective').textContent(), 'Chapter preview complete.');
    await page.screenshot({path:'/tmp/ki-campaign-ridge.png'});
    assert.deepEqual(errors, []);
    const phone = await browser.newPage({...devices['iPhone 13']});
    await phone.goto(campaignUrl);
    await phone.waitForFunction(() => document.querySelector('#area-name').textContent === 'Kame Coast');
    assert.equal(await phone.locator('#stick').isVisible(), true);
    const box = await phone.locator('#stick').boundingBox();
    const cdp = await phone.context().newCDPSession(phone);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+7}]});
    await phone.waitForTimeout(205);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await phone.getByRole('button',{name:'Interact'}).tap();
    assert.equal(await phone.locator('#speaker').textContent(), 'Bulma');
    await phone.getByRole('button',{name:'Goodbye'}).tap();
    await phone.screenshot({path:'/tmp/ki-campaign-mobile.png'});
    console.log('Campaign loads three areas on demand, resumes progress, and accepts touch movement and dialogue.');
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
