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

  root.KiAnimation={ease,damp,sample,framesAt,actionPhase,clips};
})(globalThis);
