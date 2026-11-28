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
const W=9600,H=6400;                 // world extends to x<W, y<H ...
const X0=-2000,Y0=-1800;             // ... from x>=X0, y>=Y0: land wraps the valley on every side
const VW=2760,VH=560;                // hand-painted Cedar valley at 0..VW x 0..VH
const CHUNK=256,SCALE=2.5;           // chunk size (world px) and paint scale
const inValley=(x,y)=>x>=0&&y>=0&&x<VW&&y<VH;

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
 [1300,-650,2700,1150],   // Misty Pines: forested uplands north of the valley
 [-950,700,1250,1750],    // Blossom Hills: rolling meadows west of the valley
 [3400,-900,900,600],     // northern headland
];
const CARVE=[
 [-300,-1100,520,340],    // Mirror Lake in the north-west
 [2300,-1250,260,180],    // Pine Tarn
 [1720,1000,300,620],     // Kame Bay: opens below Kame Coast
 [4300,2650,420,300],     // Crystal Lake
 [6350,3950,260,520],     // Serpent Strait between highlands and desert
];
function elevation(x,y,f,land=LAND,carve=CARVE){
 let e=-1;
 // (sqrt instead of Math.hypot: this runs for every ground pixel)
 for(const [cx,cy,rx,ry] of land){const u=(x-cx)/rx,v=(y-cy)/ry,d=Math.sqrt(u*u+v*v);if(1-d>e)e=1-d}
 for(const [cx,cy,rx,ry] of carve){const u=(x-cx)/rx,v=(y-cy)/ry,d=Math.sqrt(u*u+v*v);if(d<1)e=Math.min(e,(d-1)*.9)}
 e+=((f?f[0]:fbm(x/900,y/900,4))-.5)*.32;
 // keep the valley and its neighbourhood solid ground, except the coast's sea
 const bay=x>1490&&x<1950;
 if(x>-160&&y>-160&&x<VW+120&&y<VH+120&&!bay)e=Math.max(e,.25);
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
function nearRoad(x,y,segs=SEGS){
 let best=1e9;
 for(const [ax,ay,bx,by] of segs){
  if(x<Math.min(ax,bx)-40||x>Math.max(ax,bx)+40||y<Math.min(ay,by)-40||y>Math.max(ay,by)+40)continue;
  const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));
  // gentle meander so roads don't look ruler-straight
  const m=Math.sin((ax+t*dx)/140)*6+Math.sin((ay+t*dy)/97)*4;
  const L=Math.sqrt(dx*dx+dy*dy),qx=x-(ax+t*dx)-m*dy/L,qy=y-(ay+t*dy)+m*dx/L;
  best=Math.min(best,Math.sqrt(qx*qx+qy*qy));
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
 pinewood:{base:[40,66,52],alt:[33,56,47]},
 meadow:{base:[96,124,60],alt:[78,108,52]},
 blossom:{base:[102,122,66],alt:[86,110,60]},
 waste:{base:[156,104,66],alt:[126,82,54]},
 desert:{base:[216,182,120],alt:[198,160,100]},
 rock:{base:[112,108,98],alt:[90,88,82]},
 snow:{base:[226,234,238],alt:[200,212,222]},
};
// The smooth noise fields behind elevation and region borders. Chunk painting
// evaluates them on a coarse grid and interpolates (fields(x,y) is the exact form).
function fields(x,y){return [fbm(x/900,y/900,4),fbm(x/700+40,y/700+40,3),fbm(x/1300+11,y/1300+3,3),fbm(x/1300+71,y/1300+29,3)]}
function sample(x,y,f,near){
 const e=near?elevation(x,y,f,near.land,near.carve):elevation(x,y,f);
 if(e<-.18)return {biome:'deep',e};
 if(e<-.04)return {biome:'sea',e};
 if(e<0)return {biome:'shallow',e};
 if(e<.045)return {biome:'beach',e};
 const n=f?f[1]:fbm(x/700+40,y/700+40,3);
 if(nearRoad(x,y,near?near.segs:SEGS)<9)return {biome:'road',e};
 // regions, with domain-warped borders so they meet in natural curves
 const wx=x+((f?f[2]:fbm(x/1300+11,y/1300+3,3))-.5)*1500,wy=y+((f?f[3]:fbm(x/1300+71,y/1300+29,3))-.5)*1500;
 if(wx>6400&&wy<3100&&e>.16)return {biome:e>.4&&n>.45?'snow':'rock',e};
 if(wx>6100&&wy>3300)return {biome:'desert',e};
 if(wy<-150&&wx<5200)return {biome:n>.4?'pinewood':'grass',e};
 if(wx<-120&&wy<3200)return {biome:n>.66?'forest':n>.5?'blossom':'meadow',e};
 if(wx>4500&&wx<6700&&wy>600&&wy<3700)return {biome:n>.63?'rock':'waste',e};
 return {biome:n>.56?'forest':'grass',e};
}
const isWater=b=>b==='deep'||b==='sea'||b==='shallow';
const isRoad=b=>b==='road';

// ------------------------------------------------------------ relief
// A heightfield gives every region hills (hillshading) and, where the land is
// rugged, terraced cliffs. The same functions drive drawing and physics, so a
// cliff you can see is a cliff you cannot walk up; gaps in it are ramps.
const LEVELS=5;
function heightAt(x,y){
 const base=fbm(x/760+300,y/760+300,4);
 const ridge=1-Math.abs(fbm(x/1500+90,y/1500+40,3)*2-1);          // long ridgelines
 return base*.75+ridge*.25;
}
const levelAt=(x,y)=>Math.floor(heightAt(x,y)*LEVELS*1.6);
const RUGGED={rock:1,snow:.9,waste:.8,pinewood:.55,meadow:.45,blossom:.4,desert:.45,forest:.25,grass:.2};
function cliffy(x,y,biome){
 if(inValley(x,y)||x>-260&&y>-260&&x<VW+260&&y<VH+260)return false;     // valley exits stay open
 const r=RUGGED[biome];if(!r)return false;
 if(nearRoad(x,y)<34)return false;                                       // roads cut through
 if(RESERVED.some(([rx,ry,rr])=>Math.hypot(x-rx,y-ry)<rr+30))return false;
 return vnoise(x/110+7,y/110+3)<r*.95;                                   // otherwise a ramp
}
// Moving from (x0,y0) to (x1,y1) climbs a cliff?
function climbBlocked(x0,y0,x1,y1){
 if(inValley(x1,y1))return false;
 const a=levelAt(x0,y0),b=levelAt(x1,y1);
 if(b<=a)return false;                                                    // level ground or dropping down
 return cliffy(x1,y1,sample(x1,y1).biome);
}
// Speed factor on slopes: uphill slower, downhill a little faster.
function slopeFactor(x,y,dx,dy){
 if(inValley(x,y))return 1;
 const len=Math.hypot(dx,dy);if(!len)return 1;
 const h0=heightAt(x,y),h1=heightAt(x+dx/len*12,y+dy/len*12);
 return Math.max(.68,Math.min(1.12,1-(h1-h0)*9));
}

// ------------------------------------------------------------ places
const PLACES=[
 {name:'Kame Bay',x:1720,y:1000,r:650,music:'coast'},
 {name:'Kame Island',x:2150,y:5250,r:260,music:'coast'},
 {name:'Crystal Lake',x:4300,y:2650,r:520,music:'coast'},
 {name:'Southern Isle',x:4350,y:5600,r:420,music:'coast'},
 {name:'Western Isle',x:850,y:4350,r:560,music:'coast'},
 {name:'Reef Isle',x:6000,y:5950,r:320,music:'coast'},
 {name:'Serpent Strait',x:6350,y:3950,r:600,music:'coast'},
 {name:'Mirror Lake',x:-300,y:-1100,r:600,music:'coast'},
 {name:'Pine Tarn',x:2300,y:-1250,r:320,music:'coast'},
];
function region(x,y){
 if(inValley(x,y))return null;
 for(const p of PLACES)if(Math.hypot(x-p.x,y-p.y)<p.r)return p.name;
 let {biome}=sample(x,y);
 if(isRoad(biome))biome=sample(x+24,y+24).biome==='road'?sample(x-30,y+30).biome:sample(x+24,y+24).biome;
 if(isRoad(biome))return 'Highway';
 if(isWater(biome))return y>4700?'Southern Sea':y<-200?'Northern Sea':x<900?'Western Sea':'Open Sea';
 if(biome==='pinewood')return 'Misty Pines';
 if(biome==='meadow'||biome==='blossom')return 'Blossom Hills';
 if(biome==='snow'||biome==='rock'&&x>6400)return 'Northern Peaks';
 if(biome==='desert')return 'Sunscar Desert';
 if(biome==='waste'||biome==='rock')return 'Red Wasteland';
 if(biome==='forest')return 'Deepwood';
 if(biome==='beach')return 'Coastline';
 return y<-150?'Misty Pines':x<-120?'Blossom Hills':y<1800?'Cedar Plains':'Southern Plains';
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
// What grows where: [kind, chance] lists, rolled in order (the rest stays open ground).
const SCENERY_MIX={
 grass:[['oak',.09],['birch',.03],['maple',.025],['pine',.04],['bush',.12],['tuft',.14],['flowers',.07],['boulder',.015],['mossboulder',.01],['stump',.015],['mushrooms',.012],['menhir',.004]],
 forest:[['oak',.22],['spruce',.1],['fir',.1],['birch',.06],['pine',.08],['bush',.1],['fern',.08],['mossboulder',.02],['mushrooms',.03],['stump',.02]],
 pinewood:[['spruce',.24],['fir',.2],['poplar',.04],['fern',.12],['mossboulder',.04],['menhir',.012],['stump',.03],['mushrooms',.03],['bush',.04]],
 meadow:[['cherry',.04],['cherry2',.03],['birch',.04],['poplar',.02],['flowers',.16],['sunflowers',.05],['tuft',.14],['bush',.05],['boulder',.01],['menhir',.006]],
 blossom:[['cherry',.14],['cherry2',.12],['willow',.03],['flowers',.12],['tuft',.08],['mossboulder',.02]],
 waste:[['mesa',.05],['rocks',.15],['deadtree',.04],['deadtree2',.03],['hoodoo',.025],['shrub',.08],['log',.05]],
 rock:[['mesa',.07],['rocks',.28],['boulder',.06],['fir',.08],['menhir',.015],['crystal',.008]],
 snow:[['snowfir',.36],['icerock',.08],['rocks',.1],['crystal',.015]],
 desert:[['cactus',.07],['hoodoo',.03],['sandstone',.03],['mesa',.02],['rocks',.08],['shrub',.1],['tuft',.04]],
 beach:[['rocks',.07],['boulder',.01]],
};
function pick(list,roll){if(!list)return null;let acc=0;for(const [k,p] of list){acc+=p;if(roll<acc)return k}return null}
function paintChunk(cx,cy){
 const x0=cx*CHUNK,y0=cy*CHUNK,N=CHUNK/2;               // sample every 2 world px
 const small=document.createElement('canvas');small.width=small.height=N;
 const sctx=small.getContext('2d');
 const img=sctx.createImageData(N,N);
 const biomeGrid=new Array(N*N);
 // heights on the same 2 px grid, with a margin, so relief lookups are array reads
 const M=16,NN=N+2*M,HG=new Float32Array(NN*NN);
 for(let j=0;j<NN;j++)for(let i=0;i<NN;i++)HG[j*NN+i]=heightAt(x0+(i-M)*2+1,y0+(j-M)*2+1);
 const hAt=(i,j)=>HG[(j+M)*NN+i+M],lv=(i,j)=>Math.floor(hAt(i,j)*LEVELS*1.6);
 // coarse 16 px grid of the smooth fields, bilinearly interpolated per pixel
 // only the roads and land shapes that can reach this chunk
 const pad=120,near={
  segs:SEGS.filter(([ax,ay,bx,by])=>Math.max(ax,bx)>x0-pad&&Math.min(ax,bx)<x0+CHUNK+pad&&Math.max(ay,by)>y0-pad&&Math.min(ay,by)<y0+CHUNK+pad),
  land:LAND.filter(([cx,cy,rx,ry])=>{const u=Math.max(0,Math.abs(cx-(x0+CHUNK/2))-CHUNK/2)/rx,v=Math.max(0,Math.abs(cy-(y0+CHUNK/2))-CHUNK/2)/ry;return u*u+v*v<2.6}),
  carve:CARVE.filter(([cx,cy,rx,ry])=>{const u=Math.max(0,Math.abs(cx-(x0+CHUNK/2))-CHUNK/2)/rx,v=Math.max(0,Math.abs(cy-(y0+CHUNK/2))-CHUNK/2)/ry;return u*u+v*v<1.2}),
 };
 const G=16,GN=CHUNK/G+1,FG=[];
 for(let j=0;j<GN;j++)for(let i=0;i<GN;i++)FG.push(fields(x0+i*G,y0+j*G));
 const fOut=[0,0,0,0];
 const fAt=(x,y)=>{
  const u=(x-x0)/G,v=(y-y0)/G,i=Math.min(GN-2,Math.floor(u)),j=Math.min(GN-2,Math.floor(v)),a=u-i,b=v-j;
  const p=FG[j*GN+i],q=FG[j*GN+i+1],r=FG[(j+1)*GN+i],t=FG[(j+1)*GN+i+1],out=fOut;
  for(let k=0;k<4;k++)out[k]=p[k]*(1-a)*(1-b)+q[k]*a*(1-b)+r[k]*(1-a)*b+t[k]*a*b;
  return out;
 };
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){
  const x=x0+i*2+1,y=y0+j*2+1;
  const s=sample(x,y,fAt(x,y),near),b=BIOMES[s.biome];
  biomeGrid[j*N+i]=s.biome;
  const broad=fbm(x/90,y/90,2),fine=vnoise(x/9,y/9);
  const dry=s.biome==='waste'||s.biome==='desert'||s.biome==='rock';
  const k=Math.min(1,Math.max(0,(broad-.3)*(dry?2.2:1.6)+(fine-.5)*(dry?.5:.25)));
  let r=b.base[0]+(b.alt[0]-b.base[0])*k,g=b.base[1]+(b.alt[1]-b.base[1])*k,bl=b.base[2]+(b.alt[2]-b.base[2])*k;
  if(s.biome==='shallow'){const f=1-Math.min(1,-s.e/.04);r+=f*60;g+=f*55;bl+=f*40}           // lighter near the shore
  if(s.biome==='beach'&&s.e<.012){r=236;g=240;bl=228}                                          // foam line
  if(s.biome==='road'){const d=nearRoad(x,y,near.segs);if(d>6){r*=.72;g*=.7;bl*=.68}else if(fine>.7){r+=18;g+=16;bl+=12}}
  if(!isWater(s.biome)){
   // hillshading from the heightfield, lit from the north-west
   const h=hAt(i,j),hx=hAt(i+3,j)-h,hy=hAt(i,j+3)-h;
   const lit=Math.max(-.22,Math.min(.22,(-hx*.6-hy*.8)*26));
   r*=1+lit;g*=1+lit;bl*=1+lit*.8;
   // terraced cliffs: the south face of a higher terrace is a rock wall (3/4 view)
   const L=lv(i,j),FACE=11;                                                  // face height in 2 px cells
   if(L>lv(i,j+FACE)&&cliffy(x,y,s.biome)){
    let d=1;while(d<FACE&&lv(i,j+d)>=L)d++;                                  // distance down to the cliff foot
    const t=Math.min(1,d/FACE);                                              // 0 at the foot, 1 at the lip
    if(t>.9&&lv(i,j-2)===L){                                                 // grassy overhang on the lip
     r*=.78;g*=.78;bl*=.78;
    }else{
     const rock=s.biome==='snow'?[136,146,160]:s.biome==='waste'||s.biome==='desert'?[148,84,54]:s.biome==='meadow'||s.biome==='blossom'?[128,112,92]:[100,96,90];
     const strata=(Math.floor(x/3+Math.sin(y/5)*1.5)%4===0?.78:1)*(Math.floor((y+x*.15)/7)%2?1:.93);
     const shade=(.62+.5*t)*strata*(fine>.75?1.1:1);
     r=rock[0]*shade;g=rock[1]*shade;bl=rock[2]*shade;
     if(t>.78&&t<=.9){r+=26;g+=24;bl+=20}                                    // sunlit ledge below the lip
    }
   }else if(L<lv(i,j-3)&&cliffy(x,y-6,s.biome)){r*=.62;g*=.62;bl*=.68}       // shadow at the cliff foot
   else if(L<lv(i,j-6)&&cliffy(x,y-12,s.biome)){r*=.8;g*=.8;bl*=.84}
   else if((L>lv(i+3,j)||L>lv(i-3,j))&&cliffy(x,y,s.biome)){r*=.78;g*=.78;bl*=.8}   // terrace side edges
  }
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
 for(let n=0;n<48;n++){
  const x=x0+rnd()*CHUNK,y=y0+rnd()*CHUNK;
  if(inValley(x,y))continue;
  const s=sample(x,y),bio=s.biome;
  const roll=rnd();
  let kind=pick(SCENERY_MIX[bio],roll);
  // shore plants: reeds by lakes and the sea, palms on warm beaches
  if(s.e<.07&&(bio==='grass'||bio==='forest'||bio==='meadow'||bio==='pinewood')&&roll<.35)kind='reeds';
  if(bio==='beach'&&y>1400&&roll<.12)kind='palm';
  if(!kind)continue;
  if(kind==='mesa'&&s.e<.12)continue;
  if(RESERVED.some(([rx,ry,rr])=>Math.hypot(x-rx,y-ry)<rr))continue;
  if(levelAt(x,y)>levelAt(x,y+26)&&cliffy(x,y,bio))continue;
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
 for(let cy=Math.max(Math.floor(Y0/CHUNK),r0);cy<=Math.min(Math.ceil(H/CHUNK)-1,r1);cy++)
  for(let cx=Math.max(Math.floor(X0/CHUNK),c0);cx<=Math.min(Math.ceil(W/CHUNK)-1,c1);cx++)out.push([cx,cy]);
 return out;
}
// chunks fully covered by the painted valley (its outer row and column are faded, so they still need ground)
function allValley(cx,cy){return cx>=1&&cy>=1&&(cx+1)*CHUNK<=VW&&(cy+1)*CHUNK<=VH}
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
// Generated pixel-art scenery (scripts/build-scenery-atlas.py)
const sceneryArt=new Image();sceneryArt.src='assets/scenery-atlas.png?v=1';
const SCN=root.KiSceneryAtlas?.sprites||{},SCN_PX=root.KiSceneryAtlas?.px||4;
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
function drawScenery(c,o){
 const m=SCN[o.kind];if(!m||!ready(sceneryArt))return;
 const [sx,sy,sw,sh]=m.rect,w=sw/SCN_PX,h=sh/SCN_PX;
 c.save();c.translate(Math.round(o.x),Math.round(o.y));c.scale(o.scale,o.scale);c.imageSmoothingEnabled=false;
 if(m.solid||w>14)shadow(c,Math.min(w,m.solid*4+16));
 if(o.flip)c.scale(-1,1);
 c.drawImage(sceneryArt,sx,sy,sw,sh,-m.foot[0]/SCN_PX,-h+1,w,h);
 c.restore();
}
function drawObject(c,o){
 if(SCN[o.kind])return drawScenery(c,o);
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
 // Every object blocks with an ellipse that matches its visible base (trunk or
 // stone footprint), seen in 3/4 view, checked across neighbouring chunks too.
 const cx0=Math.floor(x/CHUNK),cy0=Math.floor(y/CHUNK);
 for(let cy=cy0-1;cy<=cy0+1;cy++)for(let cx=cx0-1;cx<=cx0+1;cx++){
  const ch=chunks.get(key(cx,cy));if(!ch)continue;
  for(const o of ch.objects){
   const r=footprint(o.kind)*o.scale;if(!r)continue;
   const dx=(x-o.x)/r,dy=(y-o.y+r*.12)/(r*.48);
   if(dx*dx+dy*dy<1)return true;
  }
 }
 return false;
}
function footprint(kind){
 if(SCN[kind])return SCN[kind].solid;
 return kind==='mesa'?22:kind==='rocks'?10:kind==='oak'?5.5:kind==='pine'?4.5:kind==='log'?7:0;
}

// ------------------------------------------------------------ world map image
let mapCanvas=null;
function mapImage(valley,vw,vh){
 if(mapCanvas)return mapCanvas;
 const MW=720,k=(W-X0)/MW,MH=Math.round((H-Y0)/k);
 mapCanvas=document.createElement('canvas');mapCanvas.width=MW;mapCanvas.height=MH;
 const g=mapCanvas.getContext('2d');
 const img=g.createImageData(MW,MH);
 for(let j=0;j<MH;j++)for(let i=0;i<MW;i++){
  const b=BIOMES[sample(X0+(i+.5)*k,Y0+(j+.5)*k).biome].base,o=(j*MW+i)*4;
  img.data[o]=b[0];img.data[o+1]=b[1];img.data[o+2]=b[2];img.data[o+3]=255;
 }
 g.putImageData(img,0,0);
 if(valley)g.drawImage(valley,0,0,vw||valley.width,vh||valley.height,-X0/k,-Y0/k,VW/k,VH/k);
 return mapCanvas;
}

root.KiWorld={climbBlocked,slopeFactor,heightAt,levelAt,reserve,places:PLACES,W,H,X0,Y0,VW,VH,CHUNK,sample,drawGround,objects,solid,water,region,music,mapImage,inValley,
 stats:()=>({chunks:chunks.size,queued:queue.length})};
})(typeof window!=='undefined'?window:globalThis);
