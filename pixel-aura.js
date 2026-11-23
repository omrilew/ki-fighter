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
 const [w,h]=dimensions[index],pulse=1+.015*Math.sin(time*12);
 ctx.save();ctx.imageSmoothingEnabled=false;ctx.globalAlpha=alpha;
 ctx.drawImage(img,Math.round(x-w*pulse/2),Math.round(y-h*pulse+6),Math.round(w*pulse),Math.round(h*pulse));
 ctx.restore();
}
root.KFPixelAura=Object.freeze({draw,get ready(){return ready},get error(){return error},frameCount:4});
init();
})(window);
