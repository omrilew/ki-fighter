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
// Crop transparent margins from generated artwork once, not on every frame.
const cropped=new Map();
function prepare(img){
 const cv=document.createElement("canvas");cv.width=img.naturalWidth;cv.height=img.naturalHeight;
 const g=cv.getContext("2d",{willReadFrequently:true});g.drawImage(img,0,0);
 const pixels=g.getImageData(0,0,cv.width,cv.height).data;
 let left=cv.width,top=cv.height,right=-1,bottom=-1;
 for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++){
  if(pixels[(y*cv.width+x)*4+3]>35){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y)}
 }
 if(right<left)return {img,sx:0,sy:0,sw:cv.width,sh:cv.height};
 return {img,sx:left,sy:top,sw:right-left+1,sh:bottom-top+1};
}
function draw(ctx,x,y,color,stage,time,alpha=1,growth=1){
 if(!ready||!colors.includes(color))return;
 const index=Math.max(0,Math.min(3,stage|0));
 const name=color+"_"+names[index],img=images.get(name);
 if(!img)return;
 if(!cropped.has(name))cropped.set(name,prepare(img));
 const a=cropped.get(name);
 const progress=Math.max(0,Math.min(1,(index+1)/4));
 // Growth happens with charge progression; do not squash or stretch the image every frame.
 const width=(58+progress*62)*growth,height=(79+progress*77)*growth;
 const baseY=y+6,top=baseY-height;
 ctx.save();ctx.imageSmoothingEnabled=false;
 ctx.globalAlpha=alpha*.88;
 ctx.drawImage(img,a.sx,a.sy,a.sw,a.sh,Math.round(x-width/2),Math.round(top),Math.round(width),Math.round(height));
 // Individual rising flame ribbons animate independently over the illustrated silhouette.
 // Each ribbon samples a narrow portion of the same art, preserving pixel colors.
 ctx.beginPath();ctx.rect(x-width*.52,top-8,width*1.04,height+10);ctx.clip();
 for(let i=0;i<7;i++){
  const phase=(time*(.67+i*.085)+i*.173)%1;
  const side=(i%2?1:-1),offset=side*width*(.16+(i%3)*.085);
  const fw=width*(.075+(i%3)*.015),fh=height*(.24+(i%4)*.055);
  const drift=Math.sin(time*(2.8+i*.31)+i*2.1)*width*.025;
  const rise=phase*height*.57;
  const sourceX=a.sx+Math.floor(a.sw*(.13+(i*.113)% .68));
  const sourceW=Math.max(2,Math.floor(a.sw*.095));
  ctx.globalAlpha=alpha*(.26+.36*Math.sin(phase*Math.PI));
  ctx.drawImage(img,sourceX,a.sy,Math.min(sourceW,a.sx+a.sw-sourceX),a.sh,
    Math.round(x+offset+drift-fw/2),Math.round(baseY-fh-rise),Math.round(fw),Math.round(fh));
 }
 // Lightning bolts and rising sparks are separate layers, not whole-image scaling.
 const primary=color==='gold'?'#fff2a2':'#bdfbff';
 const secondary=color==='gold'?'#ffc52e':'#30c7ff';
 for(let i=0;i<9;i++){
  const p=(time*(.48+i*.043)+i*.283)%1;
  const side=i%2?-1:1;
  const sx=x+side*width*(.22+.13*Math.sin(i*5.1));
  const sy=baseY-p*height*.9;
  ctx.globalAlpha=alpha*(1-p)*(.32+.2*Math.sin(time*13+i));
  ctx.fillStyle=i%3?secondary:primary;
  ctx.fillRect(Math.round(sx+Math.sin(time*5+i)*4),Math.round(sy),i%3?2:3,i%3?3:5);
 }
 if(index>=2){
  ctx.strokeStyle=primary;ctx.lineWidth=1.6;
  for(let i=0;i<3;i++){
   const phase=(time*1.9+i*.37)%1;
   const side=i%2?-1:1;
   const sx=x+side*width*(.19+.07*Math.sin(time*5+i));
   const sy=baseY-height*(.17+phase*.63);
   ctx.globalAlpha=alpha*.6*(1-phase);
   ctx.beginPath();ctx.moveTo(sx,sy);
   ctx.lineTo(sx+side*7,sy-8);ctx.lineTo(sx+side*2,sy-15);
   ctx.lineTo(sx+side*11,sy-23);ctx.stroke();
  }
 }
 ctx.restore();
}
root.KFPixelAura=Object.freeze({draw,get ready(){return ready},get error(){return error},frameCount:4});
init();
})(window);
