(() => {
  'use strict';
  const scriptUrl = document.currentScript.src;
  const canvas = document.querySelector('#world');
  const context = canvas.getContext('2d', {alpha: false});
  const [viewWidth, viewHeight] = [canvas.width, canvas.height];
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
  const stageMessages = {'encounter-ready': 'The standoff is set. The battle continues in a future build.'};
  const themes = {
    coast: {ground: '#597e57', grain: ['#628761', '#50764e'], path: '#cdbb85', pathEdge: '#a8a076', shadow: '#335246'},
    ravine: {ground: '#937658', grain: ['#a58663', '#846a51'], path: '#bc9b76', pathEdge: '#a88665', shadow: '#564037'},
    ridge: {ground: '#6c7b60', grain: ['#78866b', '#63745a'], path: '#ad9c77', pathEdge: '#8c896b', shadow: '#404939'}
  };
  const propSizes = {house: [66, 51, 15], palm: [29, 32, 6], rock: [28, 15, 10], cliff: [40, 42, 22], pod: [45, 42, 15]};
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
        || data.width < viewWidth || data.height < viewHeight || data.width > 1000 || data.height > 1000) {
        throw new Error('Invalid campaign area');
      }
      const ground = document.createElement('canvas');
      [ground.width, ground.height] = [data.width, data.height];
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
      const objects = [...data.props, ...data.points].sort((a, b) => a.y - b.y);
      return {...data, ground, objects};
    }
  });

  function paintGround(ink, data) {
    const {width, height, paths, theme} = data;
    const palette = themes[theme];
    ink.fillStyle = palette.ground;
    ink.fillRect(0, 0, width, height);
    let seed = [...data.id].reduce((acc, char) => acc * 31 + char.charCodeAt(0), 1) >>> 0;
    function random() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    // Broader patches keep open fields from reading as one flat repeated tile.
    for (let i = 0; i < 105; i++) {
      ink.fillStyle = palette.grain[i % 2];
      const x = Math.floor(random() * width), y = Math.floor(random() * height);
      const span = 6 + Math.floor(random() * 19);
      ink.fillRect(x, y, span, 2);
      ink.fillRect(x + 3, y - 2, span - 4, 6);
      ink.fillRect(x + 5, y - 4, span - 6, 2);
    }
    for (let i = 0; i < 2600; i++) {
      ink.fillStyle = palette.grain[i % 2];
      const x = Math.floor(random() * width), y = Math.floor(random() * height);
      ink.fillRect(x, y, 1 + Math.floor(random() * 5), 1 + Math.floor(random() * 2));
    }
    if (theme === 'coast') {
      // The tide line is built from horizontal pixel bands.
      for (let y = 0; y < height; y += 2) {
        const edge = shoreEdge(y);
        ink.fillStyle = '#3e6561';
        ink.fillRect(0, y, edge, 2);
        ink.fillStyle = '#ccb280';
        ink.fillRect(edge - 10, y, 18, 2);
        ink.fillStyle = '#a5c0a1';
        ink.fillRect(edge - 13, y, 4, 2);
        if (y % 8 === 0) {
          ink.fillStyle = '#538985';
          ink.fillRect(Math.round(random() * (edge - 14)), y, 5 + Math.floor(random() * 10), 1);
          ink.fillStyle = '#708f87';
          ink.fillRect(edge - 15, y, 6, 1);
          ink.fillStyle = '#ac9568';
          ink.fillRect(edge - 5 + Math.floor(random() * 10), y + 3, 2, 1);
        }
      }
    }
    ink.lineJoin = 'round';
    ink.lineCap = 'round';
    for (const path of paths) {
      ink.beginPath();
      path.forEach(([x, y], i) => i ? ink.lineTo(x, y) : ink.moveTo(x, y));
      ink.strokeStyle = palette.pathEdge;
      ink.lineWidth = 31;
      ink.stroke();
      ink.strokeStyle = palette.path;
      ink.lineWidth = 22;
      ink.stroke();
      for (let i = 1; i < path.length; i++) {
        const [ax, ay] = path[i - 1], [bx, by] = path[i];
        const count = Math.floor(Math.hypot(ax - bx, ay - by) / 3);
        for (let j = 0; j < count; j++) {
          const progress = j / count;
          const x = Math.round(ax + (bx - ax) * progress + random() * 5 - 2);
          const y = Math.round(ay + (by - ay) * progress + random() * 15 - 7);
          ink.fillStyle = j % 3 ? palette.pathEdge : '#d5c59e';
          ink.fillRect(x, y, 1 + Math.floor(random() * 3), 1);
        }
      }
    }
    // Small clumps stay outside the paths so the route remains readable.
    const groundPixels = ink.getImageData(0, 0, width, height).data;
    const rgb = palette.ground.slice(1).match(/../g).map(channel => parseInt(channel, 16));
    for (let i = 0; i < 125; i++) {
      const x = Math.floor(random() * width), y = Math.floor(random() * height);
      const pixel = (y * width + x) * 4;
      if (!rgb.every((channel, index) => groundPixels[pixel + index] === channel)) continue;
      ink.fillStyle = palette.shadow;
      ink.fillRect(x, y, 6, 1);
      ink.fillRect(x + 3, y - 2, 1, 2);
      ink.fillStyle = palette.grain[0];
      ink.fillRect(x + 1, y - 3, 1, 3);
      ink.fillRect(x + 4, y - 4, 1, 4);
    }
    if (theme === 'ravine') {
      ink.save();
      ink.translate(304, 145);
      ink.fillStyle = '#765b47';
      ink.beginPath();
      ink.ellipse(0, 0, 42, 21, 0, 0, Math.PI * 2);
      ink.fill();
      ink.fillStyle = '#6c5345';
      ink.beginPath();
      ink.ellipse(0, 0, 36, 15, 0, 0, Math.PI * 2);
      ink.fill();
      ink.restore();
    }
  }

  function shoreEdge(y) {
    return 52 + Math.floor((Math.sin(y / 36) * 12 + Math.sin(y / 17) * 4) / 2) * 2;
  }

  function drawProp(prop) {
    const {x, y, kind} = prop;
    const [w, h] = propSizes[kind];
    context.save();
    context.translate(x, y);
    const paint = (color, px, py, width, height) => {
      context.fillStyle = color;
      context.fillRect(px, py, width, height);
    };
    paint(themes[area.theme].shadow, -w / 2, -3, w, 6);
    if (kind === 'house') {
      paint('#4b3b42', -30, -31, 60, 32);
      paint('#edd2c2', -27, -26, 54, 24);
      paint('#776077', -7, -20, 14, 20);
      paint('#49868d', -22, -20, 10, 9);
      paint('#49868d', 14, -20, 10, 9);
      for (let row = 0; row < 8; row++) {
        paint(row % 2 ? '#b36472' : '#c47f85', -12 - row * 3, -h + row * 3, 24 + row * 6, 4);
      }
      paint('#8c5263', -33, -30, 66, 4);
      paint('#b6919d', -27, -25, 54, 3);
      for (const x of [-22, 14]) {
        paint('#e9ded8', x - 1, -21, 12, 1);
        paint('#86b7b2', x + 1, -19, 8, 2);
        paint('#d5bbba', x + 4, -20, 1, 10);
        paint('#645459', x - 2, -11, 14, 2);
      }
      paint('#aa8495', -6, -19, 12, 2);
      paint('#493942', -4, -17, 9, 15);
      paint('#d7a887', 2, -10, 1, 2);
      paint('#a69987', -11, 0, 22, 3);
      paint('#e5c6ad', -9, 0, 18, 1);
      paint('#9b5367', -25, -46, 5, 7);
      paint('#d89c9a', -26, -48, 7, 3);
      for (let i = 0; i < 5; i++) {
        const y = -45 + i * 3;
        paint('#a96073', -9 - i * 3, y, 2, 1);
        paint('#e2a09d', 8 + i * 3, y + 1, 3, 1);
      }
    } else if (kind === 'palm') {
      paint('#654c39', -3, -25, 6, 25);
      paint('#9a754c', -2, -29, 3, 27);
      paint('#bd985c', 0, -26, 1, 21);
      for (let y = -21; y < -2; y += 5) paint('#775a40', -2, y, 4, 1);
      const leaves = [
        [-18,-27,6,3], [-15,-30,12,4], [-12,-33,13,5], [-10,-35,9,3],
        [-3,-36,7,6], [3,-33,11,4], [7,-30,11,4], [11,-27,9,3],
        [-14,-24,12,3], [-13,-21,6,3], [4,-25,10,4], [8,-22,7,3]
      ];
      leaves.forEach(([x, y, w, h], i) => {
        paint('#294e47', x, y, w, h);
        paint(i % 3 ? '#416d50' : '#5b8657', x + 1, y, w - 2, Math.max(1, h - 2));
      });
      paint('#8b9d65', -4, -34, 7, 2);
      paint('#765538', -2, -27, 5, 3);
    } else if (kind === 'pod') {
      // Stacked bands make a round capsule with an open hatch.
      for (let row = 0; row < 10; row++) {
        const half = Math.round(Math.sqrt(Math.max(0, 1 - ((row - 4) / 5) ** 2)) * 21);
        paint(row > 6 ? '#8d8581' : '#d5c8b6', -half, -h + row * 4, half * 2, 4);
      }
      paint('#76605a', -15, -29, 31, 4);
      paint('#352f32', -13, -25, 26, 12);
      paint('#504652', -10, -22, 18, 5);
      paint('#b65f56', 14, -24, 4, 4);
    } else {
      const dark = kind === 'cliff' ? '#665347' : '#5e6055';
      const light = kind === 'cliff' ? '#a48a6d' : '#939486';
      paint(dark, -w / 2, -h + 7, w, h - 8);
      paint(light, -w / 2 + 5, -h, w - 12, h / 2);
      paint(light, -w / 2 + 2, -h + 4, w - 5, 7);
      paint('#776b5a', -w / 2 + 3, -h / 2, w - 8, h / 2 - 3);
      paint(dark, 4, -h + 2, 1, h / 2 - 1);
      paint('#b0a18b', -w / 2 + 6, -h + 2, w / 3, 1);
      paint('#645b50', -w / 2 + 5, -h / 2 + 3, w - 13, 1);
      paint(dark, -w / 2 + 9, -h / 2 + 3, 2, Math.round(h / 4));
      paint('#494a3e', -w / 2 + 2, -2, w - 4, 2);
    }
    context.restore();
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

  function drawPoint(point, time) {
    const sprite = point.actor && window.KFCampaignCast?.getSprite(point.actor);
    const frame = sprite && window.KFCampaignCast.resolveFrame(sprite, 'down', dialog.open && nearby === point ? 'talk' : 'idle', time);
    const shown = sprite && drawSprite(castArt.get(sprite.src), frame, point.x, point.y, sprite.scale);
    const active = isAvailable(point);
    if ((!shown || active) && !(point.stage && stages.indexOf(currentStage) > stages.indexOf(point.stage))) {
      const x = point.x, y = point.y - (shown ? 40 : 9);
      context.fillStyle = '#304039';
      context.fillRect(x - 6, y - 6, 12, 12);
      context.fillStyle = active ? '#f6ba75' : '#a4b5ac';
      context.fillRect(x - 3, y - 3, 6, 6);
    }
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

  function render(time) {
    if (!area) return;
    const camX = Math.round(clamp(player.x - viewWidth / 2, 0, area.width - viewWidth));
    const camY = Math.round(clamp(player.y - viewHeight / 2, 0, area.height - viewHeight));
    context.imageSmoothingEnabled = false;
    context.drawImage(area.ground, camX, camY, viewWidth, viewHeight, 0, 0, viewWidth, viewHeight);
    context.save();
    context.translate(-camX, -camY);
    let heroShown = false;
    for (const object of area.objects) {
      if (!heroShown && object.y > player.y) {
        drawHero(time);
        heroShown = true;
      }
      if (object.kind) drawProp(object);
      else drawPoint(object, time);
    }
    if (!heroShown) drawHero(time);
    context.restore();
  }

  function canMove(x, y) {
    if (x < 7 || y < 10 || x > area.width - 7 || y > area.height - 8) return false;
    if (area.theme === 'coast' && x < shoreEdge(y) - 2) return false;
    return !area.props.some(prop => {
      const [width, , depth] = propSizes[prop.kind];
      return Math.abs(x - prop.x) < width / 2 + 2 && y > prop.y - depth && y < prop.y + 4;
    });
  }

  function isAvailable(point) {
    return point.portal ? !point.requires || stages.indexOf(currentStage) >= stages.indexOf(point.requires)
      : point.stage === currentStage;
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
      if (!point.portal && point.stage !== currentStage) continue;
      if (distance(player, point) <= 23 && (!nearby || distance(player, point) < distance(player, nearby))) nearby = point;
    }
    interactButton.disabled = !nearby;
    const message = nearby ? nearby.name : (stageMessages[currentStage] || '');
    if (notice.textContent !== message) notice.textContent = message;
  }

  function save() {
    try {
      localStorage.setItem(saveKey, JSON.stringify({area: area.id, point: [player.x, player.y], stage: currentStage}));
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
      [player.x, player.y] = canMove(x, y) ? [x, y] : next.spawn;
      player.gait = 0;
      areaName.textContent = area.name;
      objective.textContent = objectives[currentStage];
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

  function interact() {
    if (loading || dialog.open || !nearby) return;
    if (nearby.portal && isAvailable(nearby)) {
      enter(nearby.portal, nearby.arrival);
      return;
    }
    held.clear();
    resetTouch();
    document.querySelector('#speaker').textContent = nearby.name;
    document.querySelector('#line').textContent = nearby.portal ? nearby.locked : nearby.line;
    if (!nearby.portal && nearby.next) {
      currentStage = nearby.next;
      objective.textContent = objectives[currentStage];
      save();
    }
    dialog.showModal();
  }

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
    if (!interactButton.disabled) interactButton.focus();
  });
  retryButton.addEventListener('click', () => { if (pending) enter(pending.id, pending.arrival); });

  const saved = readSave();
  currentStage = saved?.stage || 'briefing';
  enter(saved?.area || 'kame-coast', saved?.point);
  requestAnimationFrame(loop);
})();
