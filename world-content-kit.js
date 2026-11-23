/* Ki Fighter world content kit v1: deterministic, data-driven content.
 * Browser global: window.KFWorldKit; Node: module.exports.
 * Pure data/functions; never creates a second character render layer.
 */
(function(root,factory){
  const kit=factory();
  if(typeof module==="object"&&module.exports) module.exports=kit;
  if(root) root.KFWorldKit=kit;
})(typeof globalThis!=="undefined"?globalThis:null,function(){
"use strict";
const roles=["villager","merchant","trainer","guard","traveler"];
const names=["Mira","Taro","Niko","Sena","Rin","Asha","Kato","Lina","Boro","Yumi","Daro","Fenn"];
const personalities=["friendly","cautious","curious","brave","reserved"];
const outfits=["earth","indigo","rust","sage","sand"];
function hash(value){let h=2166136261;for(const ch of String(value)){h=Math.imul(h^ch.charCodeAt(0),16777619)}return h>>>0}
function rng(seed){let state=hash(seed)||1;return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296}}
function pick(a,r){return a[Math.floor(r()*a.length)]}
function npc(seed,index=0){const r=rng(seed+":"+index),role=roles[index%roles.length];return {
 id:"npc-"+hash(seed+":"+index).toString(36),seed:String(seed),role,
 name:names[index%names.length],personality:pick(personalities,r),
 appearance:{outfit:pick(outfits,r),hair:["short","spiky","tied","curly"][Math.floor(r()*4)],palette:Math.floor(r()*5)},
 sprite:{manifest:"npc-standard-v1",cell:[64,96],facing:"down",animation:"idle"},
 interaction:{radius:42,dialogueId:"village-"+role,priority:role==="trainer"?2:1},
 behavior:{type:role==="guard"?"patrol":role==="merchant"?"stationary":"wander",speed:role==="guard"?0.6:0.35},
 collision:{radius:12},position:{x:0,y:0}
}}
const buildings=[
 {id:"house-small",size:[96,80],entrance:[48,76],interior:"home-a",collision:"solid-with-door"},
 {id:"market-stall",size:[112,64],entrance:[56,60],interior:null,collision:"counter"},
 {id:"training-hall",size:[160,112],entrance:[80,108],interior:"dojo-hall",collision:"solid-with-door"}
];
const interiors=[
 {id:"home-a",size:[320,240],exit:[160,222],features:["bed","table","storage"]},
 {id:"dojo-hall",size:[480,320],exit:[240,300],features:["training-mat","weights","mentor"]}
];
const dialogue={
 "village-villager":["The forest has been restless lately.","Stay safe out there."],
 "village-merchant":["Welcome! Need supplies for the road?"],
 "village-trainer":["Ready for a training challenge?","Remember to rest between rounds."],
 "village-guard":["Keep your guard up beyond the village."],
 "village-traveler":["I heard strange energy readings east of here."]
};
const quests=[{id:"village-first-steps",title:"First Steps",stages:[
 {id:"talk",type:"talk",targetRole:"trainer",count:1,objective:"Speak with the village trainer"},
 {id:"scout",type:"defeat",targetTag:"forest-scout",count:3,objective:"Defeat three forest scouts"},
 {id:"return",type:"talk",targetRole:"trainer",count:1,objective:"Report back to the trainer"}],
 rewards:{xp:150,item:"cedar-token"}}];
function makeVillage(seed="cedar-v1"){const r=rng(seed),npcs=Array.from({length:10},(_,i)=>{const n=npc(seed,i);n.position={x:96+(i%5)*105+Math.floor(r()*14),y:180+Math.floor(i/5)*145+Math.floor(r()*14)};return n});return {id:"village-"+hash(seed).toString(36),seed,npcs,buildings:[
 {template:"house-small",x:70,y:60},{template:"house-small",x:310,y:60},
 {template:"market-stall",x:535,y:75},{template:"training-hall",x:285,y:345}
 ],interiors:interiors.map(x=>x.id),questIds:["village-first-steps"]}}
function validateNpc(n){return !!(n&&typeof n.id==="string"&&n.id&&n.sprite?.cell?.[0]>0&&n.sprite?.cell?.[1]>0&&Number.isFinite(n.position?.x)&&Number.isFinite(n.position?.y)&&n.interaction?.radius>0&&n.collision?.radius>0)}
function questProgress(quest,state,event){const stage=quest.stages[state.stage||0];if(!stage||state.complete)return {...state};const matches=event.type===stage.type&&(stage.targetRole?event.targetRole===stage.targetRole:true)&&(stage.targetTag?event.targetTag===stage.targetTag:true);if(!matches)return {...state};const count=Math.min(stage.count,(state.count||0)+1);return count>=stage.count?((state.stage||0)+1>=quest.stages.length?{stage:quest.stages.length,count:0,complete:true}:{stage:(state.stage||0)+1,count:0,complete:false}):{...state,count}}
return Object.freeze({version:1,hash,npc,makeVillage,validateNpc,questProgress,buildings,interiors,dialogue,quests});
});
