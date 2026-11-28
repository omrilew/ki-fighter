/* Ki Fighter atmosphere: drifting cloud shadows and weather particles that
 * match the region under the camera (leaves, blossom petals, snow, blowing
 * sand, fireflies, sea spray). Purely visual, drawn above the characters and
 * below the HUD, in world coordinates.
 *
 *   KiAtmos.draw(c, viewX, viewY, viewW, viewH, kind)
 *     kind: 'leaves' | 'petals' | 'snow' | 'sand' | 'fireflies' | 'spray' | null
 *   KiAtmos.kindAt(biome)  -> the particle kind for an overworld biome
 */
(function(root){
'use strict';
const MAX=70;
const parts=[];
let last=0,current=null,mix=0;   // mix fades particles in and out when the region changes

const KINDS={
 leaves:{count:22,colors:['#9fbf4a','#c8a63c','#7fa53c','#d98c3a'],size:[.8,1.3],fall:[10,18],drift:[6,14],spin:true},
 petals:{count:34,colors:['#f6c4d4','#f0a6bf','#ffe0ea','#e88aa8'],size:[.8,1.2],fall:[7,13],drift:[8,16],spin:true},
 snow:{count:60,colors:['#ffffff','#eef6ff','#dbe8f5'],size:[.8,1.6],fall:[12,24],drift:[-4,6]},
 sand:{count:46,colors:['#e8c89a','#d9b27a','#f2dcb4'],size:[.6,1.1],fall:[-2,3],drift:[40,70],streak:true},
 fireflies:{count:16,colors:['#fff6a0','#d8ff8a'],size:[.9,1.3],fall:[-3,3],drift:[-4,4],glow:true},
 spray:{count:9,colors:['#eaf8fa','#cfe9ee'],size:[.4,.7],fall:[-8,4],drift:[10,20],fade:true}
};
const r=(a,b)=>a+Math.random()*(b-a);
function spawn(p,k,vx,vy,w,h,anywhere){
 const K=KINDS[k];
 p.kind=k;p.c=K.colors[Math.floor(Math.random()*K.colors.length)];
 p.s=r(...K.size);p.vy=r(...K.fall);p.vx=r(...K.drift);
 p.x=vx+r(-20,w+20);p.y=anywhere?vy+r(-10,h+10):(p.vy>=0?vy-8:vy+r(0,h));
 if(K.streak&&!anywhere)p.x=vx-10;
 p.ph=r(0,6.28);p.life=r(4,9);p.age=anywhere?r(0,p.life):0;
}
function kindAt(biome){
 switch(biome){
  case 'forest':case 'pinewood':return 'leaves';
  case 'grass':return 'leaves';
  case 'meadow':case 'blossom':return 'petals';
  case 'snow':case 'rock':return 'snow';
  case 'desert':case 'waste':return 'sand';
  case 'deep':case 'sea':case 'shallow':case 'beach':return 'spray';
  default:return null;
 }
}
// big soft shadows of clouds passing overhead (world-anchored, slow drift)
function clouds(c,vx,vy,w,h,t){
 const drift=t*6,cell=520;
 const c0=Math.floor((vx-drift)/cell)-1,c1=Math.floor((vx+w-drift)/cell)+1,r0=Math.floor(vy/cell)-1,r1=Math.floor((vy+h)/cell)+1;
 for(let gy=r0;gy<=r1;gy++)for(let gx=c0;gx<=c1;gx++){
  const h1=Math.sin(gx*127.1+gy*311.7)*43758.5453,f=h1-Math.floor(h1);
  if(f<.45)continue;                                     // about half the sky is clear
  const cx=gx*cell+drift+f*300,cy=gy*cell+((f*7.3)%1)*300,rx=140+f*160,ry=rx*.55;
  if(cx+rx<vx||cx-rx>vx+w||cy+ry<vy||cy-ry>vy+h)continue;
  const g=c.createRadialGradient(cx,cy,rx*.15,cx,cy,rx);
  g.addColorStop(0,'rgba(10,20,40,0.13)');g.addColorStop(.7,'rgba(10,20,40,0.07)');g.addColorStop(1,'rgba(10,20,40,0)');
  c.fillStyle=g;c.beginPath();c.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);c.fill();
 }
}
function draw(c,vx,vy,w,h,kind,options={}){
 const t=performance.now()/1000,dt=Math.min(.05,last?t-last:0);last=t;
 c.save();
 if(options.clouds!==false)clouds(c,vx,vy,w,h,t);
 if(kind!==current){mix=Math.max(0,mix-dt*1.5);if(mix===0){current=kind;parts.length=0}}
 else mix=Math.min(1,mix+dt*.8);
 if(current){
  const K=KINDS[current],want=Math.min(MAX,root.KiQuality?.low?Math.ceil(K.count/3):K.count);
  if(parts.length>want)parts.length=want;
  while(parts.length<want){const p={};spawn(p,current,vx,vy,w,h,true);parts.push(p)}
  for(const p of parts){
   p.age+=dt;
   const sway=Math.sin(t*1.7+p.ph)*(K.spin?6:K.glow?5:1.5);
   p.x+=(p.vx+sway*.4)*dt;p.y+=(p.vy+(K.glow?Math.cos(t+p.ph)*3:0))*dt;
   if(p.age>p.life||p.x<vx-40||p.x>vx+w+40||p.y>vy+h+20||p.y<vy-30)spawn(p,current,vx,vy,w,h,false);
   let a=mix*Math.min(1,p.age*2,(p.life-p.age)*1.5);
   if(K.glow)a*=.4+.6*Math.max(0,Math.sin(t*2.6+p.ph*3));
   if(K.fade)a*=.45;
   if(a<=.02)continue;
   c.globalAlpha=a;c.fillStyle=p.c;
   if(K.glow){c.globalAlpha=a*.35;c.beginPath();c.arc(p.x,p.y,p.s*2.6,0,Math.PI*2);c.fill();c.globalAlpha=a;c.fillRect(p.x-p.s/2,p.y-p.s/2,p.s,p.s)}
   else if(K.streak)c.fillRect(p.x,p.y,p.s*4,p.s*.5);
   else if(K.spin){const k=Math.abs(Math.sin(t*3+p.ph));c.fillRect(p.x-p.s/2,p.y-p.s*k/2,p.s,Math.max(.4,p.s*k))}
   else c.fillRect(p.x-p.s/2,p.y-p.s/2,p.s,p.s);
  }
 }
 c.restore();
}
root.KiAtmos={draw,kindAt,kinds:Object.keys(KINDS)};
})(typeof window!=='undefined'?window:globalThis);
