/* Pixel aura atlas generator. 8 deterministic frames per stage, two palettes.
 * Pure rendering: no game loop, no player sprite, no input handlers.
 */
(function(root){
"use strict";
const W=96,H=112,N=8;
const palettes={
 blue:['#092a8e','#1056d7','#128ef7','#43d7ff','#efffff'],
 gold:['#9c4700','#e5900d','#ffbf23','#ffe457','#fff9d3']
};
const frames=new Map();
function rand(seed){let s=(seed|0)||1;return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296}}
function create(mode,stage,frame){
 const el=document.createElement('canvas');el.width=W;el.height=H;
 const g=el.getContext('2d',{alpha:true});g.imageSmoothingEnabled=false;
 const colors=palettes[mode],r=rand(1381+frame*7919+stage*307+ (mode==='gold'?107:0));
 const power=[.12,.36,.69,1][stage],center=W/2,base=H-10;
 if(stage===0&&mode==='blue')return el;
 // Pixel-edged upward plasma tongues with shifting widths and heights.
 const tongues=stage===0?5:stage===1?9:stage===2?14:21;
 for(let i=0;i<tongues;i++){
  const side=i%2?-1:1;
  const lane=Math.floor(i/2),x=center+side*(6+lane*3.4+(r()-.5)*5);
  const height=(18+power*65)*(0.48+r()*.6);
  const width=(2+power*5)*(0.65+r()*.7);
  for(let layer=0;layer<3;layer++){
   const offset=layer*1.5;
   const col=colors[Math.min(4,layer+1+(stage===3?1:0))];
   g.fillStyle=col;g.beginPath();g.moveTo(Math.round(x-width+offset),base);
   for(let j=0;j<=5;j++){
    const t=j/5;
    const sway=Math.sin(t*5+frame*Math.PI/4+i*1.8)*4*t;
    const taper=(1-t)*width*(1-layer*.21);
    g.lineTo(Math.round(x+sway-taper+offset),Math.round(base-height*t));
   }
   for(let j=5;j>=0;j--){
    const t=j/5,sway=Math.sin(t*5+frame*Math.PI/4+i*1.8)*4*t;
    const taper=(1-t)*width*(1-layer*.21);
    g.lineTo(Math.round(x+sway+taper-offset),Math.round(base-height*t));
   }
   g.closePath();g.fill();
  }
 }
 // Bright pixel slashes and detached sparks, strongest near full charge.
 for(let i=0;i<Math.round(4+power*25);i++){
  const x=Math.round(center+(r()-.5)*(25+power*70));
  const y=Math.round(base-r()*(15+power*84));
  g.fillStyle=colors[i%4===0?4:3];
  g.fillRect(x,y,i%6===0?2:1,i%5===0?5:2);
 }
 if(stage>=2){
  g.strokeStyle=colors[3];g.lineWidth=stage===3?2:1;
  for(let i=0;i<(stage===3?5:2);i++){
   const side=i%2?-1:1,x=center+side*(15+r()*19);
   g.beginPath();g.moveTo(x,base-10-r()*20);
   g.lineTo(x+side*7,base-25-r()*25);
   g.lineTo(x+side*2,base-43-r()*30);g.stroke();
  }
 }
 if(stage>=1){
  g.globalAlpha=.35+power*.45;g.strokeStyle=colors[3];g.lineWidth=stage===3?3:2;
  g.beginPath();g.ellipse(center,base+1,10+power*25,2+power*4,0,0,Math.PI*2);g.stroke();
 }
 return el;
}
function frame(mode,stage,index){const key=mode+':'+stage+':'+index;if(!frames.has(key))frames.set(key,create(mode,stage,index));return frames.get(key)}
function draw(ctx,x,y,mode,stage,time,alpha=1){
 if(!palettes[mode])return;
 const index=Math.floor(time*12)%N;
 const atlas=frame(mode,Math.max(0,Math.min(3,stage|0)),index);
 ctx.save();ctx.imageSmoothingEnabled=false;ctx.globalAlpha=alpha;
 // Fixed feet anchor, no sprite duplication or scaling of character hitbox.
 const scale=.58;ctx.drawImage(atlas,Math.round(x-W*scale/2),Math.round(y-(H-10)*scale),Math.round(W*scale),Math.round(H*scale));ctx.restore();
}
root.KFPixelAura=Object.freeze({draw,frame,frameCount:N});
})(typeof window!=='undefined'?window:globalThis);
