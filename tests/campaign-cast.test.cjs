const {test}=require("node:test");
const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
const {join}=require("node:path");
const cast=require("../campaign-cast.js");

test("the named cast covers the planned arcs and reports sprite availability",()=>{
  assert.deepEqual([...new Set(cast.roster.map(character=>character.arc))],
    ["opening","saiyan","namek","android-cell","majin"]);
  assert.equal(new Set(cast.roster.map(character=>character.id)).size,cast.roster.length);
  for(const id of ["bulma","piccolo","raditz"]){
    assert.match(cast.getCharacter(id).reference,/^https:\/\/en\.dragon-ball-official\.com\//);
    assert.ok(cast.getSprite(id));
  }
  assert.equal(cast.getCharacter("gohan").status,"planned");
  assert.equal(cast.getSprite("gohan"),null);
  assert.equal(cast.getCharacter("unknown"),null);
});

test("the opening atlas cells, timing and anchors match the renderer contract",()=>{
  const cells=new Set();
  for(const id of cast.artOrder){
    const sprite=cast.getSprite(id);
    const png=readFileSync(join(__dirname,"..",sprite.src));
    assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[768,2112]);
    for(const action of sprite.clips){
      const clip=cast.layout[action];
      for(const direction of cast.directions){
        const sequence=Array.from({length:clip.count},(_,step)=>
          cast.resolveFrame(sprite,direction,action,step*clip.durationMs));
        for(const frame of sequence){
          const [x,y,w,h]=frame.rect;
          assert.ok(Number.isInteger(x/w)&&Number.isInteger(y/h));
          assert.ok(x>=0&&x+w<=768&&y>=0&&y+h<=2112);
          assert.ok(!cells.has(frame.rect.join(",")));
          cells.add(frame.rect.join(","));
          assert.equal(frame.flip,false);
          assert.deepEqual(frame.feet,[32,88]);
          for(const anchor of [frame.center,frame.leftHand,frame.rightHand,frame.muzzle]){
            assert.ok(anchor[0]>0&&anchor[0]<w&&anchor[1]>0&&anchor[1]<h);
          }
        }
        assert.deepEqual(cast.resolveFrame(sprite,direction,action,clip.count*clip.durationMs),
          clip.loop?sequence[0]:sequence.at(-1));
      }
    }
  }
  assert.equal(cells.size,264);
  assert.equal(cast.resolveFrame(cast.getSprite("bulma"),"south","idle",0),null);
  assert.equal(cast.resolveFrame(cast.getSprite("bulma"),"down","attack",0),null);
});

test("seeded extras remain stable and use authored opening sprite variants",()=>{
  const extras=Array.from({length:40},(_,index)=>cast.makeExtra("earth-opening",index));
  assert.deepEqual(extras,extras.map((_,index)=>cast.makeExtra("earth-opening",index)));
  assert.equal(new Set(extras.map(extra=>extra.id)).size,extras.length);
  assert.equal(new Set(extras.map(extra=>extra.spriteId)).size,4);
  assert.ok(extras.every(extra=>cast.getSprite(extra.spriteId)&&cast.directions.includes(extra.direction)));
});
