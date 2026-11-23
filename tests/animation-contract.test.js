// Run with: node tests/animation-contract.test.js
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context={};
vm.runInNewContext(fs.readFileSync('animation.js','utf8'),context);
const {animationCatalog,resolveClip,validateAtlasManifest}=context.KiAnimation;
assert.equal(Object.values(animationCatalog.clips).reduce((a,b)=>a+b,0),118);
assert.equal(Object.values(animationCatalog.effects).reduce((a,b)=>a+b,0),64);
assert.equal(animationCatalog.transformationFrames,12);
assert.equal(resolveClip('normal','walk','up').clip,'walkUp');
assert.equal(resolveClip('ssj','walk','left').frames,8);
assert.equal(resolveClip('normal','walk','diagonal'),null);
const frames=n=>Array.from({length:n},(_,i)=>({x:i*64,y:0,w:64,h:96}));
const makeClips=()=>Object.fromEntries(Object.entries(animationCatalog.clips).map(([name,n])=>[name,{frames:frames(n)}]));
const manifest={
  forms:{normal:makeClips(),ssj:makeClips()},
  transformation:{frames:frames(12)},
  effects:Object.fromEntries(Object.entries(animationCatalog.effects).map(([name,n])=>[name,{frames:frames(n)}]))
};
assert.equal(validateAtlasManifest(manifest).valid,true);
manifest.forms.ssj.walkUp.frames.pop();
assert.equal(validateAtlasManifest(manifest).valid,false);
console.log('Animation contract tests passed');
