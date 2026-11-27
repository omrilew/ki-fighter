/* Stable campaign identities and sprite metadata, usable by the browser and atlas tools. */
(function(root,factory){
  const cast=factory();
  if(typeof module==="object"&&module.exports)module.exports=cast;
  if(root)root.KFCampaignCast=cast;
})(typeof globalThis==="undefined"?null:globalThis,function(){
  "use strict";
  const source="assets/campaign-cast/opening-atlas.png";
  const cell=Object.freeze([64,96]);
  const directions=Object.freeze(["down","left","right","up"]);
  const artOrder=Object.freeze(["bulma","piccolo","raditz","extra-earth","extra-indigo","extra-rust","extra-sage"]);
  const layout=Object.freeze({
    idle:{start:0,count:2,durationMs:320,loop:true},
    walk:{start:8,count:4,durationMs:120,loop:true},
    talk:{start:24,count:2,durationMs:220,loop:true},
    telegraph:{start:32,count:2,durationMs:110,loop:false},
    attack:{start:40,count:2,durationMs:90,loop:false},
    recovery:{start:48,count:2,durationMs:105,loop:false},
    hurt:{start:56,count:2,durationMs:80,loop:false},
    knockdown:{start:64,count:2,durationMs:140,loop:false}
  });
  const block=32,grid=Object.freeze({columns:12,rows:22});
  const references=Object.freeze({
    bulma:"https://en.dragon-ball-official.com/news/01_3933.html",
    piccolo:"https://en.dragon-ball-official.com/news/01_1178.html",
    arrival:"https://en.dragon-ball-official.com/news/01_4584.html",
    gohan:"https://en.dragon-ball-official.com/news/01_503.html",
    roshi:"https://en.dragon-ball-official.com/news/01_799.html",
    krillin:"https://en.dragon-ball-official.com/news/01_3484.html",
    frieza:"https://en.dragon-ball-official.com/news/01_1201.html"
  });
  const records=[
    ["goku","Goku","fighter","opening","existing","arrival"],
    ["bulma","Bulma","investigator","opening","npc-art","bulma"],
    ["piccolo","Piccolo","witness","opening","npc-art","piccolo"],
    ["gohan","Gohan","ally","opening","planned","gohan"],
    ["chi-chi","Chi-Chi","resident","opening","planned","arrival"],
    ["krillin","Krillin","ally","opening","planned","krillin"],
    ["master-roshi","Master Roshi","mentor","opening","planned","roshi"],
    ["raditz","Raditz","opponent","opening","encounter-art","arrival"],
    ["vegeta","Vegeta","opponent","saiyan","planned","arrival"],
    ["nappa","Nappa","opponent","saiyan","planned","arrival"],
    ["yamcha","Yamcha","ally","saiyan","planned","arrival"],
    ["tien","Tien","ally","saiyan","planned","roshi"],
    ["chiaotzu","Chiaotzu","ally","saiyan","planned","arrival"],
    ["yajirobe","Yajirobe","ally","saiyan","planned",null],
    ["king-kai","King Kai","mentor","saiyan","planned","arrival"],
    ["frieza","Frieza","opponent","namek","planned","frieza"],
    ["dende","Dende","guide","namek","planned",null],
    ["nail","Nail","guardian","namek","planned",null],
    ["guru","Guru","mentor","namek","planned",null],
    ["zarbon","Zarbon","opponent","namek","planned",null],
    ["dodoria","Dodoria","opponent","namek","planned",null],
    ["ginyu","Captain Ginyu","opponent","namek","planned",null],
    ["jeice","Jeice","opponent","namek","planned",null],
    ["burter","Burter","opponent","namek","planned",null],
    ["recoome","Recoome","opponent","namek","planned",null],
    ["guldo","Guldo","opponent","namek","planned",null],
    ["trunks","Future Trunks","ally","android-cell","planned",null],
    ["android-16","Android 16","ally","android-cell","planned","krillin"],
    ["android-17","Android 17","opponent","android-cell","planned","krillin"],
    ["android-18","Android 18","opponent","android-cell","planned","krillin"],
    ["android-19","Android 19","opponent","android-cell","planned",null],
    ["dr-gero","Dr. Gero","opponent","android-cell","planned","krillin"],
    ["cell","Cell","opponent","android-cell","planned","krillin"],
    ["mr-satan","Mr. Satan","ally","android-cell","planned",null],
    ["goten","Goten","ally","majin","planned",null],
    ["kid-trunks","Kid Trunks","ally","majin","planned",null],
    ["videl","Videl","ally","majin","planned",null],
    ["shin","Shin","guide","majin","planned",null],
    ["kibito","Kibito","guide","majin","planned",null],
    ["babidi","Babidi","opponent","majin","planned",null],
    ["dabura","Dabura","opponent","majin","planned",null],
    ["majin-buu","Majin Buu","opponent","majin","planned",null],
    ["gotenks","Gotenks","ally","majin","planned",null],
    ["vegito","Vegito","ally","majin","planned",null]
  ];
  const roster=Object.freeze(records.map(([id,name,role,arc,status,reference])=>
    Object.freeze({id,name,role,arc,status,reference:references[reference]||null})));
  const byId=new Map(roster.map(character=>[character.id,character]));
  const allowedNpc=Object.freeze(["idle","walk","talk"]);
  const allowedEncounter=Object.freeze(Object.keys(layout));
  const detailedSource="assets/campaign-cast/npc-atlas.png";
  const detailedGrid=Object.freeze({columns:8,rows:24});
  const detailedIds=artOrder.filter(id=>id!=="raditz");
  const sprites=new Map(artOrder.map((id,index)=>[id,Object.freeze({
    id,src:source,cell,grid,scale:.55,block:index*block+(index>2?40:0),
    role:id==="raditz"?"encounter":"npc",
    clips:id==="raditz"?allowedEncounter:allowedNpc
  })]));

  function getCharacter(id){return byId.get(id)||null}
  function getSprite(id){
    const sprite=sprites.get(id);
    const index=detailedIds.indexOf(id);
    return index<0?sprite||null:{...sprite,src:detailedSource,grid:detailedGrid,block:index*block};
  }

  function resolveFrame(sprite,direction,action,elapsedMs){
    if(!sprite||!sprite.clips.includes(action))return null;
    const d=directions.indexOf(direction);
    if(d<0)return null;
    const clip=layout[action];
    const elapsed=Math.floor(Math.max(0,Number(elapsedMs)||0)/clip.durationMs);
    const step=clip.loop?elapsed%clip.count:Math.min(clip.count-1,elapsed);
    const index=sprite.block+clip.start+d*clip.count+step;
    const side=direction==="left"||direction==="right";
    const bob={
      idle:[0,1],walk:[0,-1,0,-1],talk:[0,1],
      telegraph:[0,2],attack:[-2,-3],recovery:[0,1],hurt:[2,3],knockdown:[5,8]
    }[action][step];
    const lean={
      idle:[0,0],walk:[0,0,0,0],talk:[0,0],
      telegraph:[0,-2],attack:[2,5],recovery:[2,0],hurt:[-4,-3],knockdown:[-4,-7]
    }[action][step];
    const centerLean=side?lean:Math.sign(lean)*Math.round(Math.abs(lean)/2-(Math.abs(lean)%4===1?.5:0));
    const tall=sprite.id==="raditz"?5:sprite.id==="piccolo"?2:0;
    const top=27-tall+bob;
    const centerX=32+centerLean;
    const half=side?9:12;
    const left=[centerX-half-2,top+35-(action==="walk"&&step===1?2:0)];
    const right=[centerX+half+2,top+35-(action==="walk"&&step===3?2:0)];
    if(action==="talk"&&step===1){right[0]+=4;right[1]-=8}
    if(action==="attack"){right[0]+=5+step*3;right[1]-=6}
    const center=[direction==="left"?63-centerX:centerX,top+23];

    const frontHand=direction==="left"?[63-right[0],right[1]]:right;
    const leftHand=direction==="left"?frontHand:left;
    const rightHand=direction==="left"?[63-left[0],left[1]]:right;
    return {
      rect:[index%sprite.grid.columns*cell[0],Math.floor(index/sprite.grid.columns)*cell[1],...cell],
      feet:[32,88],center,leftHand,rightHand,
      muzzle:frontHand,
      flip:false,durationMs:clip.durationMs,loop:clip.loop
    };
  }

  function hash(value){
    let h=2166136261;
    for(const ch of String(value))h=Math.imul(h^ch.charCodeAt(0),16777619);
    return h>>>0;
  }

  function makeExtra(seed,index){
    const n=hash(String(seed)+":"+index);
    const kinds=["extra-earth","extra-indigo","extra-rust","extra-sage"];
    const names=["Aki","Nami","Jun","Fenn","Iona","Sora","Rin","Kota"];
    const roles=["villager","merchant","traveler","guard"];
    const spriteId=kinds[n%kinds.length];
    return {
      id:"extra-"+n.toString(36),
      name:names[Math.floor(n/8)%names.length],
      role:roles[Math.floor(n/64)%roles.length],
      spriteId,
      direction:directions[Math.floor(n/512)%directions.length]
    };
  }

  return Object.freeze({roster,getCharacter,getSprite,resolveFrame,makeExtra,directions,artOrder,layout,grid,cell,block});
});
