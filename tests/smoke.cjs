const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).filter(x=>x.trim());
assert(scripts.length>0,'Game script missing');
for(const script of scripts)new vm.Script(script,{filename:'index.html'});
for(const token of ['function chooseFighter(','function canChangeFighter()','function saveJourney()','function loadJourney()','function renderFighterRoster()','function openJourneyMenu(','function drawNavigationMap(','function renderHUD()','version:3,step:journeyStep'])assert(html.includes(token),'Missing integration: '+token);
assert(html.includes('party:(captureParty(),partyStats)'),'Party state must save with Cedar Journey');
assert(html.includes('if(Array.isArray(data.party)'),'Legacy save migration missing');
assert(html.includes('function startNewJourney()'),'New Game missing');
assert(html.includes('id="kfmenu-techniques"'),'Techniques screen missing');
// Validate actual committed PNG headers, not just the filenames referenced by HTML.
for(const filename of ['normal-movement-4x4.png','ssj-gameplay-clean-4x4.png','ssj-gameplay-actions-4x4.png']){
  const bytes=fs.readFileSync('assets/'+filename);
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a',filename+' is not a PNG');
  assert.equal(bytes.readUInt32BE(16),256,filename+' has incorrect sheet width');
  assert.equal(bytes.readUInt32BE(20),384,filename+' has incorrect sheet height');
}
assert(html.includes('const approvedScale=.32'),'Keep the existing approved character scale');
assert(html.includes('ssj-cohesive-4x9.png?v=cohesive-1')&&html.includes('normal-movement-4x4.png?v=navy-hair-4'),
  'Current canonical gameplay atlases must bypass stale browser caches');
assert(html.includes('const ssjTransformationAtlas=ssjUnifiedAtlas;'),'Cinematic SSJ transformation must remain untouched');
assert(html.includes('c.drawImage(ssjCohesiveAtlas,frame*64,row*96'),'SSJ gameplay must use the single cohesive atlas');
console.log('Ki Fighter syntax and integration smoke checks passed');

const cohesive=fs.readFileSync('assets/ssj-cohesive-4x9.png');
assert.equal(cohesive.readUInt32BE(16),256,'SSJ atlas width');
assert.equal(cohesive.readUInt32BE(20),864,'SSJ atlas height');
