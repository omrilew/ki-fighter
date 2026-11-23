(function exposeAnimation(root){
  'use strict';

  const clamp01=value=>Math.min(1,Math.max(0,value));
  const ease=value=>{
    const t=clamp01(value);
    return t*t*(3-2*t);
  };
  const damp=(current,target,dt,rate)=>target+(current-target)*Math.exp(-Math.max(0,dt)*rate);

  // Each key has a normalized time followed by channel values in track order.
  function sample(track,time){
    const {channels,keys}=track;
    const position=clamp01(time);
    let right=1;
    while(right<keys.length-1&&position>keys[right][0])right++;
    const from=keys[right-1],to=keys[right];
    const blend=ease((position-from[0])/(to[0]-from[0]));
    const pose={};
    channels.forEach((channel,index)=>{
      pose[channel]=from[index+1]+(to[index+1]-from[index+1])*blend;
    });
    return pose;
  }

  // Pairs two authored sprite frames for a smooth visual transition.
  function framesAt(sequence,time){
    const position=clamp01(time);
    let right=1;
    while(right<sequence.length-1&&position>sequence[right][0])right++;
    const from=sequence[right-1],to=sequence[right];
    return {
      first:from[1],
      second:to[1],
      blend:from[1]===to[1]?0:ease((position-from[0])/(to[0]-from[0])),
    };
  }

  function actionPhase(elapsed,windup,recovery,impact=.54){
    if(elapsed<=windup)return clamp01(elapsed/windup)*impact;
    return impact+clamp01((elapsed-windup)/recovery)*(1-impact);
  }

  const clips={
    strike:{
      channels:['weight','reach','lift'],
      keys:[[0,0,-.20,0],[.14,0,-.30,.10],[.35,1,.91,.7],
        [.49,1,1,.38],[.72,.88,.50,.2],[.92,0,0,0],[1,0,0,0]],
    },
    kick:{
      channels:['weight','reach','lift'],
      keys:[[0,0,0,0],[.18,.08,-.14,.65],[.38,1,1,1.5],
        [.57,1,.87,1],[.76,.76,.40,.25],[.94,0,0,0],[1,0,0,0]],
    },
    lunge:{
      channels:['reach','lift','shear','bend'],
      keys:[[0,0,0,0,1],[.32,-.48,.20,-.05,.955],[.54,1,1,.12,1.035],
        [.69,.58,.55,.08,1.01],[.85,.14,.08,.016,1],[1,0,0,0,1]],
    },
    throw:{
      channels:['reach','lift','shear','bend'],
      keys:[[0,0,0,0,1],[.38,-.26,.53,-.07,.97],[.54,.66,.82,.08,1.025],
        [.67,.30,.38,.03,1.005],[1,0,0,0,1]],
    },
    recoil:{
      channels:['offset','tilt','flash'],
      keys:[[0,1,1,1],[.40,.67,.56,.64],[1,0,0,0]],
    },
    fall:{
      channels:['offset','tilt','height','opacity'],
      keys:[[0,0,0,1,1],[.38,.56,.30,.83,.77],[.71,.90,.82,.70,.31],[1,1,1,.65,0]],
    },
  };


  // Canonical animation inventory. Sprite atlases must be validated against
  // these contracts before the runtime is switched away from legacy rendering.
  const frameSize=Object.freeze({width:64,height:96});
  const clipFrames=Object.freeze({
    idle:8,walkDown:8,walkUp:8,walkLeft:8,walkRight:8,
    lightAttack:6,heavyAttack:8,airAttack:6,dash:8,dashAttack:8,
    kiBlast:10,charge:12,jump:4,land:4,crouch:4,hurt:4,ko:6
  });
  const effectFrames=Object.freeze({
    aura:8,energyRing:6,shockwave:8,kiProjectile:6,impact:6,
    lightning:8,energyParticles:8,debris:8,dashTrail:6
  });
  const transformationFrames=12;
  const animationCatalog=Object.freeze({
    frameSize,forms:Object.freeze(['normal','ssj']),clips:clipFrames,
    transformationFrames,effects:effectFrames
  });
  function validateAtlasManifest(manifest){
    const errors=[];
    if(!manifest||typeof manifest!=='object')return {valid:false,errors:['Missing manifest']};
    for(const form of animationCatalog.forms){
      const clips=manifest.forms?.[form];
      if(!clips){errors.push('Missing form '+form);continue}
      for(const [name,count] of Object.entries(clipFrames)){
        const entry=clips[name];
        if(!entry||!Array.isArray(entry.frames)||entry.frames.length!==count)
          errors.push(form+'.'+name+': expected '+count+' frames');
      }
    }
    if(!Array.isArray(manifest.transformation?.frames)||
       manifest.transformation.frames.length!==transformationFrames)
      errors.push('transformation: expected '+transformationFrames+' frames');
    for(const [name,count] of Object.entries(effectFrames)){
      if(!Array.isArray(manifest.effects?.[name]?.frames)||
         manifest.effects[name].frames.length!==count)
        errors.push('effects.'+name+': expected '+count+' frames');
    }
    return {valid:errors.length===0,errors};
  }
  function resolveClip(form,action,direction){
    const suffix=({up:'Up',down:'Down',left:'Left',right:'Right'})[direction];
    const directional=action==='walk'&&suffix?'walk'+suffix:action;
    if(!animationCatalog.forms.includes(form)||!(directional in clipFrames))
      return null;
    return {form,clip:directional,frames:clipFrames[directional]};
  }

  root.KiAnimation={ease,damp,sample,framesAt,actionPhase,clips,animationCatalog,validateAtlasManifest,resolveClip};
})(globalThis);
