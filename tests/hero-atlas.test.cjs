const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const context={window:{}};
const directory='assets/hero-animation/';
vm.runInNewContext(fs.readFileSync(directory+'manifest.js','utf8'),context);
const {cell,grid,clips,preflight,renderPolicy,special}=context.window.KiHeroManifest;
const bytes=fs.readFileSync(directory+'body-atlas.png');
assert.equal(bytes.readUInt32BE(16),grid.columns*cell[0]);
assert.equal(bytes.readUInt32BE(20),grid.rows*cell[1]);
assert.equal(renderPolicy.legacyFallback,false);
assert.equal(preflight.blocked.length,0);
assert.equal(preflight.missingClips.length,0);

const transformation=fs.readFileSync(directory+'transformation-fit.png');
assert.equal(special.ssjTransformation.frames.length,12);
for(const {sheet,rect:[x,y,w,h],feet,durationMs} of special.ssjTransformation.frames){
  assert.equal(sheet,'transformation-fit.png');
  assert(x>=0&&x+w<=transformation.readUInt32BE(16));
  assert(y>=0&&y+h<=transformation.readUInt32BE(20));
  assert.equal(feet.join(','),'48,96');
  assert(durationMs>0);
}

for(const idle of Object.values(clips.normal.idle)){
  assert(idle.loop);
  assert.equal(idle.frames.length,6);
}

for(const form of ['normal','ssj']){
  const stride=clips[form].walk.right;
  assert.equal(stride.frames.length,8);
  assert.equal(new Set(stride.frames.map(f=>f.rect.join(','))).size,8);

  const recharge=clips[form].recharge.shared;
  assert(recharge.loop&&recharge.loopStart>0);
  assert(recharge.frames.length>16);
  // The charge aura is a separate effect layer (charge-aura.png), not baked into the body.
  assert.equal(recharge.effectOwnership,'separate-aura');
  const auraPng=fs.readFileSync(directory+'charge-aura.png');
  let previousAlpha=-1;
  for(const {aura} of recharge.frames){
    assert(aura&&aura.sheet==='charge-aura.png');
    const [ax,ay,aw,ah]=aura.rect;
    assert(ax>=0&&ay>=0&&ax+aw<=auraPng.readUInt32BE(16)&&ay+ah<=auraPng.readUInt32BE(20));
    assert(aura.alpha>=previousAlpha&&aura.alpha<=1&&aura.scale>0&&aura.scale<=1);
    previousAlpha=aura.alpha;
  }
  for(const frame of recharge.frames.slice(recharge.loopStart))assert.equal(frame.aura.alpha,1);

  // Walk clips: distance-driven gait and planted rest frames for stopping.
  for(const facing of ['right','down','up']){
    const walk=clips[form].walk[facing];
    assert(walk.restFrames.length&&walk.restFrames.every(i=>i>=0&&i<walk.frames.length));
  }
  const side=clips[form].walk.right;
  assert.equal(side.gaitWeights.length,side.frames.length);
  assert(side.gaitWeights.every(w=>w>0));
  assert(side.strideCellPx>=side.gaitWeights.reduce((a,b)=>a+b,0));
  const intro=new Set(recharge.frames.slice(0,recharge.loopStart).map(f=>f.rect.join(',')));
  for(const frame of recharge.frames.slice(recharge.loopStart))assert(!intro.has(frame.rect.join(',')));

  for(const action of ['idle','walk','dash','punch','kick','kiBlast','beamGather','beamRelease','flight']){
    const directions=clips[form][action];
    for(const facing of ['right','down','up'])assert(directions[facing],form+'/'+action+'/'+facing);
    if(action.startsWith('beam'))for(const facing of ['upRight','downRight'])assert(directions[facing]);
  }
  for(const [action,directions] of Object.entries(clips[form])){
    for(const {frames,contactFrame} of Object.values(directions)){
      if(/^(punch|kick)/.test(action))assert(contactFrame>0&&contactFrame<frames.length-1);
      assert(frames.length);
      for(const {rect:[x,y,w,h],feet,muzzle,durationMs} of frames){
        assert(w===cell[0]&&h===cell[1]&&x%w===0&&y%h===0);
        assert(x>=0&&x+w<=grid.columns*w&&y>=0&&y+h<=grid.rows*h);
        assert(durationMs>0);
        if(action.startsWith('beam')||action==='kiBlast')assert(muzzle);
        for(const [ax,ay] of [feet,...(muzzle?[muzzle]:[])])assert(ax>=0&&ax<w&&ay>=0&&ay<h);
      }
    }
  }
}
console.log('Hero atlas dimensions, action coverage and anchors passed');
