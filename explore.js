/* Exploration across the open world (overworld.js): landmarks to
 * investigate, seven Dragon Balls hidden around the planet, and regional
 * enemy camps whose level rises the farther you travel from Cedar Valley.
 *
 * Hooks the engine through window.KiGame like story-mode.js does, and
 * exposes window.KiExplore {objects, nearby, interact, update, onDefeat,
 * solid, region, sites, save, load}.
 * Buildings reuse assets/campaign-buildings.png (frames per
 * assets/campaign-buildings.json); Dragon Balls are small effect sprites.
 * Original text written for this game.
 */
(function(root){
'use strict';
const World=()=>root.KiWorld;
const G=()=>root.KiGame;
const img=src=>{const i=new Image();i.src=src;return i};
const buildingsArt=img('assets/campaign-buildings.png?v=3');
const ready=i=>i.complete&&i.naturalWidth>0;
const BUILDING={
 'dome-home':{frame:0,w:105,h:97,solidW:88,solidH:28},
 'dome-hut':{frame:1,w:81,h:78,solidW:68,solidH:24},
 'sea-house':{frame:2,w:113,h:108,solidW:94,solidH:30},
 'round-tower':{frame:3,w:62,h:111,solidW:40,solidH:18},
 'crag':{frame:4,w:96,h:88,solidW:78,solidH:26},
 'pod':{frame:5,w:64,h:62,solidW:48,solidH:16},
};

// ------------------------------------------------------------ landmarks
// x, y: rough spot; placed on the nearest clear dry land when the module starts.
const SITES=[
 {id:'kame-house',name:'Kame House',x:2150,y:5235,radius:240,
  build:[['sea-house',0,0]],spot:[0,26],reward:{xp:140,item:'turtle_shell'},lines:[
  'A pink-roofed house on a tiny island, with a palm tree and a hammock strung by the door.',
  'A note is pinned to the door: “Gone fishing. Help yourself to the training shell by the steps. — The Master.”',
  'You find a heavy turtle shell pack. Wearing it will slow you down, but every fight will teach you more.']},
 {id:'capsule-village',name:'Capsule Village',x:2700,y:1480,radius:300,
  build:[['dome-home',0,0],['dome-hut',-120,40],['dome-hut',115,55]],spot:[0,30],reward:{xp:90},lines:[
  'Capsule homes stand in a ring around a well. A traveler can pop one open anywhere and live in it.',
  'A posted notice reads: “Raiders seen on the east road. Travelers, stick together past the red cliffs.”',
  'Someone left a basket of fresh peaches by the well for passing fighters. You take one and feel your strength return.'],heal:true},
 {id:'lake-dock',name:'Crystal Lake Hut',x:3650,y:2420,radius:220,
  build:[['dome-hut',0,0]],spot:[0,24],reward:{xp:80},lines:[
  'A fisherman’s hut on the shore of Crystal Lake. The water is so clear you can see the stones on the bottom.',
  'Scratched into the doorframe: “Something orange glows in the hills west of here at night. Not a firefly.”']},
 {id:'red-ruins',name:'Red Cliff Ruins',x:5350,y:1650,radius:280,
  build:[['crag',-70,0],['crag',85,30]],pillars:[[-20,-30],[20,-34],[-40,40],[40,44]],spot:[0,8],reward:{xp:160},lines:[
  'Broken pillars stand among the red rock. The carvings show warriors fighting in the sky, trailing light.',
  'One carving shows a single fighter holding back a huge shape with both hands. The stone is scorched around it.',
  'You trace the carving and feel your own ki stir in answer. Whoever made this knew how to fight.']},
 {id:'peak-tower',name:'Summit Watchtower',x:7350,y:1650,radius:240,
  build:[['round-tower',0,0]],spot:[0,22],reward:{xp:200,item:'summit_band'},lines:[
  'An old watchtower above the snow line. The stairs inside are worn smooth by centuries of climbers.',
  'At the top, the air is thin and sharp. Below you, the whole continent spreads out to the sea.',
  'A headband hangs on a nail by the window, stiff with frost. Breathing up here feels like training on its own.']},
 {id:'oasis',name:'Mirage Oasis',x:7550,y:4350,radius:260,
  pool:true,spot:[0,46],reward:{xp:150},heal:true,lines:[
  'A real pool of water in the middle of the Sunscar Desert, ringed with palms.',
  'Desert raiders have scratched marks into the trees, counting days. They wait here for travelers.',
  'You drink and rest in the shade. Your strength comes back.']},
 {id:'strange-crater',name:'Strange Crater',x:4350,y:5580,radius:220,
  build:[['pod',0,0]],crater:true,spot:[0,30],reward:{xp:180},lines:[
  'Another round pod, half buried at the bottom of a crater. It’s the same make as the one in the ravine.',
  'This one is old. Moss grows over the hatch, and the glass is cracked from the inside.',
  'Whoever came in this pod left the island a long time ago. How many of them have come to this planet?']},
 {id:'western-shrine',name:'Western Isle Shrine',x:850,y:4330,radius:220,
  shrine:true,spot:[0,18],reward:{xp:120,item:'sage_beads'},lines:[
  'A stone shrine on a windy hill, its roof patched with driftwood.',
  'A string of prayer beads lies on the altar with a note: “For a fighter who rows this far.”']},
];

// ------------------------------------------------------------ Dragon Balls
const BALLS=[[3350,900],[1100,3150],[5900,1000],[8550,2500],[6750,5150],[3200,3900],[2480,5480]];

// ------------------------------------------------------------ enemy camps
// [x, y, members [kind, variant], level]
const CAMPS=[
 [3150,1050,[['bandit','dune-raider'],['thug','rock-brute']],4],
 [1450,2450,[['ninja','wood-shade'],['ninja','wood-shade'],['bandit',null]],5],
 [2150,3350,[['ninja','wood-shade'],['thug','rock-brute']],6],
 [4500,1250,[['brute','waste-ogre'],['bandit','dune-raider']],7],
 [5800,2650,[['bandit','dune-raider'],['ninja','ravine-stalker'],['thug','rock-brute']],8],
 [6950,2000,[['soldier','frost-guard'],['soldier','frost-guard']],9],
 [8100,1050,[['soldier','frost-guard'],['brute','waste-ogre']],11],
 [6900,4000,[['bandit','sand-reaver'],['bandit','sand-reaver'],['soldier','ridge-sentry']],10],
 [8300,5000,[['bandit','sand-reaver'],['brute','waste-ogre']],12],
 [900,4150,[['thug','reef-pirate'],['thug','reef-pirate']],7],
 [6000,5900,[['thug','reef-pirate'],['ninja','ravine-stalker'],['thug','reef-pirate']],9],
 [3800,3250,[['soldier','ridge-sentry'],['ninja','wood-shade']],6],
];

const state={seen:new Set(),balls:new Set(),wish:false};
const camps=[];
let clock=0,placed=false;

// Move a spot onto dry, clear land (spiral search) so nothing stands in the sea.
function findLand(x,y,clearR){
 const K=World();
 const dry=(px,py)=>{const b=K.sample(px,py).biome;return !['deep','sea','shallow','road'].includes(b)};
 const ok=(px,py)=>{
  if(K.inValley(px,py))return false;
  for(let a=0;a<8;a++)if(!dry(px+Math.cos(a*Math.PI/4)*clearR,py+Math.sin(a*Math.PI/4)*clearR*.7))return false;
  return dry(px,py);
 };
 if(ok(x,y))return [x,y];
 for(let r=30;r<900;r+=30)for(let a=0;a<24;a++){
  const px=x+Math.cos(a*Math.PI/12)*r,py=y+Math.sin(a*Math.PI/12)*r;
  if(ok(px,py))return [Math.round(px),Math.round(py)];
 }
 return [x,y];
}
function place(){
 if(placed||!World())return;
 placed=true;
 const K=World();
 for(const s of SITES){
  [s.x,s.y]=findLand(s.x,s.y,s.pool?110:s.build?.length>1?150:80);
  K.reserve?.(s.x,s.y+10,s.pool?150:s.build?.length>1?190:110);
 }
 BALLS.forEach((b,i)=>{const [x,y]=findLand(b[0],b[1],20);BALLS[i]=[x,y];K.reserve?.(x,y,26)});
 for(const [x0,y0,members,level] of CAMPS){
  const [x,y]=findLand(x0,y0,60);
  camps.push({id:`wild-${Math.round(x0)}-${Math.round(y0)}`,x,y,members,level,respawnAt:0});
 }
}

// ------------------------------------------------------------ drawing
function shadow(c,w,k){c.fillStyle='#0d160f55';c.beginPath();c.ellipse(0,0,w*.48,w*k,0,0,Math.PI*2);c.fill()}
function drawBuilding(c,kind,x,y){
 const b=BUILDING[kind];if(!ready(buildingsArt))return;
 c.save();c.translate(x,y);c.imageSmoothingEnabled=false;shadow(c,b.w,.09);
 const h=b.h*224/200;
 c.drawImage(buildingsArt,b.frame*224,0,224,224,-b.w/2,-h+4+(kind==='pod'?8:0),b.w,h);
 c.restore();
}
function label(c,text,x,y){
 c.save();c.font='bold 5.2px Verdana,system-ui';c.textAlign='center';c.lineWidth=1.7;c.lineJoin='round';
 c.strokeStyle='#1c271f';c.fillStyle='#ffe5a7';c.strokeText(text,x,y);c.fillText(text,x,y);c.restore();
}
function mark(c,x,y){
 const bob=Math.sin(clock*5.5)*1.5;
 c.save();c.textAlign='center';c.font='bold 11px system-ui';c.lineWidth=3;c.strokeStyle='#1c271f';c.fillStyle='#ffd36b';
 c.strokeText('?',x,y+bob);c.fillText('?',x,y+bob);c.restore();
}
function drawPillar(c,x,y,h,broken){
 c.save();c.translate(x,y);
 c.fillStyle='#0d160f44';c.beginPath();c.ellipse(0,0,8,3,0,0,Math.PI*2);c.fill();
 c.fillStyle='#6e3f2c';c.fillRect(-6,-3,12,3);
 c.fillStyle='#b8775a';c.fillRect(-4,-h,8,h-2);
 c.fillStyle='#d79a78';c.fillRect(-4,-h,2,h-2);
 c.fillStyle='#7d4a36';c.fillRect(2,-h,2,h-2);
 for(let k=-h+6;k<-4;k+=7){c.fillStyle='#7d4a3688';c.fillRect(-4,k,8,1)}
 if(broken){c.fillStyle='#b8775a';c.beginPath();c.moveTo(-4,-h);c.lineTo(-1,-h-4);c.lineTo(2,-h+1);c.lineTo(4,-h-2);c.lineTo(4,-h);c.fill()}
 else{c.fillStyle='#d79a78';c.fillRect(-6,-h-3,12,3);c.fillStyle='#6e3f2c';c.fillRect(-6,-h,12,1)}
 c.restore();
}
function drawPool(c,x,y){
 c.save();c.translate(x,y);
 c.fillStyle='#c9a66a';c.beginPath();c.ellipse(0,0,62,26,0,0,Math.PI*2);c.fill();
 c.fillStyle='#6f9a5a';c.beginPath();c.ellipse(0,0,56,22,0,0,Math.PI*2);c.fill();
 c.fillStyle='#2f7f8f';c.beginPath();c.ellipse(0,1,48,18,0,0,Math.PI*2);c.fill();
 c.fillStyle='#4fb0b8';c.beginPath();c.ellipse(-4,-1,40,13,0,0,Math.PI*2);c.fill();
 c.fillStyle='#d8f4ee';for(let i=0;i<5;i++){const t=clock*.6+i*1.3;c.fillRect(-30+((i*23+t*6)%56),-6+i*3,6,1)}
 c.restore();
}
function drawPalm(c,x,y,flip){
 c.save();c.translate(x,y);if(flip)c.scale(-1,1);
 c.fillStyle='#0d160f44';c.beginPath();c.ellipse(0,0,10,3,0,0,Math.PI*2);c.fill();
 c.fillStyle='#7a5532';for(let k=0;k<9;k++)c.fillRect(-2+Math.round(k*k*.06),-4-k*4,4,4);
 c.fillStyle='#9a6e42';for(let k=0;k<9;k+=2)c.fillRect(-2+Math.round(k*k*.06),-4-k*4,4,1);
 const tx=5,ty=-40;
 const leaf=(dx,dy,col)=>{c.strokeStyle=col;c.lineWidth=3;c.beginPath();c.moveTo(tx,ty);c.quadraticCurveTo(tx+dx*.5,ty+dy-8,tx+dx,ty+dy);c.stroke()};
 leaf(-18,8,'#2f6b34');leaf(18,9,'#2f6b34');leaf(-12,-4,'#3e8a3e');leaf(14,-3,'#3e8a3e');leaf(0,-9,'#57a548');leaf(-20,14,'#24552b');
 c.fillStyle='#5a3a1e';c.fillRect(tx-2,ty,3,3);c.fillRect(tx+1,ty+1,3,3);
 c.restore();
}
function drawShrine(c,x,y){
 c.save();c.translate(x,y);
 c.fillStyle='#0d160f55';c.beginPath();c.ellipse(0,0,30,8,0,0,Math.PI*2);c.fill();
 c.fillStyle='#8c8a80';c.fillRect(-26,-6,52,6);c.fillStyle='#b5b2a6';c.fillRect(-26,-6,52,2);
 c.fillStyle='#6f4a30';c.fillRect(-20,-34,4,28);c.fillRect(16,-34,4,28);
 c.fillStyle='#a7362c';c.fillRect(-28,-40,56,6);c.fillStyle='#d4553f';c.fillRect(-28,-40,56,2);
 c.fillStyle='#7b2a22';c.fillRect(-22,-30,44,3);
 c.fillStyle='#9d9a8c';c.fillRect(-6,-16,12,10);c.fillStyle='#c4c0b0';c.fillRect(-6,-16,12,2);
 c.restore();
}
function drawCrater(c,x,y){
 c.save();c.translate(x,y);
 const g=c.createRadialGradient(0,-4,4,0,-4,60);
 g.addColorStop(0,'#26190f');g.addColorStop(.5,'#47301f');g.addColorStop(.82,'#6f5a3a');g.addColorStop(1,'#6f5a3a00');
 c.fillStyle=g;c.beginPath();c.ellipse(0,-4,62,30,0,0,Math.PI*2);c.fill();
 c.fillStyle='#4d7a3c';for(let i=0;i<14;i++){const a=i*2.4;c.fillRect(Math.cos(a)*44,Math.sin(a)*20-4,3,2)}
 c.restore();
}
function drawBall(c,x,y,stars){
 const glow=.55+.45*Math.sin(clock*3+x);
 c.save();c.translate(x,y);
 c.fillStyle='#0d160f55';c.beginPath();c.ellipse(0,0,5,2,0,0,Math.PI*2);c.fill();
 const hy=-6+Math.sin(clock*2.4+y)*1.2;
 c.globalAlpha=.35*glow;c.fillStyle='#ffb347';c.beginPath();c.arc(0,hy,10,0,Math.PI*2);c.fill();c.globalAlpha=1;
 c.fillStyle='#a8480c';c.beginPath();c.arc(0,hy,4.6,0,Math.PI*2);c.fill();
 c.fillStyle='#f08a1c';c.beginPath();c.arc(-.4,hy-.4,3.9,0,Math.PI*2);c.fill();
 c.fillStyle='#ffd27a';c.fillRect(-2.6,hy-3,2,1.4);
 c.fillStyle='#c4160e';
 const pts=[[0,0],[-1.6,-1],[1.6,1],[-1.6,1],[1.6,-1],[0,-1.8],[0,1.8]].slice(0,stars);
 for(const [sx,sy] of pts)c.fillRect(sx-.5,hy+sy-.5,1,1);
 if(glow>.9){c.fillStyle='#fff6d0';c.fillRect(3,hy-7,1,3);c.fillRect(2,hy-6,3,1)}
 c.restore();
}
function drawSite(c,s){
 if(s.crater)drawCrater(c,s.x,s.y);
 if(s.pool){drawPool(c,s.x,s.y);drawPalm(c,s.x-70,s.y-6,false);drawPalm(c,s.x+72,s.y+4,true);drawPalm(c,s.x+40,s.y-30,true)}
}
function objects(vx,vy,w,h){
 place();
 if(!G()?.player)return [];
 const out=[],inView=(x,y,m=140)=>x>vx-m&&x<vx+w+m&&y>vy-m&&y<vy+h+m;
 for(const s of SITES){
  if(!inView(s.x,s.y,260))continue;
  if(s.crater||s.pool)out.push({x:s.x,y:s.y-40,storyDraw:c=>drawSite(c,s)});
  for(const [kind,dx,dy] of s.build||[])out.push({x:s.x+dx,y:s.y+dy,storyDraw:c=>drawBuilding(c,kind,s.x+dx,s.y+dy)});
  for(const [dx,dy] of s.pillars||[])out.push({x:s.x+dx,y:s.y+dy,storyDraw:c=>drawPillar(c,s.x+dx,s.y+dy,dy<0?30:22,dx>0)});
  if(s.shrine)out.push({x:s.x,y:s.y,storyDraw:c=>drawShrine(c,s.x,s.y)});
  const sx=s.x+s.spot[0],sy=s.y+s.spot[1];
  out.push({x:sx,y:sy+200,storyDraw:c=>{
   const p=G().player,d=Math.hypot(p.x-sx,p.y-sy);
   if(d<160)label(c,s.name,sx,sy-((BUILDING[s.build?.[0]?.[0]]?.h||40)+14));
   if(!state.seen.has(s.id))mark(c,sx,sy-8);
  }});
 }
 BALLS.forEach(([x,y],i)=>{if(!state.balls.has(i)&&inView(x,y))out.push({x,y,storyDraw:c=>drawBall(c,x,y,i+1)})});
 return out;
}

// ------------------------------------------------------------ collision
function solid(x,y){
 for(const s of SITES){
  if(Math.abs(x-s.x)>200||Math.abs(y-s.y)>140)continue;
  for(const [kind,dx,dy] of s.build||[]){
   const b=BUILDING[kind],bx=s.x+dx,by=s.y+dy;
   if(Math.abs(x-bx)<b.solidW/2&&y>by-b.solidH&&y<by+2)return true;
  }
  for(const [dx,dy] of s.pillars||[])if(Math.abs(x-s.x-dx)<6&&Math.abs(y-s.y-dy+1)<3)return true;
  if(s.pool&&((x-s.x)/50)**2+((y-s.y)/20)**2<1)return true;
  if(s.shrine&&Math.abs(x-s.x)<26&&y>s.y-7&&y<s.y+1)return true;
 }
 return false;
}

// ------------------------------------------------------------ interaction
const near=(x,y,r)=>{const p=G().player;return Math.hypot(p.x-x,p.y-y)<r};
function nearby(){
 if(!G()?.player)return null;
 for(const s of SITES)if(near(s.x+s.spot[0],s.y+s.spot[1],30))return {site:s};
 for(let i=0;i<BALLS.length;i++)if(!state.balls.has(i)&&near(BALLS[i][0],BALLS[i][1],22))return {ball:i};
 return null;
}
function read(name,lines,done){
 let i=0;
 const show=()=>{const last=i===lines.length-1;
  G().dialog(name,lines[i],[{label:last?'Done':'Next',primary:true,run:()=>{if(last){G().closeDialog();done?.()}else{i++;show()}}}])};
 show();
}
function interact(){
 const t=nearby();if(!t)return false;
 const g=G();
 if(t.site){
  const s=t.site,first=!state.seen.has(s.id);
  read(s.name,first?s.lines:[s.lines[0]],()=>{
   if(s.heal){const p=g.player;p.hp=p.max??p.hp;p.ki=p.mki??p.ki}
   if(!first){if(s.heal)g.notice('RESTED · HEALTH AND KI RESTORED');return}
   state.seen.add(s.id);root.KiAudio?.sfx('quest');
   g.grantExperience(s.reward.xp);if(s.reward.item)g.collectItem(s.reward.item);
   g.notice(`DISCOVERED · ${s.name.toUpperCase()} · +${s.reward.xp} XP`);
   g.save();
  });
  return true;
 }
 if(t.ball!=null){
  state.balls.add(t.ball);root.KiAudio?.sfx('quest');
  const n=state.balls.size;
  if(n<7){g.notice(`DRAGON BALL · ${t.ball+1}-STAR · ${n}/7`);g.grantExperience(40);g.save();return true}
  g.save();
  g.dialog('The Eternal Dragon','The sky goes dark. All seven Dragon Balls blaze with light, and a voice like thunder speaks: “You have gathered the Dragon Balls. Name your wish.”',[
   {label:'Make me stronger',primary:true,run:()=>wish('power')},
   {label:'Give me training gear',run:()=>wish('gear')}]);
  return true;
 }
 return false;
}
function wish(kind){
 const g=G();state.wish=true;g.closeDialog();
 if(kind==='power'){g.grantExperience(700);g.notice('WISH GRANTED · +700 XP')}
 else{g.collectItem('dragon_gi');g.grantExperience(200);g.notice('WISH GRANTED · DRAGON GI')}
 g.shake?.(.3);root.KiAudio?.sfx('quest');
 // the balls scatter across the world again for another hunt
 setTimeout(()=>{state.balls.clear();g.notice('THE DRAGON BALLS SCATTER ACROSS THE WORLD');g.save()},2200);
}

// ------------------------------------------------------------ camps
function update(dt){
 place();clock+=dt;
 const g=G(),p=g?.player;if(!p||!g.isPlaying())return;
 const live=g.enemies();
 for(const camp of camps){
  const d=Math.hypot(p.x-camp.x,p.y-camp.y);
  const ids=camp.members.map((_,i)=>camp.id+'-'+i);
  const alive=ids.filter(id=>live.some(e=>e.id===id&&e.hp>0));
  if(d>1500&&alive.length){ids.forEach(id=>g.removeEnemy(id));camp.spawned=false;continue}
  if(camp.spawned&&!alive.length){camp.spawned=false;camp.respawnAt=clock+60}
  if(!camp.spawned&&d<750&&d>260&&clock>=camp.respawnAt){
   camp.spawned=true;
   camp.members.forEach(([kind,variant],i)=>g.spawnEnemy({id:ids[i],kind,variant:variant||undefined,level:camp.level,
    x:camp.x+(i-1)*24,y:camp.y+(i%2)*16,radius:110,wild:true}));
  }
 }
}
function onDefeat(e){
 if(!e.wild)return;
 const camp=camps.find(c=>e.id.startsWith(c.id+'-'));
 if(camp&&!G().enemies().some(o=>o.id!==e.id&&o.id.startsWith(camp.id+'-')&&o.hp>0))
  G().notice(`CAMP CLEARED · LV ${camp.level}`);
}

function region(x,y){
 for(const s of SITES)if(Math.hypot(x-s.x,y-s.y)<s.radius)return s.name;
 return null;
}
function save(){return {seen:[...state.seen],balls:[...state.balls],wish:state.wish}}
function load(d){
 state.seen=new Set(Array.isArray(d?.seen)?d.seen.filter(id=>SITES.some(s=>s.id===id)):[]);
 state.balls=new Set(Array.isArray(d?.balls)?d.balls.filter(i=>Number.isInteger(i)&&i>=0&&i<7):[]);
 state.wish=!!d?.wish;
}
function sites(){place();return SITES.map(s=>({id:s.id,name:s.name,x:s.x,y:s.y,seen:state.seen.has(s.id)}))}
function balls(){place();return {found:state.balls.size,left:BALLS.filter((_,i)=>!state.balls.has(i)).map(([x,y])=>({x,y}))}}

root.KiExplore={objects,nearby,interact,update,onDefeat,solid,region,sites,balls,save,load};
})(typeof window!=='undefined'?window:globalThis);
