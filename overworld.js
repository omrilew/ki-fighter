/* Ki Fighter overworld: the planet around the Cedar valley.
 *
 * The valley (0..2760 x 0..560) keeps its hand-painted map; everything else
 * is generated from deterministic noise and painted in 256 px chunks on
 * demand, so the world can be large without large memory or slow frames.
 *
 *   KiWorld.W, KiWorld.H            world size in world px
 *   KiWorld.sample(x,y)             {biome, e} at a point
 *   KiWorld.drawGround(c,vx,vy,w,h) paint the visible ground (screen space)
 *   KiWorld.objects(vx,vy,w,h)      y-sorted drawables (trees, rocks, mesas)
 *   KiWorld.solid(x,y)              water and scenery collision outside the valley
 *   KiWorld.water(x,y)              open water (fly over it)
 *   KiWorld.region(x,y)             place name for the HUD
 *   KiWorld.music(x,y)              music track for the place
 *   KiWorld.mapImage()              low-res picture of the whole world for maps
 */
(function(root){
'use strict';
const W=9600,H=6400;                 // world size
const VW=2760,VH=560;                // hand-painted Cedar valley
const CHUNK=256,SCALE=2.5;           // chunk size (world px) and paint scale
const inValley=(x,y)=>x<VW&&y<VH;

// ------------------------------------------------------------ noise
function mulberry(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const PERM=new Uint8Array(512);
{const r=mulberry(4711),p=[...Array(256).keys()];for(let i=255;i>0;i--){const j=Math.floor(r()*(i+1));[p[i],p[j]]=[p[j],p[i]]}for(let i=0;i<512;i++)PERM[i]=p[i&255]}
const grad=(ix,iy)=>PERM[(PERM[ix&255]+iy)&255]/255;
function vnoise(x,y){
 const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
 const u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
 const a=grad(ix,iy),b=grad(ix+1,iy),c=grad(ix,iy+1),d=grad(ix+1,iy+1);
 return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;
}
function fbm(x,y,oct=4){let s=0,amp=.5,f=1;for(let i=0;i<oct;i++){s+=amp*vnoise(x*f,y*f);f*=2.03;amp*=.5}return s/(1-Math.pow(.5,oct))}

// ------------------------------------------------------------ world shape
// Land is a union of soft blobs minus carved bays and lakes, roughened by noise.
const LAND=[
 [3300,2300,3500,2350],   // main continent (holds the Cedar valley in its north-west)
 [7500,1700,2300,1900],   // eastern highlands
 [7450,4250,1800,1500],   // desert peninsula
 [2150,5250,170,150],     // Kame island
 [4350,5600,330,260],     // southern isle
 [850,4350,460,380],      // western isle
 [6000,5950,260,200],     // reef isle
 [9000,3300,300,500],     // far-east cape
];
const CARVE=[
 [1720,1000,300,620],     // Kame Bay: opens below Kame Coast
 [4300,2650,420,300],     // Crystal Lake
 [6350,3950,260,520],     // Serpent Strait between highlands and desert
];
function elevation(x,y){
 let e=-1;
 for(const [cx,cy,rx,ry] of LAND){const d=Math.hypot((x-cx)/rx,(y-cy)/ry);e=Math.max(e,1-d)}
 for(const [cx,cy,rx,ry] of CARVE){const d=Math.hypot((x-cx)/rx,(y-cy)/ry);if(d<1)e=Math.min(e,(d-1)*.9)}
 e+=(fbm(x/900,y/900,4)-.5)*.32;
 // keep the valley and its neighbourhood solid ground, except the coast's sea
 const bay=x>1490&&x<1950;
 if(x<VW+120&&y<VH+120&&!bay)e=Math.max(e,.25);
 if(bay&&y<VH+260)e=Math.min(e,-.12-.1*Math.min(1,(y-VH+40)/200));   // Kame Coast's sea opens into Kame Bay
 return e;
}
// Roads link the valley to every region (drawn into the ground, no scenery on them).
const ROADS=[
 [[2740,270],[3150,420],[3700,760],[4350,1120],[5150,1480],[5950,1720],[6700,2100],[7400,2350]],   // east road: wasteland, peaks
 [[352,560],[420,1050],[700,1650],[1150,2250],[1700,2850],[2150,3350],[2400,3900],[2550,4400]],     // south road: Deepwood to the southern shore
 [[2150,3350],[2900,3150],[3650,3000],[4000,3000],[4700,3150],[5400,3350],[5900,3650],[6500,4050],[7150,4400],[7700,4700]],   // lake road to the desert
 [[3700,760],[3900,1500],[4050,2250]],   // north shore of Crystal Lake
];
const SEGS=[];
for(const road of ROADS)for(let i=1;i<road.length;i++)SEGS.push([...road[i-1],...road[i]]);
function nearRoad(x,y){
 let best=1e9;
 for(const [ax,ay,bx,by] of SEGS){
  if(x<Math.min(ax,bx)-40||x>Math.max(ax,bx)+40||y<Math.min(ay,by)-40||y>Math.max(ay,by)+40)continue;
  const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));
  // gentle meander so roads don't look ruler-straight
  const m=Math.sin((ax+t*dx)/140)*6+Math.sin((ay+t*dy)/97)*4;
  const L=Math.hypot(dx,dy);
  best=Math.min(best,Math.hypot(x-(ax+t*dx)-m*dy/L,y-(ay+t*dy)+m*dx/L));
 }
 return best;
}
const BIOMES={
 road:{base:[164,140,105],alt:[128,105,81]},
 deep:{base:[23,61,92],alt:[28,70,104]},
 sea:{base:[34,96,122],alt:[44,112,134]},
 shallow:{base:[63,143,149],alt:[78,158,160]},
 beach:{base:[217,192,138],alt:[196,172,120]},
 grass:{base:[79,106,56],alt:[58,88,52]},
 forest:{base:[44,74,46],alt:[36,62,42]},
 waste:{base:[156,104,66],alt:[126,82,54]},
 desert:{base:[216,182,120],alt:[198,160,100]},
 rock:{base:[112,108,98],alt:[90,88,82]},
 snow:{base:[226,234,238],alt:[200,212,222]},
};
function sample(x,y){
 const e=elevation(x,y);
 if(e<-.18)return {biome:'deep',e};
 if(e<-.04)return {biome:'sea',e};
 if(e<0)return {biome:'shallow',e};
 if(e<.045)return {biome:'beach',e};
 const n=fbm(x/700+40,y/700+40,3);
 if(nearRoad(x,y)<9)return {biome:'road',e};
 // regions, with domain-warped borders so they meet in natural curves
 const wx=x+(fbm(x/1300+11,y/1300+3,3)-.5)*1500,wy=y+(fbm(x/1300+71,y/1300+29,3)-.5)*1500;
 if(wx>6400&&wy<3100&&e>.16)return {biome:e>.4&&n>.45?'snow':'rock',e};
 if(wx>6100&&wy>3300)return {biome:'desert',e};
 if(wx>4500&&wx<6700&&wy>600&&wy<3700)return {biome:n>.63?'rock':'waste',e};
 return {biome:n>.56?'forest':'grass',e};
}
const isWater=b=>b==='deep'||b==='sea'||b==='shallow';
const isRoad=b=>b==='road';

// ------------------------------------------------------------ places
const PLACES=[
 {name:'Kame Bay',x:1720,y:1000,r:650,music:'coast'},
 {name:'Kame Island',x:2150,y:5250,r:260,music:'coast'},
 {name:'Crystal Lake',x:4300,y:2650,r:520,music:'coast'},
 {name:'Southern Isle',x:4350,y:5600,r:420,music:'coast'},
 {name:'Western Isle',x:850,y:4350,r:560,music:'coast'},
 {name:'Reef Isle',x:6000,y:5950,r:320,music:'coast'},
 {name:'Serpent Strait',x:6350,y:3950,r:600,music:'coast'},
];
function region(x,y){
 if(inValley(x,y))return null;
 for(const p of PLACES)if(Math.hypot(x-p.x,y-p.y)<p.r)return p.name;
 let {biome}=sample(x,y);
 if(isRoad(biome))biome=sample(x+24,y+24).biome==='road'?sample(x-30,y+30).biome:sample(x+24,y+24).biome;
 if(isRoad(biome))return 'Highway';
 if(isWater(biome))return y>4700?'Southern Sea':x<900?'Western Sea':'Open Sea';
 if(biome==='snow'||biome==='rock'&&x>6400)return 'Northern Peaks';
 if(biome==='desert')return 'Sunscar Desert';
 if(biome==='waste'||biome==='rock')return 'Red Wasteland';
 if(biome==='forest')return 'Deepwood';
 if(biome==='beach')return 'Coastline';
 return y<1800?'Cedar Plains':'Southern Plains';
}
function music(x,y){
 if(inValley(x,y))return null;
 for(const p of PLACES)if(Math.hypot(x-p.x,y-p.y)<p.r)return p.music;
 const {biome}=sample(x,y);
 if(isWater(biome)||biome==='beach')return 'coast';
 if(biome==='desert'||biome==='waste')return 'ravine';
 if(biome==='rock'||biome==='snow')return 'ridge';
 return 'village';
}

// ------------------------------------------------------------ chunk painting
// Spots kept free of trees and rocks (landmarks, Dragon Balls); see explore.js.
const RESERVED=[];
function reserve(x,y,r){RESERVED.push([x,y,r]);chunks.clear()}
const chunks=new Map();     // key -> {canvas, objects, solids}
const queue=[];
const MAX_CHUNKS=48;
const key=(cx,cy)=>cx+','+cy;
function paintChunk(cx,cy){
 const x0=cx*CHUNK,y0=cy*CHUNK,N=CHUNK/2;               // sample every 2 world px
 const small=document.createElement('canvas');small.width=small.height=N;
 const sctx=small.getContext('2d');
 const img=sctx.createImageData(N,N);
 const biomeGrid=new Array(N*N);
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){
  const x=x0+i*2+1,y=y0+j*2+1;
  const s=sample(x,y),b=BIOMES[s.biome];
  biomeGrid[j*N+i]=s.biome;
  const broad=fbm(x/90,y/90,2),fine=vnoise(x/9,y/9);
  const dry=s.biome==='waste'||s.biome==='desert'||s.biome==='rock';
  const k=Math.min(1,Math.max(0,(broad-.3)*(dry?2.2:1.6)+(fine-.5)*(dry?.5:.25)));
  let r=b.base[0]+(b.alt[0]-b.base[0])*k,g=b.base[1]+(b.alt[1]-b.base[1])*k,bl=b.base[2]+(b.alt[2]-b.base[2])*k;
  if(s.biome==='shallow'){const f=1-Math.min(1,-s.e/.04);r+=f*60;g+=f*55;bl+=f*40}           // lighter near the shore
  if(s.biome==='beach'&&s.e<.012){r=236;g=240;bl=228}                                          // foam line
  if(s.biome==='road'){const d=nearRoad(x,y);if(d>6){r*=.72;g*=.7;bl*=.68}else if(fine>.7){r+=18;g+=16;bl+=12}}
  const o=(j*N+i)*4;img.data[o]=r;img.data[o+1]=g;img.data[o+2]=bl;img.data[o+3]=255;
 }
 sctx.putImageData(img,0,0);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=CHUNK*SCALE;
 const g=canvas.getContext('2d');
 g.imageSmoothingEnabled=true;g.drawImage(small,0,0,canvas.width,canvas.height);
 g.scale(SCALE,SCALE);
 const rnd=mulberry(cx*7919+cy*104729+17);
 // grass blades and specks on land, wave glints on water
 for(let n=0;n<420;n++){
  const i=Math.floor(rnd()*N),j=Math.floor(rnd()*N),bio=biomeGrid[j*N+i];
  const x=i*2+rnd()*2,y=j*2+rnd()*2;
  if(isWater(bio)){
   if(n%3)continue;
   g.fillStyle=n%2?'#cfeef055':'#ffffff40';g.fillRect(x,y,2+rnd()*5,.6);
  }else if(bio==='grass'||bio==='forest'){
   const h=1+rnd()*3;g.strokeStyle=n%3?'#142f2d4d':'#b9bf7855';g.lineWidth=.22+rnd()*.4;
   g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+.2,y-h*.7,x+(rnd()-.5)*3,y-h);g.stroke();
  }else if(bio==='waste'||bio==='rock'){
   // dry cracks and pebbles
   g.strokeStyle='#3a24164d';g.lineWidth=.35;g.beginPath();g.moveTo(x,y);
   let cx=x,cy=y;for(let q=0;q<3;q++){cx+=(rnd()-.5)*5;cy+=(rnd()-.3)*3;g.lineTo(cx,cy)}g.stroke();
   g.fillStyle=n%2?'#e8c49a40':'#2a1a1240';g.fillRect(x+2,y+1,.8,.6);
  }else{
   g.fillStyle=n%3?'#3a281a30':'#fff2d040';g.fillRect(x,y,.6+rnd()*1.6,.5+rnd());
  }
 }
 // scenery for this chunk
 const objects=[];
 const tries=bioDensity=>bioDensity;
 for(let n=0;n<34;n++){
  const x=x0+rnd()*CHUNK,y=y0+rnd()*CHUNK;
  if(inValley(x,y))continue;
  const s=sample(x,y),bio=s.biome;
  const roll=rnd();
  let kind=null;
  if(bio==='forest')kind=roll<.62?(roll<.2?'pine':'oak'):roll<.8?'bush':null;
  else if(bio==='grass')kind=roll<.12?'oak':roll<.18?'pine':roll<.34?'bush':roll<.52?'tuft':roll<.6?'flowers':null;
  else if(bio==='waste')kind=roll<.05?'mesa':roll<.22?'rocks':roll<.3?'log':null;
  else if(bio==='rock')kind=roll<.08?'mesa':roll<.4?'rocks':roll<.52?'pine':null;
  else if(bio==='snow')kind=roll<.3?'pine':roll<.45?'rocks':null;
  else if(bio==='desert')kind=roll<.03?'mesa':roll<.12?'rocks':roll<.16?'tuft':null;
  else if(bio==='beach')kind=roll<.08?'rocks':null;
  if(!kind)continue;
  if(kind==='mesa'&&s.e<.12)continue;
  if(RESERVED.some(([rx,ry,rr])=>Math.hypot(x-rx,y-ry)<rr))continue;
  objects.push({x,y,kind,scale:.85+rnd()*.4,layout:Math.floor(rnd()*5),flip:rnd()<.5,snow:bio==='snow'});
 }
 return {canvas,objects};
}
function getChunk(cx,cy,force){
 const k=key(cx,cy);
 let ch=chunks.get(k);
 if(ch){chunks.delete(k);chunks.set(k,ch);return ch}
 if(!force){if(!queue.includes(k))queue.push(k);return null}
 ch=paintChunk(cx,cy);
 chunks.set(k,ch);
 while(chunks.size>MAX_CHUNKS){const first=chunks.keys().next().value;chunks.delete(first)}
 return ch;
}
// Paint at most one queued chunk per frame (prefetch ring around the view).
function pump(){
 const k=queue.shift();
 if(!k||chunks.has(k))return;
 const [cx,cy]=k.split(',').map(Number);
 getChunk(cx,cy,true);
}
function visibleChunks(vx,vy,w,h,margin){
 const out=[];
 const c0=Math.floor((vx-margin)/CHUNK),c1=Math.floor((vx+w+margin)/CHUNK);
 const r0=Math.floor((vy-margin)/CHUNK),r1=Math.floor((vy+h+margin)/CHUNK);
 for(let cy=Math.max(0,r0);cy<=Math.min(Math.ceil(H/CHUNK)-1,r1);cy++)
  for(let cx=Math.max(0,c0);cx<=Math.min(Math.ceil(W/CHUNK)-1,c1);cx++)out.push([cx,cy]);
 return out;
}
function allValley(cx,cy){return (cx+1)*CHUNK<=VW&&(cy+1)*CHUNK<=VH}
function drawGround(c,vx,vy,w,h){
 // the ring just outside the view is painted ahead of time, one chunk per frame
 for(const [cx,cy] of visibleChunks(vx,vy,w,h,CHUNK))if(!allValley(cx,cy)&&!chunks.has(key(cx,cy))){
  const inside=cx*CHUNK<vx+w&&(cx+1)*CHUNK>vx&&cy*CHUNK<vy+h&&(cy+1)*CHUNK>vy;
  if(!inside&&!queue.includes(key(cx,cy)))queue.push(key(cx,cy));
 }
 pump();
 c.save();c.imageSmoothingEnabled=true;
 for(const [cx,cy] of visibleChunks(vx,vy,w,h,0)){
  if(allValley(cx,cy))continue;
  const ch=getChunk(cx,cy,true);
  c.drawImage(ch.canvas,cx*CHUNK-vx,cy*CHUNK-vy,CHUNK,CHUNK);
 }
 c.restore();
}

// ------------------------------------------------------------ scenery art
const forest=new Image();forest.src='assets/forest-detail.webp';
const ready=i=>i.complete&&i.naturalWidth>0;
const CELL={oak:[0,224,224,42,46],pine:[226,224,224,33,53],bush:[452,100,80,20,16],rock:[554,75,55,15,11],
 tuft:[631,50,45,10,9],flowers:[745,50,40,10,8],log:[797,100,50,20,10]};
const ROCKS=[[[-7,0,1.5,0],[6,1,1.15,1],[0,3,.8,0]],[[-4,0,1.7,1],[9,2,.9,0]],
 [[-8,1,1.1,0],[3,-1,1.55,1],[11,3,.7,0],[-1,4,.65,1]],[[0,0,1.6,0],[-9,3,.75,1]],[[-5,0,1.3,1],[7,0,1.3,0],[1,4,.8,0]]];
function shadow(c,w){c.fillStyle='#14282155';c.beginPath();c.ellipse(w*.05,1,w*.38,Math.max(1.5,w*.1),0,0,Math.PI*2);c.fill()}
function sprite(c,name,flip=false){
 const [sx,sw,sh,w,h]=CELL[name];
 c.save();if(flip)c.scale(-1,1);c.drawImage(forest,sx,0,sw,sh,-w/2,-h+2,w,h);c.restore();
}
function drawObject(c,o){
 if(!ready(forest))return;
 c.save();c.translate(Math.round(o.x),Math.round(o.y));c.scale(o.scale,o.scale);c.imageSmoothingEnabled=false;
 if(o.kind==='rocks'||o.kind==='mesa'){
  const big=o.kind==='mesa';
  shadow(c,big?64:30);
  // mesas: stacked boulders rising into a tall rock pillar
  const layers=big?[[0,0,2.6],[-2,-14,2.2],[2,-27,1.9],[0,-38,1.5]]:[[0,0,1]];
  for(const [lx,ly,k] of layers){
   c.save();c.translate(lx,ly);c.scale(k,k);
   for(const [ox,oy,s,f] of [...ROCKS[o.layout]].sort((a,b)=>a[1]-b[1])){
    c.save();c.translate(ox,oy);c.scale(f?-s:s,s);sprite(c,'rock');c.restore();
   }
   c.restore();
  }
 }else{
  if(o.kind==='oak'||o.kind==='pine')shadow(c,CELL[o.kind][3]);
  sprite(c,o.kind,o.flip);
 }
 c.restore();
}
function objects(vx,vy,w,h){
 const out=[];
 for(const [cx,cy] of visibleChunks(vx,vy,w,h,64)){
  if(allValley(cx,cy))continue;
  const ch=chunks.get(key(cx,cy));if(!ch)continue;
  for(const o of ch.objects)out.push({x:o.x,y:o.y,storyDraw:c=>drawObject(c,o)});
 }
 return out;
}

// ------------------------------------------------------------ collision
function water(x,y){return !inValley(x,y)&&isWater(sample(x,y).biome)}
function solid(x,y){
 if(inValley(x,y))return false;
 if(water(x,y))return true;
 const ch=chunks.get(key(Math.floor(x/CHUNK),Math.floor(y/CHUNK)));
 if(!ch)return false;
 for(const o of ch.objects){
  const r=o.kind==='mesa'?20:o.kind==='rocks'?10:o.kind==='oak'||o.kind==='pine'?5:0;
  if(r&&Math.abs(x-o.x)<r*o.scale&&y>o.y-5*o.scale&&y<o.y+3)return true;
 }
 return false;
}

// ------------------------------------------------------------ world map image
let mapCanvas=null;
function mapImage(valley,vw,vh){
 if(mapCanvas)return mapCanvas;
 const MW=720,MH=480,k=W/MW;
 mapCanvas=document.createElement('canvas');mapCanvas.width=MW;mapCanvas.height=MH;
 const g=mapCanvas.getContext('2d');
 const img=g.createImageData(MW,MH);
 for(let j=0;j<MH;j++)for(let i=0;i<MW;i++){
  const b=BIOMES[sample((i+.5)*k,(j+.5)*k).biome].base,o=(j*MW+i)*4;
  img.data[o]=b[0];img.data[o+1]=b[1];img.data[o+2]=b[2];img.data[o+3]=255;
 }
 g.putImageData(img,0,0);
 if(valley)g.drawImage(valley,0,0,vw||valley.width,vh||valley.height,0,0,VW/k,VH/k);
 return mapCanvas;
}

root.KiWorld={reserve,places:PLACES,W,H,VW,VH,CHUNK,sample,drawGround,objects,solid,water,region,music,mapImage,inValley,
 stats:()=>({chunks:chunks.size,queued:queue.length})};
})(typeof window!=='undefined'?window:globalThis);
