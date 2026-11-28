/* Story mode for Ki Fighter: Chapter One, "The Brother from Space".
 *
 * Lives inside the main game world, east of the Cedar Dojo, on the same
 * map, HUD, combat, levels, items, saves and music. The engine (index.html)
 * calls the hooks below; this file never reaches into engine internals
 * except through window.KiGame.
 *
 *   Kame Coast      x 1480-1960  Bulma, seaside house, training ground (dummies)
 *   Landing Ravine  x 1960-2380  crash pod, plating pickups, raider camps
 *   Standoff Ridge  x 2380-2760  Piccolo, ki lookout (meditation), raider camp, Raditz
 *
 * Conversations come from campaign/dialogue.js (KFDialogue).
 */
(function(root){
'use strict';
const Talk=root.KFDialogue;
const REGIONS=[
 {id:'coast',name:'Kame Coast',from:1480,to:1960,music:'coast'},
 {id:'ravine',name:'Landing Ravine',from:1960,to:2380,music:'ravine'},
 {id:'ridge',name:'Standoff Ridge',from:2380,to:2760,music:'ridge'},
];
const STORY_START=1440;
const img=src=>{const i=new Image();i.src=src;return i};
const art={
 buildings:img('assets/campaign-buildings.png?v=3'),
 forest:img('assets/forest-detail.webp'),
 npcs:img('assets/campaign-cast/npc-atlas.png'),
 raditz:img('assets/campaign-cast/raditz/raditz-atlas.png?v=1'),
};
const ready=i=>i.complete&&i.naturalWidth>0;

// ------------------------------------------------------------- world layout
const buildings=[
 {kind:'sea-house',frame:2,x:1575,y:214,w:113,h:108,solidW:94,solidH:30},
 {kind:'dome-hut',frame:1,x:1890,y:196,w:81,h:78,solidW:68,solidH:26},
 {kind:'round-tower',frame:3,x:2735,y:170,w:62,h:111,solidW:40,solidH:18},
];
const pod={x:2170,y:196,w:64,h:62,solidW:48,solidH:16,frame:5};
const npcs=[
 {id:'bulma',actor:'bulma',x:1660,y:258,name:'Bulma'},
 {id:'piccolo',actor:'piccolo',x:2470,y:236,name:'Piccolo'},
 {id:'raditz',actor:'raditz',x:2668,y:270,name:'Raditz'},
];
const places=[
 {id:'inspect-pod',name:'Impact site',x:2170,y:226},
 {id:'ridge-lookout',name:'Ridge lookout',x:2545,y:392,quest:'ki-focus',training:true},
 {id:'training-ground',name:'Seaside training ground',x:1805,y:350,sign:true},
];
const pickups=[
 {id:'scrap-1',x:2088,y:214},{id:'scrap-2',x:2246,y:246},{id:'scrap-3',x:2140,y:318},
];
// rock clusters: [x, y, scale, layout]
const rocks=[
 [1990,170,1.6,0],[2030,438,1.3,2],[2330,212,1.7,3],[2210,420,1.2,1],[2105,120,1.4,4],
 [2405,150,2,2],[2440,430,1.5,0],[2600,436,1.8,3],[2700,190,1.3,1],[2560,120,1.6,4],
];
const dummies=[{x:1782,y:372},{x:1828,y:392},{x:1874,y:370}];
const camps=[
 {id:'ravine-west',x:2060,y:372,kinds:['bandit','ninja'],level:2},
 {id:'ravine-north',x:2300,y:140,kinds:['thug','soldier'],level:3},
 {id:'ridge-north',x:2600,y:180,kinds:['soldier','ninja','thug'],level:4},
];
const RAIDER_REGION='ravine';
// regional looks for camp enemies (assets/enemy-variants.png)
const VARIANT={bandit:'dune-raider',thug:'rock-brute',ninja:'ravine-stalker',soldier:'ridge-sentry'};
const raditzHome={x:2668,y:270};
const shore=x=>440+Math.sin(x/53)*9+Math.sin(x/19)*3;
const inCoast=x=>x>=1480&&x<1960;

// ------------------------------------------------------------- state
const state={stage:'briefing',seen:new Set(),quests:{},collected:new Set(),rewards:new Set(),meditate:0,meditateReady:0};
const respawn={};      // camp/dummy id -> time when it may come back
let clock=0,lastRegion=null,raditzDown=false;
const storyState=()=>({stage:state.stage,quests:state.quests});
const G=()=>root.KiGame;

function regionAt(x){return REGIONS.find(r=>x>=r.from&&x<r.to)||null}
function inStory(){const p=G()?.player;return !!p&&p.x>STORY_START}
function stageAtLeast(stage){return Talk.stages.indexOf(state.stage)>=Talk.stages.indexOf(stage)}

// ------------------------------------------------------------- painting
function paintGround(bg){
 // Ravine: warm dry earth; ridge: cooler moss and stone. Painted as many
 // overlapping soft patches whose density falls off toward the region's
 // edges, so regions melt into each other with no straight borders.
 let seed=91;
 const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const patches=(cx,half,colors,count)=>{
  for(let i=0;i<count;i++){
   // triangular distribution: dense in the middle, sparse at the edges
   const x=cx+(rnd()-rnd())*half*1.25,y=40+rnd()*480,r=18+rnd()*58;
   const col=colors[i%colors.length];
   const g=bg.createRadialGradient(x,y,0,x,y,r);
   g.addColorStop(0,col);g.addColorStop(1,col.slice(0,7)+'00');
   bg.fillStyle=g;bg.fillRect(x-r,y-r,r*2,r*2);
  }
 };
 patches(2170,240,['#8a6440a0','#6e4e32a0','#a07a4c80','#5c4430a0'],260);
 patches(2570,220,['#5a6a4c80','#6b7458a0','#4a5a4480','#7d7a6060'],170);
 for(let i=0;i<1400;i++){
  const x=2170+(rnd()-rnd())*300,y=rnd()*560;
  bg.fillStyle=i%3?'#5a402a40':'#c49a6a30';
  bg.fillRect(x,y,.6+rnd()*1.8,.5+rnd());
 }
 // crater around the pod
 const crater=bg.createRadialGradient(pod.x,pod.y-4,4,pod.x,pod.y-4,60);
 crater.addColorStop(0,'#26190f');crater.addColorStop(.5,'#47301f');crater.addColorStop(.82,'#8a6644');crater.addColorStop(1,'#8a664400');
 bg.fillStyle=crater;bg.beginPath();bg.ellipse(pod.x,pod.y-4,62,32,0,0,Math.PI*2);bg.fill();
 bg.strokeStyle='#d2a77088';bg.lineWidth=1.2;bg.beginPath();bg.ellipse(pod.x,pod.y-6,48,22,0,Math.PI*1.05,Math.PI*1.95);bg.stroke();
 // coast: sand, sea and foam along the southern edge
 bg.beginPath();bg.moveTo(1470,560);
 for(let x=1470;x<=1970;x+=4)bg.lineTo(x,shore(x)-16);
 bg.lineTo(1970,560);bg.closePath();
 const sand=bg.createLinearGradient(0,400,0,470);sand.addColorStop(0,'#d9c08a');sand.addColorStop(1,'#b49a6a');
 bg.fillStyle=sand;bg.fill();
 bg.beginPath();bg.moveTo(1470,560);
 for(let x=1470;x<=1970;x+=4)bg.lineTo(x,shore(x));
 bg.lineTo(1970,560);bg.closePath();
 const sea=bg.createLinearGradient(0,430,0,560);sea.addColorStop(0,'#3f8f95');sea.addColorStop(.4,'#22607a');sea.addColorStop(1,'#173d5c');
 bg.fillStyle=sea;bg.fill();
 for(let i=0;i<220;i++){const x=1475+rnd()*490,y=shore(x)+6+rnd()*110;bg.fillStyle=i%3?'#7fc0c455':'#e8f6f070';bg.fillRect(x,y,3+rnd()*8,.7)}
 bg.strokeStyle='#eef8f0b0';bg.lineWidth=1.1;bg.beginPath();
 for(let x=1470;x<=1970;x+=3){const y=shore(x)+Math.sin(x/5)*.8;x===1470?bg.moveTo(x,y):bg.lineTo(x,y)}
 bg.stroke();
}

// keep trees away from the story spots, the sea and most of the ravine
function clear(x,y){
 if(x<STORY_START-20)return false;
 if(inCoast(x)&&y>shore(x)-30)return true;
 if(x>=2000&&x<2340&&((x*7+y*13)%10)<6)return true;          // ravine: sparser trees
 if(Math.hypot(x-pod.x,(y-pod.y)*1.4)<90)return true;
 if(dummies.some(d=>Math.hypot(x-d.x,y-d.y)<45))return true;
 if([...npcs,...places,...pickups,...camps].some(o=>Math.hypot(x-o.x,y-o.y)<42))return true;
 if(buildings.some(b=>Math.abs(x-b.x)<b.w*.7+10&&y>b.y-b.h-10&&y<b.y+26))return true;
 if(rocks.some(([rx,ry,s])=>Math.hypot(x-rx,y-ry)<22*s))return true;
 return false;
}

function solid(x,y){
 if(x<STORY_START)return false;
 if(inCoast(x)&&y>shore(x)-2)return true;
 for(const b of [...buildings,pod])if(Math.abs(x-b.x)<b.solidW/2&&y>b.y-b.solidH&&y<b.y+2)return true;
 for(const [rx,ry,s] of rocks)if(Math.abs(x-rx)<11*s&&y>ry-6*s&&y<ry+3)return true;
 if(!stageAtLeast('fight')&&Math.hypot(x-raditzHome.x,y-raditzHome.y)<9)return true;
 return false;
}

// ------------------------------------------------------------- drawing
const rockCell=[554,75,55,15,11];
const rockLayouts=[
 [[-7,0,1.5,0],[6,1,1.15,1],[0,3,.8,0]],[[-4,0,1.7,1],[9,2,.9,0]],
 [[-8,1,1.1,0],[3,-1,1.55,1],[11,3,.7,0],[-1,4,.65,1]],[[0,0,1.6,0],[-9,3,.75,1]],
 [[-5,0,1.3,1],[7,0,1.3,0],[1,4,.8,0]],
];
function shadow(c,w,depth=.1){c.fillStyle='#14282155';c.beginPath();c.ellipse(w*.05,1,w*.38,Math.max(1.5,w*depth),0,0,Math.PI*2);c.fill()}
function drawRocks(c,o){
 if(!ready(art.forest))return;
 const [sx,sw,sh,w,h]=rockCell;
 c.save();c.translate(o.x,o.y);c.scale(o.s,o.s);c.imageSmoothingEnabled=false;shadow(c,30,.12);
 for(const [ox,oy,k,flip] of [...rockLayouts[o.layout]].sort((a,b)=>a[1]-b[1])){
  c.save();c.translate(ox,oy);c.scale(flip?-k:k,k);c.drawImage(art.forest,sx,0,sw,sh,-w/2,-h+2,w,h);c.restore();
 }
 c.restore();
}
function drawBuilding(c,b){
 if(!ready(art.buildings))return;
 c.save();c.translate(b.x,b.y);c.imageSmoothingEnabled=false;shadow(c,b.w,.09);
 const h=b.h*224/200;
 c.drawImage(art.buildings,b.frame*224,0,224,224,-b.w/2,-h+4+(b.sink||0),b.w,h);
 c.restore();
}
function label(c,text,x,y){
 c.save();c.font='bold 8px system-ui';c.textAlign='center';c.lineWidth=2.7;c.lineJoin='round';
 c.strokeStyle='#1c271f';c.fillStyle='#ffe5a7';c.strokeText(text,x,y);c.fillText(text,x,y);c.restore();
}
function bang(c,mark,x,y){
 const bob=Math.sin(clock*5.5)*1.5;
 c.save();c.textAlign='center';c.lineWidth=3;c.strokeStyle='#1c271f';
 c.font=mark==='!'?'bold 12px system-ui':'bold 10px system-ui';c.fillStyle=mark==='!'?'#ffd36b':'#cfe3ff';
 c.strokeText(mark,x,y+bob);c.fillText(mark,x,y+bob);c.restore();
}
function marker(n){
 const topics=Talk.topicsFor(n.actor,storyState()).filter(t=>!state.seen.has(t.id)||t.repeat);
 if(topics.some(t=>t.main||t.finish||(t.start&&!state.seen.has(t.id))))return '!';
 if(topics.some(t=>!t.repeat&&!state.seen.has(t.id)))return '…';
 return '';
}
// ---- Raditz sprite pack (KiRaditzManifest): 4 directions, feet at (32,88)
const RADITZ_SCALE=.6;
function dir4(angle){
 const x=Math.cos(angle),y=Math.sin(angle);
 return Math.abs(x)>Math.abs(y)*1.15?(x<0?'left':'right'):(y<0?'up':'down');
}
function raditzFrame(action,direction,t,progress){
 const clip=root.KiRaditzManifest?.clips?.[action]?.[direction];
 if(!clip)return null;
 const frames=clip.frames;
 if(progress!==undefined)return frames[Math.min(frames.length-1,Math.floor(progress*frames.length))];
 const total=frames.reduce((a,f)=>a+f.durationMs,0);
 let left=clip.loop?(t*1000)%total:Math.min(t*1000,total-1);
 for(const f of frames){left-=f.durationMs;if(left<0)return f}
 return frames[frames.length-1];
}
function blitRaditz(c,frame,x,y,alpha=1,flash=0){
 if(!frame||!ready(art.raditz))return false;
 const [sx,sy,w,h]=frame.rect,[fx,fy]=frame.feet,k=RADITZ_SCALE;
 c.save();c.translate(Math.round(x),Math.round(y));c.imageSmoothingEnabled=false;c.globalAlpha*=alpha;
 c.fillStyle='#203e2c9e';c.beginPath();c.ellipse(0,2,12,3,0,0,Math.PI*2);c.fill();
 if(flash>0)c.filter='brightness(1.7)';
 c.drawImage(art.raditz,sx,sy,w,h,-fx*k,-fy*k,w*k,h*k);
 c.restore();
 return true;
}
// Boss rendering, called by the engine for enemies of kind 'raditz'.
function drawRaditz(c,o){
 const direction=dir4(o.faceAngle??Math.atan2(o.fy||0,o.fx||-1));
 let frame;
 if(o.koTime)frame=raditzFrame('knockdown',direction,0,Math.min(.99,1-o.koTime/.29));
 else if(o.hurt)frame=raditzFrame('hurt',direction,0,.5);
 else if(o.attack){
  const {time,windup,ranged}=o.attack;
  frame=time<windup?raditzFrame('rushTell',direction,0,time/windup)
   :raditzFrame(ranged?'kiShot':'rush',direction,0,Math.min(.99,(time-windup)/.22));
 }else if(o.stride>.15)frame=raditzFrame('walk',direction,clock);
 else frame=raditzFrame('idle',direction,clock+(o.phase||0));
 if(!blitRaditz(c,frame,o.x,o.y,1,o.flash))return false;
 return true;
}

function drawNpc(c,n){
 if(scene&&n.actor==='piccolo'){
  const k=Math.min(1,scene.t/.6),from={x:n.x,y:n.y},to=scene.piccolo;
  n={...n,x:from.x+(to.x-from.x)*k,y:from.y+(to.y-from.y)*k};
 }
 const p=G()?.player;
 if(n.actor==='raditz'){
  if(state.stage==='victory'){
   // he stays down where the fight ended
   const at=state.raditzAt||raditzHome;
   blitRaditz(c,raditzFrame('knockdown','right',0,.99),at[0]??at.x,at[1]??at.y);
   return;
  }
  if(stageAtLeast('fight'))return;
  const dir=!p?'left':dir4(Math.atan2(p.y-n.y,p.x-n.x));
  blitRaditz(c,raditzFrame(talking===n?'talk':'idle',dir,clock),n.x,n.y);
 }else{
  const sprite=root.KFCampaignCast?.getSprite(n.actor);
  if(!sprite||!ready(art.npcs))return;
  const dir=!p?'down':Math.abs(p.x-n.x)>Math.abs(p.y-n.y)*1.3?(p.x<n.x?'left':'right'):(p.y<n.y?'up':'down');
  const frame=root.KFCampaignCast.resolveFrame(sprite,dir,talking===n?'talk':'idle',clock*1000);
  const [sx,sy,w,h]=frame.rect,scale=.56;
  c.save();c.translate(n.x,n.y);c.imageSmoothingEnabled=false;
  c.fillStyle='#16291f90';c.beginPath();c.ellipse(0,3,8,3,0,0,Math.PI*2);c.fill();
  c.drawImage(art.npcs,sx,sy,w,h,-frame.feet[0]*scale,-frame.feet[1]*scale,w*scale,h*scale);c.restore();
 }
 if(n.actor==='raditz'&&state.stage==='victory')return;
 const top=n.y-(n.actor==='raditz'?60:54);
 label(c,n.name,n.x,top);
 const m=marker(n);if(m)bang(c,m,n.x,top+11);
}
function drawPickup(c,o){
 const glint=(Math.sin(clock*4+o.x)+1)/2;
 c.save();c.translate(Math.round(o.x),Math.round(o.y));
 c.fillStyle='#14282155';c.beginPath();c.ellipse(0,1,6,2,0,0,Math.PI*2);c.fill();
 const shard=[[-5,0],[-3,-4],[3,-5],[6,-2],[4,1]];
 c.fillStyle='#2b2930';c.beginPath();shard.forEach(([x,y],i)=>i?c.lineTo(x,y+1):c.moveTo(x-1,y+1));c.closePath();c.fill();
 c.fillStyle='#d9d4cc';c.beginPath();shard.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();
 c.fillStyle=`rgba(255,255,255,${.35+.65*glint})`;c.fillRect(-1+Math.round(glint*3),-4,2,1);
 c.restore();
 bang(c,'!',o.x,o.y-12);
}
function drawPlace(c,o){
 if(o.sign){
  c.save();c.translate(o.x,o.y);
  c.fillStyle='#4a3024';c.fillRect(-1,-14,3,14);
  c.fillStyle='#8a6038';c.fillRect(-13,-22,27,10);c.fillStyle='#c79a62';c.fillRect(-12,-21,25,2);
  c.fillStyle='#2a1c14';c.font='bold 5px system-ui';c.textAlign='center';c.fillText('TRAIN',0,-14);
  c.restore();
  label(c,o.name,o.x,o.y-27);
  return;
 }
 const active=placeAvailable(o);
 if(o.training||active)label(c,o.name,o.x,o.y-14);
 if(active)bang(c,'!',o.x,o.y-3);
 if(o.training){
  // meditation mat
  c.save();c.translate(o.x,o.y);c.fillStyle='#3c2d4a';c.beginPath();c.ellipse(0,0,10,4,0,0,Math.PI*2);c.fill();
  c.strokeStyle='#d6b475';c.lineWidth=.8;c.stroke();c.restore();
  if(state.meditate>0){
   const p=G().player;c.save();c.strokeStyle='#8ff0ff';c.globalAlpha=.6+.3*Math.sin(clock*8);c.lineWidth=1.2;
   c.beginPath();c.arc(p.x,p.y-18,8+state.meditate*6,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,state.meditate/3));c.stroke();c.restore();
  }
 }
}
function placeAvailable(o){
 if(o.id==='inspect-pod')return state.stage==='investigate';
 if(o.quest)return Talk.questState(storyState(),o.quest)==='active';
 return false;
}
function objects(){
 if(!G()?.player)return [];
 const list=[];
 for(const b of buildings)list.push({x:b.x,y:b.y,storyDraw:c=>drawBuilding(c,b)});
 list.push({x:pod.x,y:pod.y,storyDraw:c=>drawBuilding(c,{...pod,sink:8})});
 for(const [x,y,s,layout] of rocks)list.push({x,y,storyDraw:c=>drawRocks(c,{x,y,s,layout})});
 for(const n of npcs)list.push({x:n.x,y:n.y,storyDraw:c=>drawNpc(c,n)});
 for(const o of places)list.push({x:o.x,y:o.y,storyDraw:c=>drawPlace(c,o)});
 for(const o of pickups)if(Talk.questState(storyState(),'pod-scrap')==='active'&&!state.collected.has(o.id))list.push({x:o.x,y:o.y,storyDraw:c=>drawPickup(c,o)});
 if(scene){
  list.push({x:scene.raditz.x,y:scene.raditz.y-.5,storyDraw:drawSceneActors});
  list.push({x:scene.raditz.x,y:scene.raditz.y+60,storyDraw:drawScene});   // after the actors, still inside the view
 }
 return list;
}

// ------------------------------------------------------------- talking
let talking=null;
const near=(o,r)=>{const p=G().player;return Math.hypot(p.x-o.x,p.y-o.y)<r};
function nearby(){
 if(!G()?.player||!inStory())return null;
 for(const n of npcs){if(n.actor==='raditz'&&stageAtLeast('fight'))continue;if(near(n,30))return n}
 for(const o of places)if(near(o,26)&&(placeAvailable(o)||o.sign||o.training))return o;
 for(const o of pickups)if(Talk.questState(storyState(),'pod-scrap')==='active'&&!state.collected.has(o.id)&&near(o,18))return o;
 return null;
}
function interact(){
 const t=nearby();
 if(!t)return false;
 if(t.actor)openConversation(t);
 else if(t.sign)G().dialog(t.name,'Wooden dummies for practice. Strike them to train: they stand back up after a few seconds. Each one gives a little experience.',[{label:'Close',close:true}]);
 else if(t.training&&!placeAvailable(t))G().dialog(t.name,'A flat stone above the valley. Stand on the mat and hold Charge (R) to meditate. Focusing here grants experience once a minute.',[{label:'Close',close:true}]);
 else if(t.id&&t.id.startsWith('scrap-'))pickUp(t);
 else openPlace(t);
 return true;
}
function playLines(name,lines,done){
 let i=0;
 const show=()=>{
  root.KiAudio?.sfx('blip');
  const last=i===lines.length-1;
  G().dialog(name,lines[i],[{label:last?'Continue':'Next',primary:true,run:()=>{if(last)done();else{i++;show()}}}]);
 };
 show();
}
function openConversation(n){
 talking=n;
 const who=Talk.characters[n.actor];
 const due=Talk.topicsFor(n.actor,storyState()).find(t=>t.main&&!state.seen.has(t.id));
 root.KiAudio?.sfx('select');
 if(due)playTopic(n,due);
 else playLines(who.name,Talk.greetingFor(n.actor,storyState()),()=>topicMenu(n));
}
function topicMenu(n){
 const who=Talk.characters[n.actor];
 const topics=Talk.topicsFor(n.actor,storyState()).filter(t=>!t.main||!state.seen.has(t.id));
 const buttons=topics.map(t=>({label:(t.start||t.finish?'◆ ':'')+t.label,seen:state.seen.has(t.id)&&!t.main,run:()=>{root.KiAudio?.sfx('confirm');playTopic(n,t)}}));
 buttons.push({label:'Goodbye',close:true});
 G().dialog(who.name,topics.length?'What do you want to talk about?':Talk.greetingFor(n.actor,storyState())[0],buttons);
}
function playTopic(n,topic){
 state.seen.add(topic.id);
 playLines(Talk.characters[n.actor].name,topic.lines,()=>{
  applyEffects(topic);
  if(topic.fight){G().closeDialog();talking=null;return}
  topicMenu(n);
 });
}
const REWARDS={
 'pod-scrap':{xp:70,item:'capsule_band',text:'Capsule Band'},
 'ki-focus':{xp:110,item:'weighted_cape',text:'Weighted Cape'},
 'raider-bounty':{xp:140,item:'wind_charm',text:'Wind Charm'},
};
function applyEffects(e){
 const g=G();
 if(e.next){state.stage=e.next;root.KiAudio?.sfx('quest');g.notice('NEW OBJECTIVE · '+objective().toUpperCase())}
 if(e.start){state.quests[e.start]={count:0};root.KiAudio?.sfx('quest');g.notice('NEW QUEST · '+Talk.quests[e.start].title.toUpperCase())}
 if(e.finish){
  state.quests[e.finish].done=true;
  const r=REWARDS[e.finish];
  if(r&&!state.rewards.has(e.finish)){state.rewards.add(e.finish);g.grantExperience(r.xp);if(r.item)g.collectItem(r.item)}
  root.KiAudio?.sfx('levelUp');
  g.notice('QUEST COMPLETE · +'+(r?.xp||0)+' XP'+(r?.item?' · '+r.text.toUpperCase():''));
 }
 if(e.fight)startFight();
 g.save();
}
function openPlace(o){
 const entry=Talk.places[o.id];
 if(!entry)return;
 playLines(o.name,entry.lines,()=>{
  G().closeDialog();
  if(o.quest){state.quests[o.quest].count=Talk.quests[o.quest].goal;root.KiAudio?.sfx('quest');G().notice('YOU SENSED HIS ENERGY · TELL PICCOLO')}
  else if(entry.next)applyEffects({next:entry.next});
  G().save();
 });
}
function pickUp(o){
 state.collected.add(o.id);
 state.quests['pod-scrap'].count++;
 root.KiAudio?.sfx('pickup');
 const left=Talk.quests['pod-scrap'].goal-state.quests['pod-scrap'].count;
 G().notice(left>0?`POD PLATING · ${left} MORE TO FIND`:'ALL PLATING FOUND · RETURN TO BULMA');
 G().save();
}

// ------------------------------------------------------------- combat hooks
function startFight(){
 const g=G();
 g.spawnEnemy({id:'raditz',kind:'raditz',level:6,x:raditzHome.x,y:raditzHome.y,radius:150,boss:true});
 root.KiAudio?.music('battle');
 g.notice('RADITZ ATTACKS!');
}
function spawn(){
 // called after the engine (re)builds its enemy list
 const g=G();
 if(state.stage==='fight'&&!raditzDown&&!g.enemies().some(e=>e.id==='raditz'))startFight();
}
function finishRaditz(x,y){
 raditzDown=true;
 state.stage='victory';
 state.raditzAt=[Math.round(x),Math.round(y)];
 if(!state.rewards.has('raditz')){state.rewards.add('raditz');G().grantExperience(300);G().collectItem('saiyan_scouter')}
 root.KiAudio?.sfx('levelUp');
 G().notice('RADITZ DEFEATED · +300 XP · SAIYAN SCOUTER');
 G().save();
}

// ------------------------------------------------------------- finisher cutscene
// When Raditz is worn down, Goku pins him and Piccolo fires the Special Beam
// Cannon through them both (the approved Chapter One ending).
let scene=null;
const FINISH_AT=.28;
const SCENE_END=4.2;
function beginFinisher(e){
 const g=G();
 const side=e.x+110<2740?1:-1;            // Piccolo stands on this side
 scene={t:0,side,raditz:{x:e.x,y:e.y},piccolo:{x:e.x+side*104,y:e.y},cues:new Set()};
 g.removeEnemy('raditz');
 // Goku pins him from behind: just behind Raditz (drawn first), facing Piccolo too
 Object.assign(g.player,{x:e.x-side*8,y:e.y-1,vx:0,vy:0,fx:side,fy:0,faceAngle:side>0?0:Math.PI,cardinal:'right',walking:false,walkSettle:0,stride:0,attack:0,hurt:0});
 g.cinematic(true);
 root.KiAudio?.music(null);
}
function cinematic(dt){
 if(!scene)return;
 scene.t+=dt;
 const t=scene.t,g=G();
 const cue=(at,name,fn)=>{if(t>=at&&!scene.cues.has(name)){scene.cues.add(name);fn()}};
 cue(0,'hold',()=>g.notice('GOKU: PICCOLO, NOW! I CAN’T HOLD HIM FOR LONG!'));
 cue(.7,'charge',()=>{root.KiAudio?.sfx('charge');g.notice('RADITZ: LET GO OF ME, KAKAROT!')});
 cue(1.6,'charge2',()=>root.KiAudio?.sfx('charge'));
 cue(2.1,'call',()=>g.notice('PICCOLO: SPECIAL BEAM CANNON!'));
 cue(2.4,'fire',()=>{root.KiAudio?.sfx('beam');g.shake(.35)});
 cue(3.0,'hit',()=>g.shake(.2));
 if(t>=SCENE_END){
  const at=scene.raditz;
  scene=null;
  g.cinematic(false);
  finishRaditz(at.x,at.y);
  root.KiAudio?.music('ridge');
  playLines('Standoff Ridge',[
   'Goku held his brother in place, and Piccolo’s beam tore through them both.',
   'Raditz: “You fool... my comrades will come for this planet. Two Saiyans, far stronger than me.”',
   'Goku fell beside his brother. Far above the clouds, a voice called his name.',
   'Chapter One complete. Chapter Two, “Rivals on Snake Way”, comes next. Until then the world is yours to explore.'
  ],()=>{G().closeDialog();G().notice('CHAPTER ONE COMPLETE')});
 }
}
// Charge orb, spiral beam and flash, drawn in world space above everything.
function drawScene(c){
 if(!scene)return;
 const t=scene.t,{side,raditz:r,piccolo:p}=scene;
 const fx=p.x-side*5,fy=p.y-27;               // two fingers at the forehead / chest height of the target               // fingertips at the forehead
 c.save();c.imageSmoothingEnabled=false;
 if(t>.7&&t<2.45){
  const k=Math.min(1,(t-.7)/1.5),rad=1+k*1.6+Math.sin(t*40)*.4;
  c.fillStyle='#fff6b0';c.beginPath();c.arc(fx,fy,rad,0,Math.PI*2);c.fill();
  c.strokeStyle='#ffd34d';c.lineWidth=.6;c.beginPath();c.arc(fx,fy,rad+1.2+Math.sin(t*25)*.5,0,Math.PI*2);c.stroke();
  for(let i=0;i<6;i++){const a=t*9+i*1.05,d=3+((t*30+i*7)%6);c.fillStyle=i%2?'#ffe98a':'#ffffff';c.fillRect(Math.round(fx+Math.cos(a)*d),Math.round(fy+Math.sin(a)*d*.7),1,1)}
 }
 if(t>=2.4&&t<3.4){
  const k=Math.min(1,(t-2.4)/.18),fade=t>3.1?1-(t-3.1)/.3:1;
  const len=320*k,dir=-side,x0=dir>0?fx:fx-len;
  c.globalAlpha=fade;
  c.fillStyle='#ffe066';c.fillRect(x0,fy-1,len,3);
  c.fillStyle='#fffbe0';c.fillRect(x0,fy,len,1);
  for(let i=0;i<len;i+=2){
   const ph=i*.22-t*30,y=Math.sin(ph)*3,front=Math.cos(ph)>0;
   c.fillStyle=front?'#c78bff':'#7a3fb8';
   c.fillRect(Math.round(fx+dir*i),Math.round(fy+y),1,1);
  }
  if(dir>0?fx+len>=r.x:fx-len<=r.x){
   c.fillStyle='#ffffff';c.beginPath();c.arc(r.x,fy,2.5+Math.sin(t*50),0,Math.PI*2);c.fill();
   c.strokeStyle='#ffe066';c.lineWidth=.7;c.beginPath();c.arc(r.x,fy,4+((t*60)%4),0,Math.PI*2);c.stroke();
  }
 }
 if(t>=2.42&&t<2.82){c.globalAlpha=Math.max(0,.45-(t-2.42)*1.1);c.fillStyle='#ffffff';c.fillRect(r.x-500,r.y-400,1000,800)}
 c.restore();
}
function drawSceneActors(c){
 if(!scene)return;
 const t=scene.t,{side,raditz:r}=scene;
 const dir=side>0?'right':'left';
 const frame=t<2.5?raditzFrame('restrained',dir,t):raditzFrame('knockdown',dir,0,Math.max(0,Math.min(.99,(t-2.6)/1.2)));
 blitRaditz(c,frame,r.x,r.y,1,t>2.4&&t<2.8?1:0);
}

function onDefeat(e){
 if(e.id==='raditz'){finishRaditz(e.x,e.y);return}
 if(e.storyCamp){
  respawn[e.id]=clock+(e.kind==='dummy'?6:28);
  if(e.storyCamp!=='training'&&regionAt(e.homeX)?.id===RAIDER_REGION){
   const q=state.quests['raider-bounty'];
   if(q&&!q.done&&q.count<Talk.quests['raider-bounty'].goal){
    q.count++;
    const left=Talk.quests['raider-bounty'].goal-q.count;
    G().notice(left>0?`RAIDERS · ${left} MORE`:'RAIDERS CLEARED · RETURN TO BULMA');
    G().save();
   }
  }
 }
}

function update(dt){
 clock+=dt;
 const g=G();
 if(!g?.player)return;
 const p=g.player;
 // music follows the region (battle while Raditz is up)
 const region=regionAt(p.x);
 const theme=state.stage==='fight'&&g.enemies().some(e=>e.id==='raditz')&&region?.id==='ridge'?'battle':region?region.music:'village';
 if(theme!==lastRegion){lastRegion=theme;root.KiAudio?.music(theme)}
 if(!g.isPlaying())return;
 if(state.stage==='fight'&&!scene){
  const boss=g.enemies().find(e=>e.id==='raditz');
  if(boss&&boss.hp>0&&boss.hp<=boss.max*FINISH_AT&&near(boss,160)){beginFinisher(boss);return}
 }
 // camps and training dummies come back after a while, only when nearby
 const live=new Set(g.enemies().map(e=>e.id));
 const want=[];
 dummies.forEach((d,i)=>want.push({id:'dummy-'+i,kind:'dummy',x:d.x,y:d.y,radius:1,storyCamp:'training'}));
 for(const camp of camps)camp.kinds.forEach((kind,i)=>want.push({id:camp.id+'-'+i,kind,variant:VARIANT[kind],level:camp.level,x:camp.x+(i-1)*22,y:camp.y+(i%2)*14,radius:70,storyCamp:camp.id}));
 for(const w of want){
  if(live.has(w.id)||(respawn[w.id]||0)>clock)continue;
  if(Math.abs(p.x-w.x)>420)continue;
  if(Math.hypot(p.x-w.x,p.y-w.y)<120)continue;     // never pop in next to the player
  g.spawnEnemy(w);
 }
 // meditation training at the lookout
 const look=places.find(o=>o.training);
 if(near(look,16)&&g.charging()){
  state.meditate+=dt;
  if(state.meditate>=3){
   state.meditate=0;
   if(placeAvailable(look)){openPlace(look);return}
   if(clock>=state.meditateReady){
    state.meditateReady=clock+60;
    const xp=25+5*(p.level||1);
    g.grantExperience(xp);root.KiAudio?.sfx('quest');g.notice('MEDITATION · +'+xp+' XP');g.save();
   }else g.notice('YOUR FOCUS NEEDS REST · '+Math.ceil(state.meditateReady-clock)+'S');
  }
 }else state.meditate=Math.max(0,state.meditate-dt*2);
}

// ------------------------------------------------------------- HUD hooks
const OBJECTIVES={
 briefing:'Head east past the dojo to Kame Coast. Bulma is waiting by the road.',
 investigate:'Follow the road east to Landing Ravine and inspect the impact site.',
 'meet-piccolo':'Continue east to Standoff Ridge and find Piccolo.',
 confront:'Approach the traveler on Standoff Ridge.',
 challenge:'Talk to Raditz. Recommended level 5: train at the coast and ravine first.',
 fight:'Defeat Raditz on Standoff Ridge.',
 victory:'Chapter One complete! Talk to Piccolo and Bulma, or keep training.',
};
function objective(){
 if(!G()?.player)return null;
 if(!inStory()&&state.stage==='briefing')return null;
 return OBJECTIVES[state.stage];
}
function targets(){
 const s=state.stage;
 if(s==='briefing')return [npcs[0]];
 if(s==='investigate')return [places[0]];
 if(s==='meet-piccolo')return [npcs[1]];
 if(s==='confront'||s==='challenge')return [npcs[2]];
 if(s==='fight')return [raditzHome];
 return [];
}
function region(x){return regionAt(x)?.name||null}

// ------------------------------------------------------------- save / load
function save(){return {raditzAt:state.raditzAt,stage:state.stage,seen:[...state.seen],quests:state.quests,collected:[...state.collected],rewards:[...state.rewards]}}
function load(data){
 state.stage=Talk.stages.includes(data?.stage)?data.stage:'briefing';
 state.seen=new Set(Array.isArray(data?.seen)?data.seen:[]);
 state.collected=new Set(Array.isArray(data?.collected)?data.collected:[]);
 state.rewards=new Set(Array.isArray(data?.rewards)?data.rewards:[]);
 state.quests={};
 for(const [id,q] of Object.entries(data?.quests||{}))if(Talk.quests[id]&&Number.isInteger(q?.count))state.quests[id]={count:q.count,done:!!q.done};
 raditzDown=state.stage==='victory';
 state.raditzAt=Array.isArray(data?.raditzAt)&&data.raditzAt.length===2?data.raditzAt:null;
 lastRegion=null;
 for(const k of Object.keys(respawn))delete respawn[k];
}

root.KiStory={cinematic,drawRaditz,paintGround,clear,solid,objects,nearby,interact,update,onDefeat,spawn,objective,targets,region,save,load,
 get stage(){return state.stage}, regions:REGIONS};
})(typeof window!=='undefined'?window:globalThis);
