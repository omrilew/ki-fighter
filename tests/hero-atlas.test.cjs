const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const context={window:{}};
const directory='assets/hero-animation/';
vm.runInNewContext(fs.readFileSync(directory+'manifest.js','utf8'),context);
const {cell,grid,clips,preflight,renderPolicy}=context.window.KiHeroManifest;
const bytes=fs.readFileSync(directory+'body-atlas.png');
assert.equal(bytes.readUInt32BE(16),grid.columns*cell[0]);
assert.equal(bytes.readUInt32BE(20),grid.rows*cell[1]);
assert.equal(renderPolicy.legacyFallback,false);
assert.equal(preflight.blocked.length,0);
assert.equal(preflight.missingClips.length,0);

for(const form of ['normal','ssj']){
  for(const action of ['idle','walk','dash','punch','kick','kiBlast','beamGather','beamRelease','flight']){
    const directions=clips[form][action];
    for(const facing of ['right','down','up'])assert(directions[facing],form+'/'+action+'/'+facing);
    if(action.startsWith('beam'))for(const facing of ['upRight','downRight'])assert(directions[facing]);
  }
  for(const [action,directions] of Object.entries(clips[form])){
    for(const {frames} of Object.values(directions)){
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
