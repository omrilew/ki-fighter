(() => {
  'use strict';
  const scriptUrl = document.currentScript.src;
  const canvas = document.querySelector('#world');
  const context = canvas.getContext('2d', {alpha: false});
  const viewWidth = canvas.width, baseViewHeight = canvas.height;
  let viewHeight = baseViewHeight;
  let currentArea = null;  // set on area entry; read by resizeCanvas before `area` exists
  // Rendered at device resolution like the main game (not a 360x216 bitmap
  // stretched with pixelated CSS): sprites keep hard pixels, the painted
  // ground stays detailed.
  let pixelRatio = 1;
  function resizeCanvas() {
    const box = canvas.getBoundingClientRect();
    if (box.width < 10) return;
    pixelRatio = Math.min(4, Math.max(1, Math.round(box.width * (window.devicePixelRatio || 1)) / viewWidth));
    // Like the main game, the view grows taller on tall screens (phones)
    // instead of letterboxing a fixed 5:3 strip.
    const wanted = Math.round(viewWidth * box.height / box.width);
    viewHeight = Math.max(150, Math.min(wanted, currentArea ? currentArea.height : 300, 300));
    const width = Math.round(viewWidth * pixelRatio), height = Math.round(viewHeight * pixelRatio);
    if (canvas.width !== width || canvas.height !== height) [canvas.width, canvas.height] = [width, height];
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  const groundScale = 2.5;  // same painting resolution as the main game's map
  const worldProps = new Image();
  worldProps.src = 'assets/world-props.webp';
  const forestArt = new Image();
  forestArt.src = 'assets/forest-detail.webp';
  const buildingArt = new Image();
  buildingArt.src = 'assets/campaign-buildings.png?v=3';
  // Footprints (world px) of the original campaign buildings sheet; see
  // assets/campaign-buildings.json and scripts/build-campaign-buildings.py.
  const buildings = {
    'dome-home': {frame: 0, w: 78, h: 72, solidW: 66, solidH: 24},
    'dome-hut': {frame: 1, w: 60, h: 58, solidW: 52, solidH: 22},
    'sea-house': {frame: 2, w: 84, h: 80, solidW: 74, solidH: 26},
    'round-tower': {frame: 3, w: 46, h: 82, solidW: 32, solidH: 16},
    cliff: {frame: 4, w: 54, h: 52, solidW: 42, solidH: 20},
    pod: {frame: 5, w: 52, h: 50, solidW: 42, solidH: 16, sink: 8},
    cottage: {sheet: 'world', frame: 0, w: 64, h: 58, solidW: 52, solidH: 22}
  };
  buildings.house = buildings['sea-house'];
  // Main-game forest atlas cells: [sourceX, sourceW, sourceH, worldW, worldH]
  const forestCells = {
    oak: [0, 224, 224, 42, 46], pine: [226, 224, 224, 33, 53], bush: [452, 100, 80, 20, 16],
    rock: [554, 75, 55, 15, 11], grass: [631, 50, 45, 10, 9], reeds: [683, 60, 85, 12, 17],
    flowers: [745, 50, 40, 10, 8], log: [797, 100, 50, 20, 10]
  };
  const interactButton = document.querySelector('#interact');
  const retryButton = document.querySelector('#retry');
  const notice = document.querySelector('#notice');
  const objective = document.querySelector('#objective');
  const areaName = document.querySelector('#area-name');
  const dialog = document.querySelector('#dialog');
  const saveKey = 'ki-fighter-campaign-opening-v1';
  const areaIds = new Set(['kame-coast', 'landing-ravine', 'standoff-ridge']);
  const objectives = {
    briefing: 'Speak with Bulma near the path.',
    investigate: 'Follow the trail and inspect the impact site.',
    'meet-piccolo': 'Climb the ridge and find Piccolo.',
    confront: 'Approach the traveler on Standoff Ridge.',
    'encounter-ready': 'Chapter preview complete.'
  };
  const stages = Object.keys(objectives);
  const stageMessages = {'encounter-ready': 'The standoff is set. The fight with Raditz comes in the next update.'};
  const themes = {
    coast: {base: ['#1d3a30', '#4f6a38', '#2a4a3a'], tufts: ['#8ea25370', '#183d3e80', '#b5a76b38'],
      blades: ['#b9bf7855', '#142f2d4d'], specks: ['#c2ad7935', '#17382e4b', '#80905132'],
      trail: ['#22332b', '#5b5140', '#806951', '#a48c69'], decor: ['grass', 'flowers', 'bush', 'grass', 'reeds']},
    ravine: {base: ['#3a2d24', '#7a5d40', '#4a372b'], tufts: ['#b08a5a60', '#2a1d1870', '#d4b07a30'],
      blades: ['#c8a27045', '#2b1e184d'], specks: ['#e0c08a35', '#2a1c144b', '#9a7a5232'],
      trail: ['#2e231c', '#5e4a38', '#86694c', '#a98a66'], decor: ['rock', 'grass', 'log', 'rock']},
    ridge: {base: ['#24302a', '#5c6644', '#323d33'], tufts: ['#9aa06a60', '#1f2c2a80', '#c2b88a30'],
      blades: ['#c0c08055', '#1c2b264d'], specks: ['#d6c89a35', '#1d2d264b', '#8c945c32'],
      trail: ['#26302a', '#5a5444', '#7f7058', '#a0906e'], decor: ['grass', 'rock', 'bush', 'pine']}
  };
  const naturalSizes = {palm: [30, 46, 8], tree: [30, 46, 8], pine: [24, 53, 8], rock: [28, 18, 10],
    cliff: [40, 42, 22], pod: [45, 42, 15]};
  function propFootprint(kind) {
    const building = buildings[kind];
    if (building) return [building.solidW, building.h, building.solidH];
    return naturalSizes[kind] || [20, 20, 8];
  }
  const heroScale = .48 * 1.10;
  const heroHeightRatio = 1.05;
  const heroArt = new Image();
  const castArt = new Map();
  heroArt.src = 'assets/hero-animation/body-atlas.png';
  const held = new Set();
  const keyDirection = {ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down'};
  const touch = {id: null, x: 0, y: 0};
  const player = {x: 0, y: 0, facing: 'down', gait: 0, moving: false};
  let area = null, loading = false, pending = null, currentStage = 'briefing';
  // Conversation and side-quest state (saved with the story stage).
  const story = {seen: new Set(), quests: {}, collected: new Set()};
  const storyState = () => ({stage: currentStage, quests: story.quests});
  const Talk = window.KFDialogue;
  const audio = window.KiAudio || {music() {}, sfx() {}, setEnabled() {}, enabled: false, onChange() {}};
  // Short-lived messages (quest updates, welcome back) win over the
  // "what is near me" prompt until they expire.
  let toastText = '', toastUntil = 0;
  function toast(text, ms = 2600) {
    toastText = text;
    toastUntil = performance.now() + ms;
    notice.textContent = text;
    notice.dataset.hint = '';
  }
  const touchUi = matchMedia('(pointer: coarse)').matches;
  // Which area holds the current story goal, and the order of areas.
  const route = ['kame-coast', 'landing-ravine', 'standoff-ridge'];
  const goalArea = {briefing: 'kame-coast', investigate: 'landing-ravine', 'meet-piccolo': 'standoff-ridge',
    confront: 'standoff-ridge', 'encounter-ready': null};
  let nearby = null, lastTime = 0;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const loader = KFAreaLoader.createAreaLoader({
    maxCached: 2,
    async load(id) {
        if (!areaIds.has(id)) throw new Error('Unknown campaign area');
      const url = new URL(`areas/${id}.json`, scriptUrl);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Could not load ${id} (${response.status})`);
      const data = await response.json();
      if (data.id !== id || !themes[data.theme] || !Number.isInteger(data.width) || !Number.isInteger(data.height)
        || data.width < viewWidth || data.height < baseViewHeight || data.width > 1000 || data.height > 1000) {
        throw new Error('Invalid campaign area');
      }
      const ground = document.createElement('canvas');
      [ground.width, ground.height] = [Math.round(data.width * groundScale), Math.round(data.height * groundScale)];
      paintGround(ground.getContext('2d'), data);
      const sprites = data.points.flatMap(point => {
        const sprite = point.actor && window.KFCampaignCast?.getSprite(point.actor);
        if (!sprite || castArt.has(sprite.src)) return [];
        const image = new Image();
        castArt.set(sprite.src, image);
        image.src = sprite.src;
        return [image.decode().catch(() => castArt.delete(sprite.src))];
      });
      await Promise.all(sprites);
      const objects = [...data.props, ...data.points, ...scatterDecor(data)].sort((a, b) => a.y - b.y);
      return {...data, ground, objects};
    }
  });

  function paintGround(ink, data) {
    // Same painted technique as the main game's map: broad tinted patches,
    // thin grass blades, specks and layered round-capped trails, painted at
    // 2.5x and drawn smoothed under hard-pixel sprites.
    const {width, height, paths, theme} = data;
    const palette = themes[theme];
    let seed = [...data.id].reduce((acc, char) => acc * 31 + char.charCodeAt(0), 1) >>> 0;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const between = (a, b) => a + (b - a) * random();
    ink.save();
    ink.scale(groundScale, groundScale);
    const base = ink.createLinearGradient(0, 0, width, height);
    base.addColorStop(0, palette.base[0]);
    base.addColorStop(.5, palette.base[1]);
    base.addColorStop(1, palette.base[2]);
    ink.fillStyle = base;
    ink.fillRect(0, 0, width, height);
    const area = width * height / 400;
    for (let i = 0; i < area * .22; i++) {
      const x = between(0, width), y = between(0, height), r = between(12, 70);
      const tuft = ink.createRadialGradient(x, y, 0, x, y, r);
      tuft.addColorStop(0, palette.tufts[i % 3]);
      tuft.addColorStop(1, palette.tufts[i % 3].slice(0, 7) + '00');
      ink.fillStyle = tuft;
      ink.fillRect(x - r, y - r, r * 2, r * 2);
    }
    if (theme === 'ravine') {
      // Fresh impact crater: scorched rim, darker bowl, glowing scar.
      const crater = ink.createRadialGradient(304, 145, 4, 304, 145, 52);
      crater.addColorStop(0, '#2a1d18');
      crater.addColorStop(.55, '#4a3427');
      crater.addColorStop(.8, '#8d6a48');
      crater.addColorStop(1, '#8d6a4800');
      ink.fillStyle = crater;
      ink.beginPath(); ink.ellipse(304, 145, 56, 30, 0, 0, Math.PI * 2); ink.fill();
      ink.strokeStyle = '#c69a6488'; ink.lineWidth = 1.2;
      ink.beginPath(); ink.ellipse(304, 143, 44, 21, 0, Math.PI * 1.05, Math.PI * 1.95); ink.stroke();
    }
    for (let i = 0; i < area * 4.5; i++) {
      const x = between(0, width), y = between(0, height), h = between(1, 4);
      ink.strokeStyle = palette.blades[i % 2];
      ink.lineWidth = between(.22, .62);
      ink.beginPath();
      ink.moveTo(x, y);
      ink.quadraticCurveTo(x + .2, y - h * .7, x + between(-1.7, 1.7), y - h);
      ink.stroke();
    }
    for (let i = 0; i < area * 7.5; i++) {
      ink.fillStyle = palette.specks[i % 3];
      ink.fillRect(between(0, width), between(0, height), between(.5, 2), between(.5, 1.45));
    }
    if (theme === 'coast') {
      // Sea, wet sand and foam follow the same shoreline the movement uses.
      ink.beginPath();
      ink.moveTo(0, 0);
      for (let y = 0; y <= height; y += 4) ink.lineTo(shoreEdge(y) + 12, y);
      ink.lineTo(0, height);
      ink.closePath();
      const sand = ink.createLinearGradient(0, 0, 70, 0);
      sand.addColorStop(0, '#d9c08a'); sand.addColorStop(1, '#b49a6a');
      ink.fillStyle = sand; ink.fill();
      ink.beginPath();
      ink.moveTo(0, 0);
      for (let y = 0; y <= height; y += 4) ink.lineTo(shoreEdge(y) - 4, y);
      ink.lineTo(0, height);
      ink.closePath();
      const sea = ink.createLinearGradient(0, 0, 60, 0);
      sea.addColorStop(0, '#173d5c'); sea.addColorStop(.6, '#22607a'); sea.addColorStop(1, '#3f8f95');
      ink.fillStyle = sea; ink.fill();
      for (let i = 0; i < height / 3; i++) {
        const y = between(0, height), x = between(2, shoreEdge(y) - 8);
        ink.fillStyle = i % 3 ? '#7fc0c455' : '#e8f6f070';
        ink.fillRect(x, y, between(3, 10), .7);
      }
      ink.strokeStyle = '#eef8f0b0'; ink.lineWidth = 1.1;
      ink.beginPath();
      for (let y = 0; y <= height; y += 3) {
        const x = shoreEdge(y) - 4 + Math.sin(y / 5) * .8;
        y ? ink.lineTo(x, y) : ink.moveTo(x, y);
      }
      ink.stroke();
    }
    ink.lineCap = 'round';
    ink.lineJoin = 'round';
    for (const [i, color] of palette.trail.entries()) {
      ink.strokeStyle = color;
      ink.lineWidth = [34, 30, 24, 18][i] * .78;
      for (const path of paths) {
        ink.beginPath();
        path.forEach(([x, y], j) => j ? ink.lineTo(x, y) : ink.moveTo(x, y));
        ink.stroke();
      }
    }
    for (const path of paths) {
      for (let i = 1; i < path.length; i++) {
        const [ax, ay] = path[i - 1], [bx, by] = path[i];
        const count = Math.floor(Math.hypot(ax - bx, ay - by) * 1.4);
        for (let j = 0; j < count; j++) {
          const t = j / count;
          ink.fillStyle = j % 4 ? '#705c434f' : '#efe0b87d';
          ink.beginPath();
          ink.ellipse(ax + (bx - ax) * t + between(-6, 6), ay + (by - ay) * t + between(-6, 6),
            between(.4, 1.3), between(.3, .8), 0, 0, Math.PI * 2);
          ink.fill();
        }
      }
    }
    ink.restore();
  }

  // Small ground decor from the main game's forest atlas, kept off trails,
  // shoreline, props and story points; drawn with the props (y-sorted).
  function scatterDecor(data) {
    let seed = [...data.id].reduce((acc, char) => acc * 17 + char.charCodeAt(0), 7) >>> 0;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const nearPath = (x, y) => data.paths.some(path => path.some(([ax, ay], i) => {
      if (!i) return false;
      const [bx, by] = path[i - 1];
      const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
      return Math.hypot(x - ax - (bx - ax) * t, y - ay - (by - ay) * t) < 22;
    }));
    const decor = [];
    const theme = data.theme;
    const blocked = (x, y, room) => nearPath(x, y) || (theme === 'coast' && x < shoreEdge(y) + 20)
      || [...data.props, ...data.points].some(o => {
        const b = buildings[o.kind], wide = b ? b.w * .7 : 0;
        // buildings: keep their whole front and sides clear
        if (b && Math.abs(o.x - x) < wide + 14 && y > o.y - b.h && y < o.y + 30) return true;
        return Math.hypot(o.x - x, (o.y - y) * 1.5) < room;
      })
      || Math.hypot(data.spawn[0] - x, data.spawn[1] - y) < 30
      || decor.some(d => d.solid && Math.hypot(d.x - x, (d.y - y) * 1.4) < 26);
    // Trees and rock clusters: a few large anchors, then clumps around them.
    const anchorKinds = {coast: ['oak', 'oak', 'rock', 'oak'], ravine: ['rock', 'rock', 'oak', 'rock'],
      ridge: ['pine', 'pine', 'oak', 'rock', 'pine']}[theme];
    const anchors = Math.round(data.width * data.height / 9000);
    for (let i = 0, tries = 0; i < anchors && tries < 400; tries++) {
      const x = 14 + random() * (data.width - 28), y = 30 + random() * (data.height - 40);
      if (blocked(x, y, 40)) continue;
      const kind = anchorKinds[i % anchorKinds.length];
      if (kind === 'rock') decor.push({rock: true, solid: true, x, y, scale: .8 + random() * .45, layout: i % 5});
      else decor.push({decor: kind, solid: true, x, y, scale: .9 + random() * .35});
      // a second tree often grows beside the first
      if (kind !== 'rock' && random() < .55) {
        const x2 = x + (random() < .5 ? -1 : 1) * (16 + random() * 10), y2 = y + 6 + random() * 10;
        if (!blocked(x2, y2, 36)) decor.push({decor: kind, solid: true, x: x2, y: y2, scale: .8 + random() * .3});
      }
      i++;
    }
    // Small plants grow in clumps at the feet of trees and rocks and in a few
    // open patches, not evenly sprinkled.
    const small = {coast: ['grass', 'flowers', 'bush', 'grass'], ravine: ['grass', 'log', 'grass'],
      ridge: ['grass', 'bush', 'flowers', 'grass']}[theme];
    const seeds = decor.filter(d => d.solid).map(d => [d.x, d.y + 4]);
    for (let i = 0; i < anchors * .6; i++) seeds.push([14 + random() * (data.width - 28), 30 + random() * (data.height - 40)]);
    for (const [sx, sy] of seeds) {
      const count = 2 + Math.floor(random() * 3);
      for (let j = 0; j < count; j++) {
        const x = sx + (random() - .5) * 30, y = sy + (random() - .2) * 12;
        if (nearPath(x, y) || (theme === 'coast' && x < shoreEdge(y) + 18)) continue;
        if ([...data.props, ...data.points].some(o => Math.hypot(o.x - x, (o.y - y) * 1.6) < 30)) continue;
        if (Math.hypot(data.spawn[0] - x, data.spawn[1] - y) < 22) continue;
        decor.push({decor: small[(j + Math.floor(random() * 4)) % small.length], x, y, scale: .75 + random() * .35});
      }
    }
    return decor;
  }

  function shoreEdge(y) {
    return 52 + Math.floor((Math.sin(y / 36) * 12 + Math.sin(y / 17) * 4) / 2) * 2;
  }

  const ready = image => image.complete && image.naturalWidth > 0;
  function drawShadow(w, depth = .1) {
    context.fillStyle = '#14282155';
    context.beginPath();
    context.ellipse(w * .055, 1, w * .38, Math.max(1.5, w * depth), 0, 0, Math.PI * 2);
    context.fill();
  }
  function drawForest(name, x, y, scale = 1) {
    if (!ready(forestArt)) return;
    const [sx, sw, sh, w, h] = forestCells[name];
    context.save();
    context.translate(x, y);
    context.scale(scale, scale);
    if (w > 18) drawShadow(w);
    context.drawImage(forestArt, sx, 0, sw, sh, -w / 2, -h + 2, w, h);
    context.restore();
  }
  // Natural rocks are built from the main game's own faceted stone sprite:
  // a few stones of different sizes, mirrored and overlapped, so every
  // cluster looks hand placed and matches the rest of the world.
  const rockLayouts = [
    [[-7, 0, 1.5, 0], [6, 1, 1.15, 1], [0, 3, .8, 0]],
    [[-4, 0, 1.7, 1], [9, 2, .9, 0]],
    [[-8, 1, 1.1, 0], [3, -1, 1.55, 1], [11, 3, .7, 0], [-1, 4, .65, 1]],
    [[0, 0, 1.6, 0], [-9, 3, .75, 1]],
    [[-5, 0, 1.3, 1], [7, 0, 1.3, 0], [1, 4, .8, 0]]
  ];
  function drawRockCluster(x, y, scale, layout) {
    if (!ready(forestArt)) return;
    const [sx, sw, sh, w, h] = forestCells.rock;
    context.save();
    context.translate(x, y);
    context.scale(scale, scale);
    drawShadow(30, .12);
    const stones = [...rockLayouts[layout]].sort((a, b) => a[1] - b[1]);
    for (const [ox, oy, k, flip] of stones) {
      context.save();
      context.translate(ox, oy);
      context.scale(flip ? -k : k, k);
      context.drawImage(forestArt, sx, 0, sw, sh, -w / 2, -h + 2, w, h);
      context.restore();
    }
    context.restore();
  }
  function drawProp(prop) {
    const {x, y, kind} = prop;
    const building = kind !== 'cliff' && buildings[kind];
    if (building) {
      const art = building.sheet === 'world' ? worldProps : buildingArt;
      if (!ready(art)) return;
      context.save();
      context.translate(x, y);
      drawShadow(building.w, .09);
      context.drawImage(art, building.frame * 224, 0, 224, 224, -building.w / 2, -building.h * 224 / 200 + 4 + (building.sink || 0),
        building.w, building.h * 224 / 200);
      context.restore();
      return;
    }
    if (kind === 'palm' || kind === 'tree') return drawForest('oak', x, y, prop.scale || 1.05);
    if (kind === 'pine') return drawForest('pine', x, y, prop.scale || 1);
    if (kind === 'rock') return drawRockCluster(x, y, prop.scale || 1, (x * 7 + y * 13) % 5);
    if (kind === 'cliff') return drawRockCluster(x, y, prop.scale || 2.1, 2 + (x + y) % 3);
  }

  function drawSprite(image, frame, x, y, scale, heightRatio = 1) {
    if (!frame || !image?.naturalWidth) return false;
    const [sx, sy, w, h] = frame.rect;
    context.save();
    context.translate(Math.round(x), Math.round(y));
    if (frame.flip) context.scale(-1, 1);
    const heightScale = scale * heightRatio;
    context.drawImage(image, sx, sy, w, h, -frame.feet[0] * scale, -frame.feet[1] * heightScale, w * scale, h * heightScale);
    context.restore();
    return true;
  }

  // Pod plating: a small curved metal shard with a travelling glint.
  function drawPickup(point, time) {
    const glint = (Math.sin(time / 260 + point.x) + 1) / 2;
    context.save();
    context.translate(Math.round(point.x), Math.round(point.y));
    context.fillStyle = '#14282155';
    context.beginPath(); context.ellipse(0, 1, 6, 2, 0, 0, Math.PI * 2); context.fill();
    const shard = [[-5, 0], [-3, -4], [3, -5], [6, -2], [4, 1]];
    context.fillStyle = '#2b2930';
    context.beginPath(); shard.forEach(([x, y], i) => i ? context.lineTo(x, y + 1) : context.moveTo(x - 1, y + 1)); context.closePath(); context.fill();
    context.fillStyle = '#d9d4cc';
    context.beginPath(); shard.forEach(([x, y], i) => i ? context.lineTo(x, y) : context.moveTo(x, y)); context.closePath(); context.fill();
    context.fillStyle = '#9d97a0';
    context.fillRect(-3, -1, 7, 1);
    context.fillStyle = `rgba(255,255,255,${.35 + .65 * glint})`;
    context.fillRect(-1 + Math.round(glint * 3), -4, 2, 1);
    context.fillRect(Math.round(glint * 3), -5, 1, 3);
    context.restore();
  }

  function drawPoint(point, time) {
    const sprite = point.actor && window.KFCampaignCast?.getSprite(point.actor);
    const frame = sprite && window.KFCampaignCast.resolveFrame(sprite, 'down', dialog.open && nearby === point ? 'talk' : 'idle', time);
    const shown = sprite && drawSprite(castArt.get(sprite.src), frame, point.x, point.y, sprite.scale);
    if (point.pickup) {
      if (!isAvailable(point)) return;
      return drawPickup(point, time);
    }
    if (!point.actor && !point.portal && !isAvailable(point) && !point.stage) return;
    const mark = marker(point);
    const active = !!mark;
    const done = !point.actor && point.stage && stages.indexOf(currentStage) > stages.indexOf(point.stage);
    const top = point.y - (shown ? 50 : 16);
    context.save();
    context.textAlign = 'center';
    context.lineJoin = 'round';
    if (shown || point.portal) {
      context.font = 'bold 8px system-ui, sans-serif';
      context.lineWidth = 2.7;
      context.strokeStyle = '#1c271f';
      context.fillStyle = '#ffe5a7';
      context.strokeText(point.name, point.x, top - (active ? 9 : 0));
      context.fillText(point.name, point.x, top - (active ? 9 : 0));
    }
    if (active && !done) {
      const bob = Math.sin(time / 180) * 1.5;
      context.font = mark === '!' ? 'bold 13px system-ui, sans-serif' : 'bold 11px system-ui, sans-serif';
      context.lineWidth = 3;
      context.strokeStyle = '#1c271f';
      context.fillStyle = mark === '!' ? '#ffd36b' : '#cfe3ff';
      context.strokeText(mark, point.x, top + 9 + bob);
      context.fillText(mark, point.x, top + 9 + bob);
    }
    context.restore();
  }

  function drawHero(time) {
    const clips = window.KiHeroManifest.clips.normal[player.moving ? 'walk' : 'idle'];
    const flip = player.facing === 'left';
    const clip = clips[flip ? 'right' : player.facing] || clips.down;
    const frames = clip.frames;
    let idleTime = time % frames.reduce((total, frame) => total + frame.durationMs, 0);
    const frame = player.moving ? frames[Math.floor(player.gait) % frames.length]
      : frames.find(frame => (idleTime -= frame.durationMs) < 0) || frames[0];
    context.fillStyle = '#242d266c';
    context.beginPath();
    context.ellipse(player.x, player.y, 7, 3, 0, 0, Math.PI * 2);
    context.fill();
    drawSprite(heroArt, {...frame, flip}, player.x, player.y, heroScale, heroHeightRatio);
  }

  // Where the player should head next: a story or quest point here, or the
  // trail toward the area that holds the goal.
  function goalTarget() {
    const here = area.points.filter(point => !point.portal && marker(point) === '!');
    if (here.length) return here.sort((a, b) => distance(player, a) - distance(player, b))[0];
    const target = goalArea[currentStage];
    const questHere = area.points.find(point => (point.pickup || point.quest) && isAvailable(point));
    if (questHere) return questHere;
    if (!target || target === area.id) return null;
    const step = route.indexOf(target) > route.indexOf(area.id) ? 1 : -1;
    const toward = route[route.indexOf(area.id) + step];
    return area.points.find(point => point.portal === toward && isAvailable(point)) || null;
  }

  function drawGoalPointer(time, camX, camY) {
    const goal = goalTarget();
    if (!goal || dialog.open) return;
    const sx = goal.x - camX, sy = goal.y - 20 - camY;
    const margin = 14;
    const inside = sx > margin && sx < viewWidth - margin && sy > margin + 26 && sy < viewHeight - margin;
    if (inside) return;   // the bobbing marker above it is enough
    const cx = viewWidth / 2, cy = viewHeight / 2;
    const angle = Math.atan2(sy - cy, sx - cx);
    const reach = Math.min((viewWidth / 2 - margin) / Math.abs(Math.cos(angle) || 1e-6),
      (viewHeight / 2 - margin) / Math.abs(Math.sin(angle) || 1e-6));
    const pulse = 1 + Math.sin(time / 220) * .12;
    context.save();
    context.translate(cx + Math.cos(angle) * reach, cy + Math.sin(angle) * reach);
    context.rotate(angle);
    context.scale(pulse, pulse);
    context.fillStyle = '#0d1b31cc';
    context.strokeStyle = '#d6b475';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(8, 0); context.lineTo(-5, -6); context.lineTo(-2, 0); context.lineTo(-5, 6);
    context.closePath();
    context.fill(); context.stroke();
    context.fillStyle = '#f6d77d';
    context.beginPath();
    context.moveTo(5, 0); context.lineTo(-2, -3); context.lineTo(-1, 0); context.lineTo(-2, 3);
    context.closePath();
    context.fill();
    context.restore();
  }

  function render(time) {
    if (!area) return;
    resizeCanvas();
    const camX = clamp(player.x - viewWidth / 2, 0, area.width - viewWidth);
    const camY = clamp(player.y - viewHeight / 2, 0, area.height - viewHeight);
    // Snap the camera to device pixels so sprite pixels do not shimmer.
    const snapX = Math.round(camX * pixelRatio) / pixelRatio, snapY = Math.round(camY * pixelRatio) / pixelRatio;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.imageSmoothingEnabled = true;
    context.drawImage(area.ground, snapX * groundScale, snapY * groundScale, viewWidth * groundScale, viewHeight * groundScale,
      0, 0, viewWidth, viewHeight);
    context.imageSmoothingEnabled = false;
    context.save();
    context.translate(-snapX, -snapY);
    let heroShown = false;
    for (const object of area.objects) {
      if (object.x < snapX - 60 || object.x > snapX + viewWidth + 60 || object.y < snapY - 10 || object.y > snapY + viewHeight + 90) continue;
      if (!heroShown && object.y > player.y) {
        drawHero(time);
        heroShown = true;
      }
      if (object.rock) drawRockCluster(object.x, object.y, object.scale, object.layout);
      else if (object.decor) drawForest(object.decor, object.x, object.y, object.scale);
      else if (object.kind) drawProp(object);
      else drawPoint(object, time);
    }
    if (!heroShown) drawHero(time);
    context.restore();
    drawGoalPointer(time, snapX, snapY);
  }

  function canMove(x, y) {
    if (x < 7 || y < 10 || x > area.width - 7 || y > area.height - 8) return false;
    if (area.theme === 'coast' && x < shoreEdge(y) - 2) return false;
    return !area.props.some(prop => {
      const [width, , depth] = propFootprint(prop.kind);
      return Math.abs(x - prop.x) < width / 2 + 2 && y > prop.y - depth && y < prop.y + 4;
    });
  }

  function isAvailable(point) {
    if (point.portal) return !point.requires || stages.indexOf(currentStage) >= stages.indexOf(point.requires);
    if (point.actor) return true;   // characters can always be talked to
    if (point.pickup) return Talk.questState(storyState(), point.pickup) === 'active' && !story.collected.has(point.id);
    if (point.quest) return Talk.questState(storyState(), point.quest) === 'active';
    return point.stage === currentStage;
  }
  // '!' for a story beat or a quest hand-in/offer, '…' for unread chat.
  function marker(point) {
    if (point.portal) return isAvailable(point) ? '' : '';
    if (point.actor) {
      const topics = Talk.topicsFor(point.actor, storyState()).filter(t => !story.seen.has(t.id) || t.repeat);
      if (topics.some(t => t.main || t.finish || (t.start && !story.seen.has(t.id)))) return '!';
      if (topics.some(t => !t.repeat && !story.seen.has(t.id))) return '…';
      return '';
    }
    return isAvailable(point) ? '!' : '';
  }

  function update(dt) {
    if (!area || loading || pending || dialog.open) return;
    const dx = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0) + touch.x;
    const dy = (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0) + touch.y;
    const magnitude = Math.hypot(dx, dy);
    const old = [player.x, player.y];
    if (magnitude > .1) {
      if (Math.abs(dx) > Math.abs(dy)) player.facing = dx < 0 ? 'left' : 'right';
      else player.facing = dy < 0 ? 'up' : 'down';
      const speed = 109 * dt / Math.max(1, magnitude);
      if (canMove(player.x + dx * speed, player.y)) player.x += dx * speed;
      if (canMove(player.x, player.y + dy * speed)) player.y += dy * speed;
    }
    const traveled = Math.hypot(player.x - old[0], player.y - old[1]);
    player.moving = traveled > .05;
    player.gait = (player.gait + traveled * .29) % 24;
    nearby = null;
    for (const point of area.points) {
      if (!point.portal && !point.actor && !isAvailable(point)) continue;
      if (distance(player, point) <= 23 && (!nearby || distance(player, point) < distance(player, nearby))) nearby = point;
    }
    interactButton.disabled = !nearby;
    if (performance.now() < toastUntil) return;
    const message = nearby ? (nearby.actor ? `Talk to ${nearby.name}` : nearby.name) : (stageMessages[currentStage] || '');
    // Key hint lives in a data attribute (rendered by CSS) so the label stays plain text.
    const hint = nearby ? (touchUi ? 'Interact' : 'E') : '';
    if (notice.textContent !== message) notice.textContent = message;
    if (notice.dataset.hint !== hint) notice.dataset.hint = hint;
  }

  function save() {
    try {
      localStorage.setItem(saveKey, JSON.stringify({area: area.id, point: [player.x, player.y], stage: currentStage,
        seen: [...story.seen], quests: story.quests, collected: [...story.collected]}));
    } catch {}
  }

  function readSave() {
    try {
      const saved = JSON.parse(localStorage.getItem(saveKey));
      if (areaIds.has(saved?.area) && stages.includes(saved.stage)) return saved;
    } catch {}
    return null;
  }

  function resetTouch() {
    touch.id = null;
    touch.x = 0;
    touch.y = 0;
    knob.style.transform = '';
  }

  async function enter(id, arrival) {
    if (loading) return;
    loading = true;
    pending = {id, arrival};
    held.clear();
    resetTouch();
    nearby = null;
    player.moving = false;
    retryButton.hidden = true;
    interactButton.disabled = true;
    notice.textContent = 'Loading area…';
    try {
      const next = await loader.activate(id);
      const [x, y] = arrival?.length === 2 && arrival.every(Number.isFinite) ? arrival : next.spawn;
      area = next;
      currentArea = next;
      [player.x, player.y] = canMove(x, y) ? [x, y] : next.spawn;
      player.gait = 0;
      areaName.textContent = area.name;
      updateHud();
      audio.music(area.theme);
      notice.textContent = '';
      pending = null;
      save();
    } catch {
      notice.textContent = 'This area couldn’t load.';
      retryButton.hidden = false;
    } finally {
      loading = false;
    }
  }

  // ------------------------------------------------------------ conversations
  const speakerEl = document.querySelector('#speaker');
  const roleEl = document.querySelector('#role');
  const lineEl = document.querySelector('#line');
  const topicsEl = document.querySelector('#topics');
  const nextButton = document.querySelector('#next');
  const byeButton = document.querySelector('#dismiss');
  const portrait = document.querySelector('#portrait');
  const talk = {point: null, lines: [], index: 0, shown: 0, typing: null, after: null};

  function updateHud() {
    objective.textContent = objectives[currentStage];
    document.querySelector('#quests').textContent = Talk.questLines(storyState()).join(' ');
  }

  function drawPortrait(point) {
    const sprite = point.actor && window.KFCampaignCast?.getSprite(point.actor);
    const image = sprite && castArt.get(sprite.src);
    const frame = sprite && window.KFCampaignCast.resolveFrame(sprite, 'down', 'idle', 0);
    portrait.hidden = !frame || !image?.naturalWidth;
    if (portrait.hidden) return;
    const ink = portrait.getContext('2d');
    ink.imageSmoothingEnabled = false;
    ink.clearRect(0, 0, 48, 48);
    // Head and shoulders: find the top of the drawn figure in its cell and
    // frame a 26 px square from just above it.
    const [sx, sy, w, h] = frame.rect;
    if (!drawPortrait.tops) drawPortrait.tops = new Map();
    const key = sx + ',' + sy;
    if (!drawPortrait.tops.has(key)) {
      const probe = document.createElement('canvas');
      [probe.width, probe.height] = [w, h];
      const pc = probe.getContext('2d', {willReadFrequently: true});
      pc.drawImage(image, sx, sy, w, h, 0, 0, w, h);
      const data = pc.getImageData(0, 0, w, h).data;
      let top = 0, left = w, right = 0;
      for (let y = 0; y < h && !top; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 128) { top = y; break; }
      for (let y = top; y < Math.min(h, top + 26); y++) for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 128) { left = Math.min(left, x); right = Math.max(right, x); }
      }
      drawPortrait.tops.set(key, {top, center: (left + right) / 2});
    }
    const {top, center} = drawPortrait.tops.get(key);
    const size = 26;
    ink.drawImage(image, sx + Math.round(center - size / 2), sy + Math.max(0, top - 2), size, size, 0, 0, 48, 48);
  }

  function typeLine(text) {
    clearInterval(talk.typing);
    talk.shown = 0;
    lineEl.textContent = '';
    nextButton.hidden = false;
    nextButton.textContent = 'Next';
    talk.typing = setInterval(() => {
      talk.shown = Math.min(text.length, talk.shown + 2);
      lineEl.textContent = text.slice(0, talk.shown);
      if (talk.shown % 6 === 0) audio.sfx('blip');
      if (talk.shown >= text.length) { clearInterval(talk.typing); talk.typing = null; }
    }, 28);
  }

  function playLines(lines, after) {
    talk.lines = lines;
    talk.index = 0;
    talk.after = after;
    topicsEl.replaceChildren();
    typeLine(lines[0]);
  }

  function advance() {
    if (talk.typing) {
      clearInterval(talk.typing);
      talk.typing = null;
      lineEl.textContent = talk.lines[talk.index];
      return;
    }
    if (talk.index < talk.lines.length - 1) {
      talk.index++;
      audio.sfx('select');
      typeLine(talk.lines[talk.index]);
      return;
    }
    const after = talk.after;
    talk.after = null;
    nextButton.hidden = true;
    if (after) after();
  }

  function applyEffects(effect) {
    if (effect.next) {
      currentStage = effect.next;
      audio.sfx('quest');
      toast(`New objective · ${objectives[currentStage]}`, 3200);
    }
    if (effect.start) {
      story.quests[effect.start] = {count: 0};
      toast(`New quest · ${Talk.quests[effect.start].title}`);
      audio.sfx('quest');
    }
    if (effect.finish) {
      story.quests[effect.finish].done = true;
      toast(`Quest complete · ${Talk.quests[effect.finish].title}`);
      audio.sfx('levelUp');
    }
    updateHud();
    save();
  }

  function showTopics() {
    const point = talk.point;
    const topics = Talk.topicsFor(point.actor, storyState()).filter(t => !t.main || !story.seen.has(t.id));
    topicsEl.replaceChildren(...topics.map(topic => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = topic.label;
      if (topic.main) button.classList.add('main');
      else if (topic.start || topic.finish) button.classList.add('quest');
      if (story.seen.has(topic.id) && !topic.main) button.classList.add('seen');
      button.addEventListener('click', () => {
        audio.sfx('confirm');
        playTopic(topic);
      });
      return button;
    }));
    nextButton.hidden = true;
    (topicsEl.querySelector('button:not(.seen)') || byeButton).focus();
  }

  function playTopic(topic) {
    story.seen.add(topic.id);
    playLines(topic.lines, () => {
      applyEffects(topic);
      showTopics();
    });
  }

  function openConversation(point) {
    const who = Talk.characters[point.actor];
    talk.point = point;
    speakerEl.textContent = who.name;
    roleEl.textContent = who.role;
    drawPortrait(point);
    const due = Talk.topicsFor(point.actor, storyState()).find(t => t.main && !story.seen.has(t.id));
    if (due) playTopic(due);
    else playLines(Talk.greetingFor(point.actor, storyState()), showTopics);
  }

  function openPlace(point) {
    talk.point = point;
    portrait.hidden = true;
    speakerEl.textContent = point.name;
    roleEl.textContent = '';
    let entry = Talk.places[point.pickup ? 'pickup' : point.id];
    let lines = entry ? entry.lines : [point.line];
    playLines(lines, () => {
      if (point.pickup) {
        story.collected.add(point.id);
        story.quests[point.pickup].count++;
        audio.sfx('pickup');
        const left = Talk.quests[point.pickup].goal - story.quests[point.pickup].count;
        toast(left > 0 ? `Pod plating · ${left} more to find` : 'All the plating found · Head back to Bulma');
      } else if (point.quest) {
        story.quests[point.quest].count = Talk.quests[point.quest].goal;
        audio.sfx('quest');
        toast('You sensed his energy · Tell Piccolo');
      } else if (entry?.next || point.next) {
        applyEffects({next: entry?.next || point.next});
      }
      updateHud();
      save();
      byeButton.focus();
    });
  }

  function interact() {
    if (loading || dialog.open || !nearby) return;
    if (nearby.portal) {
      if (isAvailable(nearby)) {
        audio.sfx('portal');
        enter(nearby.portal, nearby.arrival);
        return;
      }
      audio.sfx('denied');
      held.clear();
      resetTouch();
      talk.point = nearby;
      portrait.hidden = true;
      speakerEl.textContent = nearby.name;
      roleEl.textContent = '';
      dialog.showModal();
      playLines([nearby.locked], () => byeButton.focus());
      return;
    }
    held.clear();
    resetTouch();
    audio.sfx('select');
    dialog.showModal();
    if (nearby.actor) openConversation(nearby);
    else openPlace(nearby);
  }

  nextButton.addEventListener('click', advance);
  byeButton.addEventListener('click', () => { clearInterval(talk.typing); talk.typing = null; dialog.close(); });
  dialog.addEventListener('keydown', event => {
    if ((event.code === 'KeyE' || event.code === 'Space' || event.code === 'Enter') && !nextButton.hidden
      && !(event.target instanceof HTMLButtonElement && event.target !== nextButton)) {
      event.preventDefault();
      advance();
    }
  });

  // ------------------------------------------------------------ sound toggle
  const soundButton = document.querySelector('#sound');
  function showSound(on) {
    soundButton.setAttribute('aria-pressed', String(on));
    soundButton.setAttribute('aria-label', on ? 'Music and sound on' : 'Music and sound off');
    soundButton.textContent = on ? '♪' : '♪̸';
    soundButton.style.opacity = on ? 1 : .6;
  }
  soundButton.addEventListener('click', () => audio.setEnabled(!audio.enabled));
  audio.onChange(showSound);
  showSound(audio.enabled);
  window.addEventListener('keydown', event => {
    if (event.code === 'KeyM' && !event.repeat && !event.ctrlKey && !event.metaKey) audio.setEnabled(!audio.enabled);
  });

  function loop(time) {
    const dt = lastTime ? clamp((time - lastTime) / 1000, 0, .05) : 0;
    lastTime = time;
    update(dt);
    render(time);
    requestAnimationFrame(loop);
  }

  const stick = document.querySelector('#stick');
  const knob = stick.querySelector('span');
  function moveStick(event) {
    if (touch.id !== event.pointerId) return;
    const box = stick.getBoundingClientRect();
    const x = (event.clientX - box.left - box.width / 2) / 26;
    const y = (event.clientY - box.top - box.height / 2) / 26;
    const magnitude = Math.max(1, Math.hypot(x, y));
    [touch.x, touch.y] = [x / magnitude, y / magnitude];
    knob.style.transform = `translate(${touch.x * 21}px, ${touch.y * 21}px)`;
  }
  stick.addEventListener('pointerdown', event => {
    if (touch.id !== null || loading || dialog.open) return;
    touch.id = event.pointerId;
    stick.setPointerCapture(event.pointerId);
    moveStick(event);
  });
  stick.addEventListener('pointermove', moveStick);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    stick.addEventListener(type, event => { if (touch.id === event.pointerId) resetTouch(); });
  }
  window.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || dialog.open || loading) return;
    if (event.code === 'KeyE' && !event.repeat) interact();
    if (!keyDirection[event.code]) return;
    event.preventDefault();
    held.add(keyDirection[event.code]);
  });
  window.addEventListener('keyup', event => held.delete(keyDirection[event.code]));
  window.addEventListener('blur', () => { held.clear(); resetTouch(); });
  interactButton.addEventListener('click', interact);
  dialog.addEventListener('close', () => {
    clearInterval(talk.typing);
    talk.typing = null;
    if (talk.after && talk.point && !talk.point.actor) {
      // Leaving a narration early still completes it (pickup, discovery).
      const after = talk.after;
      talk.after = null;
      after();
    }
    if (!interactButton.disabled) interactButton.focus();
  });
  retryButton.addEventListener('click', () => { if (pending) enter(pending.id, pending.arrival); });

  const saved = readSave();
  currentStage = saved?.stage || 'briefing';
  for (const id of saved?.seen || []) story.seen.add(id);
  for (const id of saved?.collected || []) story.collected.add(id);
  for (const [id, quest] of Object.entries(saved?.quests || {})) {
    if (Talk.quests[id] && Number.isInteger(quest?.count)) story.quests[id] = {count: quest.count, done: !!quest.done};
  }
  // Saves from before conversations existed: mark past story beats as seen.
  for (const who of Object.values(Talk.characters)) {
    for (const topic of who.topics) {
      if (topic.main && stages.indexOf(currentStage) > stages.indexOf(topic.when.to)) story.seen.add(topic.id);
    }
  }
  enter(saved?.area || 'kame-coast', saved?.point).then(() => {
    if (saved && (saved.stage !== 'briefing' || saved.seen?.length)) toast('Welcome back · Progress restored', 2200);
  });
  requestAnimationFrame(loop);
})();
