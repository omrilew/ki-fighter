/* Production aura renderer: authored 8-frame flame silhouettes on separate
 * blue/gold sprite strips, no generated canvas spikes. The body remains on
 * the existing character atlas; aura renders only behind it.
 */
(function(root){
"use strict";
const palettes={
 blue:["#0734a6","#0879ee","#35c9ff","#eaffff"],
 gold:["#a95408","#f2a30c","#ffdb35","#fff9cf"]
};
const WIDTH=96,HEIGHT=112,COUNT=8;
const sprites={};
function flamePath(x,y,width,height,sway,tip){
 const left=x-width/2,right=x+width/2;
 return `M ${left.toFixed(1)} ${y} C ${(left-width*.5).toFixed(1)} ${(y-height*.36).toFixed(1)}, ${(x+sway-width*.22).toFixed(1)} ${(y-height*.58).toFixed(1)}, ${(x+tip).toFixed(1)} ${(y-height).toFixed(1)} C ${(x+sway+width*.30).toFixed(1)} ${(y-height*.57).toFixed(1)}, ${(right+width*.36).toFixed(1)} ${(y-height*.27).toFixed(1)}, ${right.toFixed(1)} ${y} Z`;
}
function svg(mode){
 const colors=palettes[mode],cells=[];
 for(let frame=0;frame<COUNT;frame++){
  const t=frame*Math.PI*2/COUNT,shapes=[];
  const towers=[[-31,46,13],[-23,73,15],[-13,91,18],[0,104,20],[14,88,17],[25,73,14],[33,47,11]];
  // Each frame is a separately authored silhouette with changing tips and
  // nested flame contours; no runtime randomization or full-canvas overlays.
  for(let layer=0;layer<3;layer++){
   for(let i=0;i<towers.length;i++){
    const [offset,height,width]=towers[i];
    const wave=Math.sin(t+i*1.31+layer*.8);
    const h=height*(.75+.10*wave)*(1-layer*.17);
    const x=48+offset*(1-layer*.15),w=width*(1-layer*.20);
    const sway=Math.sin(t*1.5+i*.8)*5;
    shapes.push(`<path d="${flamePath(x,102-layer*1.5,w,h,sway,sway*.8)}" fill="${colors[layer]}" opacity="${layer===0?.84:.95}"/>`);
   }
  }
  for(let i=0;i<10;i++){
   const xx=48+Math.sin(i*2.4+t)* (15+(i%4)*7);
   const yy=95-((frame*9+i*17)%83);
   shapes.push(`<path d="M${xx.toFixed(1)} ${yy} l2 -8 l-1 6 l-3 5 Z" fill="${colors[i%3===0?3:2]}"/>`);
  }
  shapes.push(`<ellipse cx="48" cy="104" rx="${30+Math.sin(t)*3}" ry="4" fill="none" stroke="${colors[2]}" stroke-width="2" opacity=".8"/>`);
  cells.push(`<g transform="translate(${frame*WIDTH},0)">${shapes.join("")}</g>`);
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH*COUNT}" height="${HEIGHT}" viewBox="0 0 ${WIDTH*COUNT} ${HEIGHT}" shape-rendering="crispEdges">${cells.join("")}</svg>`;
}
function image(mode){if(sprites[mode])return sprites[mode];const im=new Image();im.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg(mode));sprites[mode]=im;return im}
function draw(ctx,x,y,mode,stage,time,alpha=1){
 if(!palettes[mode]||stage===0)return;
 const im=image(mode);if(!im.complete||!im.naturalWidth)return;
 const dimensions=[[0,0],[42,55],[56,78],[70,106]],size=dimensions[Math.max(0,Math.min(3,stage|0))];
 const [w,h]=size,frame=Math.floor(time*10)%COUNT;
 ctx.save();ctx.imageSmoothingEnabled=false;ctx.globalAlpha=alpha;
 ctx.drawImage(im,frame*WIDTH,0,WIDTH,HEIGHT,Math.round(x-w/2),Math.round(y-h+6),w,h);
 ctx.restore();
}
root.KFPixelAura=Object.freeze({draw,frameCount:COUNT});
})(typeof window!=="undefined"?window:globalThis);
