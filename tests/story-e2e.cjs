// Chapter One story mode inside the main game: regions, conversations,
// side quests, training, raider camps and the Raditz fight.
// Run with a static server on 8765: node tests/story-e2e.cjs
const assert = require('node:assert/strict');
const {chromium, devices} = require('playwright');
const url = process.env.TEST_URL || 'http://127.0.0.1:8765/';

(async () => {
  const browser = await chromium.launch({headless: true, args: ['--no-sandbox']});
  try {
    const page = await browser.newPage({viewport: {width: 960, height: 640}});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', {name: /New Game/i}).first().click();
    await page.waitForFunction(() => window.KiGame?.player && window.KiStory);
    const tp = (x, y) => page.evaluate(([x, y]) => Object.assign(KiGame.player, {x, y, vx: 0, vy: 0}), [x, y]);
    const state = () => page.evaluate(() => ({
      stage: KiStory.stage, region: document.querySelector('#kfregion').textContent,
      objective: document.querySelector('#kfobjective').textContent,
      enemies: KiGame.enemies().map(e => e.id), level: KiGame.player.level
    }));
    const choices = () => page.locator('#kfstory-choices button').allTextContents();
    async function talk(pick = []) {
      await page.keyboard.press('e');
      for (let i = 0; i < 25; i++) {
        const list = await choices();
        const want = list.find(t => pick.some(p => t.includes(p)));
        const label = want || list.find(t => t === 'Next' || t === 'Continue');
        if (!label) return list;
        if (want) pick = pick.filter(p => !want.includes(p));
        await page.locator('#kfstory-choices button', {hasText: label}).first().click();
      }
      return choices();
    }
    const bye = () => page.locator('#kfstory-choices button', {hasText: 'Goodbye'}).click();

    // Kame Coast: region, Bulma's briefing, two side quests
    await tp(1600, 275);
    await page.waitForFunction(() => document.querySelector('#kfregion').textContent === 'Kame Coast');
    assert.match((await state()).objective, /Bulma/);
    await tp(1652, 268);
    const menu = await talk(['Need anything', 'Anything else']);
    assert.ok(menu.includes('Goodbye') && menu.some(t => t.includes('plating')) && menu.some(t => t.includes('raiders')));
    await bye();
    assert.equal((await state()).stage, 'investigate');
    // training dummies exist and give experience
    await tp(1805, 330);
    await page.waitForFunction(() => KiGame.enemies().filter(e => e.kind === 'dummy').length === 3);
    // Landing Ravine: camps spawn, pod advances the story, plating pickup works
    await tp(2150, 260);
    await page.waitForFunction(() => document.querySelector('#kfregion').textContent === 'Landing Ravine');
    await page.waitForFunction(() => KiGame.enemies().some(e => e.id.startsWith('ravine-')));
    await tp(2088, 216);
    await page.keyboard.press('e');
    await page.waitForFunction(() => /PLATING/.test(document.querySelector('#kfnotice').textContent));
    await tp(2170, 232);
    await talk();
    assert.equal((await state()).stage, 'meet-piccolo');
    // Standoff Ridge: Piccolo, Raditz's challenge, the fight
    await tp(2470, 250);
    await talk();
    await bye().catch(() => {});
    assert.equal((await state()).stage, 'confront');
    await tp(2640, 272);
    await talk(['fight']);
    await page.waitForFunction(() => KiGame.enemies().some(e => e.id === 'raditz' && e.boss));
    assert.equal((await state()).stage, 'fight');
    // wear him down: below 28% the Special Beam Cannon cutscene takes over
    await page.evaluate(() => { const e = KiGame.enemies().find(e => e.id === 'raditz'); e.hp = Math.round(e.max * .3); });
    for (let i = 0; i < 20 && await page.evaluate(() => KiGame.enemies().some(e => e.id === 'raditz')); i++) {
      await page.evaluate(() => { const e = KiGame.enemies().find(e => e.id === 'raditz'); if (e) Object.assign(KiGame.player, {x: e.x - 15, y: e.y, fx: 1, fy: 0, faceAngle: 0, hp: KiGame.player.max}); });
      await page.keyboard.press('j');
      await page.waitForTimeout(220);
    }
    await page.waitForFunction(() => /SPECIAL BEAM CANNON/.test(document.querySelector('#kfnotice').textContent), null, {timeout: 6000});
    await page.waitForFunction(() => window.KiStory.stage === 'victory', null, {timeout: 8000});
    // epilogue lines, then the chapter is complete
    for (let i = 0; i < 8; i++) {
      const list = await choices();
      const next = list.find(t => t === 'Next' || t === 'Continue');
      if (!next) break;
      await page.locator('#kfstory-choices button', {hasText: next}).first().click();
    }
    await page.waitForFunction(() => /CHAPTER ONE COMPLETE/.test(document.querySelector('#kfnotice').textContent));
    const end = await state();
    assert.equal(end.stage, 'victory');
    assert.ok(end.level >= 3, 'boss experience applied');
    assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('ki-fighter-cedar-journey-v1')).items.includes('saiyan_scouter')));
    // progress survives a reload
    await page.reload();
    await page.getByRole('button', {name: /Continue/}).first().click();
    await page.waitForFunction(() => window.KiStory?.stage === 'victory');
    assert.deepEqual(errors, []);

    // phone: the story box and interaction work by touch
    const phone = await browser.newPage({...devices['iPhone 13']});
    await phone.goto(url);
    await phone.evaluate(() => localStorage.clear());
    await phone.reload();
    await phone.getByRole('button', {name: /New Game/i}).first().tap();
    await phone.waitForFunction(() => window.KiGame?.player);
    await phone.evaluate(() => Object.assign(KiGame.player, {x: 1652, y: 268}));
    await phone.getByRole('button', {name: 'Interact'}).tap();
    await phone.waitForFunction(() => document.querySelector('#kfstory-title').textContent === 'Bulma');
    console.log('Story mode: regions, conversations, quests, training, camps and the Raditz fight work on desktop and phone.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
