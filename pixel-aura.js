/* Illustrated Ki aura asset pack loaded from repository ZIP.
 * Four transparent PNG stages per form, no procedural fallback.
 * Requires JSZip loaded before this script; no extra canvas/game loop.
 */
(function(root){
"use strict";
const names=["start","mid","strong","full"],colors=["blue","gold"];
const dimensions=[[62,75],[84,108],[106,140],[130,174]];
const images=new Map();let ready=false,error=null;
async function init(){
 try{
  if(!root.JSZip)throw Error("JSZip unavailable");
  const response=await fetch("assets/ki_fighters_aura_pack.zip?v=4839076");
  if(!response.ok)throw Error("Aura pack HTTP "+response.status);
  const zip=await root.JSZip.loadAsync(await response.arrayBuffer());
  await Promise.all(colors.flatMap(color=>names.map(async stage=>{
   const name=color+"_"+stage;
   const entry=zip.file("ki_aura/"+name+".png");
   if(!entry)throw Error("Missing aura "+name);
   const blob=new Blob([await entry.async("uint8array")],{type:"image/png"});
   const url=URL.createObjectURL(blob);
   try{
    const img=new Image();img.decoding="async";img.src=url;
    await (img.decode?img.decode():new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject}));
    images.set(name,img);
   }finally{URL.revokeObjectURL(url)}
  })));
  ready=true;
 }catch(e){error=e;console.warn("Illustrated aura unavailable",e)}
}
function draw(ctx,x,y,color,stage,time,alpha=1){
 if(!ready||!colors.includes(color))return;
 const index=Math.max(0,Math.min(3,stage|0)),img=images.get(color+"_"+names[index]);
 if(!img)return;
 const [baseW,baseH]=dimensions[index];
 // Hand-illustrated frames remain intact, but breathe continuously rather than freeze.
 const breathe=1+.045*Math.sin(time*11)+.018*Math.sin(time*19);
 const w=baseW*breathe,h=baseH*(1+.065*Math.sin(time*9)+.022*Math.sin(time*17));
 const shimmer=.91+.09*Math.sin(time*14);
 ctx.save();ctx.imageSmoothingEnabled=false;ctx.globalAlpha=alpha*shimmer;
 ctx.drawImage(img,Math.round(x-w/2),Math.round(y-h+6),Math.round(w),Math.round(h));
 ctx.restore();
}
root.KFPixelAura=Object.freeze({draw,get ready(){return ready},get error(){return error},frameCount:4});
init();
})(window);
