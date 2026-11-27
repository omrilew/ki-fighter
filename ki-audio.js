/* Ki Fighter audio: original chiptune music and sound effects synthesised
 * with the Web Audio API (no audio files, nothing sampled).
 *
 *   KiAudio.music('coast' | 'ravine' | 'ridge' | 'village' | 'battle' | null)
 *   KiAudio.sfx('blip' | 'select' | 'confirm' | 'quest' | 'pickup' | 'portal' |
 *               'punch' | 'kick' | 'kiBlast' | 'charge' | 'beam' | 'hurt' |
 *               'levelUp' | 'transform' | 'denied')
 *   KiAudio.setEnabled(bool), KiAudio.enabled, KiAudio.onChange(fn)
 *
 * Audio starts on the first user gesture (browser autoplay rules). The on/off
 * choice is stored in localStorage and shared by every page of the game.
 */
(function(root){
'use strict';
const KEY='ki-fighter-audio-v1';
let enabled=true;
try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&typeof saved.enabled==='boolean')enabled=saved.enabled}catch{}
let ctx=null,master=null,musicBus=null,sfxBus=null,noise=null;
let track=null,wanted=null,timer=null,step=0,nextTime=0;
const listeners=new Set();

function ensure(){
 if(ctx)return ctx;
 const AC=root.AudioContext||root.webkitAudioContext;
 if(!AC)return null;
 ctx=new AC();
 master=ctx.createGain();master.gain.value=enabled?.8:0;master.connect(ctx.destination);
 const comp=ctx.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=4;comp.connect(master);
 musicBus=ctx.createGain();musicBus.gain.value=.34;musicBus.connect(comp);
 sfxBus=ctx.createGain();sfxBus.gain.value=.62;sfxBus.connect(comp);
 const len=ctx.sampleRate;noise=ctx.createBuffer(1,len,ctx.sampleRate);
 const data=noise.getChannelData(0);for(let i=0;i<len;i++)data[i]=Math.random()*2-1;
 return ctx;
}
function unlock(){
 if(!ensure())return;
 if(ctx.state==='suspended')ctx.resume();
 if(wanted&&!track)startMusic(wanted);
}
for(const type of ['pointerdown','keydown','touchstart'])root.addEventListener?.(type,unlock,{passive:true});

const midi=n=>440*Math.pow(2,(n-69)/12);
function tone({freq,to=null,time=0,dur=.12,type='square',gain=.2,bus=sfxBus,attack=.004,release=.06,detune=0}){
 if(!ctx||!enabled)return;
 const t=(time||ctx.currentTime);
 const o=ctx.createOscillator(),g=ctx.createGain();
 o.type=type;o.frequency.setValueAtTime(freq,t);o.detune.value=detune;
 if(to)o.frequency.exponentialRampToValueAtTime(Math.max(20,to),t+dur);
 g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+attack);
 g.gain.setValueAtTime(gain,t+Math.max(attack,dur-release));g.gain.linearRampToValueAtTime(0,t+dur);
 o.connect(g);g.connect(bus);o.start(t);o.stop(t+dur+.02);
}
function hiss({time=0,dur=.15,gain=.2,from=3000,to=600,q=.8,bus=sfxBus,type='bandpass'}){
 if(!ctx||!enabled)return;
 const t=(time||ctx.currentTime);
 const s=ctx.createBufferSource();s.buffer=noise;
 const f=ctx.createBiquadFilter();f.type=type;f.Q.value=q;
 f.frequency.setValueAtTime(from,t);f.frequency.exponentialRampToValueAtTime(Math.max(40,to),t+dur);
 const g=ctx.createGain();g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);
 s.connect(f);f.connect(g);g.connect(bus);s.start(t,Math.random()*.5);s.stop(t+dur+.02);
}

// ---------------------------------------------------------------- music
// Each track: tempo, steps per bar, chord roots per bar (MIDI), a scale,
// and generator functions returning note offsets per step. All original.
const tracks={
 coast:{bpm:92,bars:[57,53,60,55],scale:[0,2,4,7,9],lead:[0,2,4,2,7,4,2,0,4,7,9,7,4,2,4,-1],wave:'triangle',pad:'sine'},
 ravine:{bpm:80,bars:[52,52,48,50],scale:[0,3,5,7,10],lead:[0,-1,3,-1,5,3,-1,0,7,5,3,-1,0,-1,-1,-1],wave:'square',pad:'triangle',minor:true},
 ridge:{bpm:118,bars:[50,50,46,48],scale:[0,3,5,7,8,10],lead:[0,0,3,5,7,-1,5,3,8,7,5,3,5,-1,3,-1],wave:'square',pad:'sawtooth',minor:true,drums:true},
 village:{bpm:100,bars:[55,60,57,53],scale:[0,2,4,5,7,9],lead:[4,-1,7,4,2,-1,0,2,4,5,7,-1,9,7,4,-1],wave:'triangle',pad:'sine',drums:true},
 battle:{bpm:138,bars:[52,52,48,50],scale:[0,3,5,7,10],lead:[0,3,5,7,10,7,5,3,0,3,5,8,7,5,3,-1],wave:'square',pad:'sawtooth',minor:true,drums:true}
};
function chordTones(root,minor){return [root,root+(minor?3:4),root+7]}
function schedule(){
 if(!ctx||!track)return;
 const t=tracks[track],spb=60/t.bpm/2;   // eighth notes
 while(nextTime<ctx.currentTime+.25){
  const bar=Math.floor(step/16)%t.bars.length,s=step%16,root=t.bars[bar];
  const time=nextTime;
  // bass: root on 1 and 3, fifth on the off beats
  if(s%4===0)tone({freq:midi(root-12+(s===8?7:0)),time,dur:spb*1.8,type:'triangle',gain:.22,bus:musicBus,release:.08});
  // arpeggio
  const chord=chordTones(root,t.minor);
  if(s%2===1)tone({freq:midi(chord[(s>>1)%3]+12),time,dur:spb*.9,type:t.pad==='sine'?'sine':'square',gain:.05,bus:musicBus});
  // lead melody (second half of every two bars varies by one step)
  const note=t.lead[(s+(bar%2)*0)%16];
  if(note>=0){
   const deg=t.scale[note%t.scale.length]+12*Math.floor(note/t.scale.length);
   const varied=bar===3&&s>11?deg+2:deg;
   tone({freq:midi(root+12+varied),time,dur:spb*1.6,type:t.wave,gain:.085,bus:musicBus,release:.1});
  }
  if(t.drums){
   if(s%8===0)tone({freq:150,to:45,time,dur:.14,type:'sine',gain:.32,bus:musicBus});
   if(s%8===4)hiss({time,dur:.09,gain:.12,from:2200,to:1200,bus:musicBus});
   if(s%2===0)hiss({time,dur:.03,gain:.035,from:9000,to:7000,q:2,bus:musicBus,type:'highpass'});
  }
  nextTime+=spb;step++;
 }
}
function startMusic(name){
 track=name;step=0;nextTime=ctx.currentTime+.08;
 clearInterval(timer);timer=setInterval(schedule,60);schedule();
}
function music(name){
 wanted=tracks[name]?name:null;
 if(!ctx||ctx.state!=='running'){track=null;return}
 if(track===wanted)return;
 clearInterval(timer);track=null;
 if(wanted){
  musicBus.gain.cancelScheduledValues(ctx.currentTime);
  musicBus.gain.setValueAtTime(0,ctx.currentTime);
  musicBus.gain.linearRampToValueAtTime(.34,ctx.currentTime+.8);
  startMusic(wanted);
 }
}

// ---------------------------------------------------------------- effects
const effects={
 blip(){tone({freq:880+Math.random()*120,dur:.035,type:'square',gain:.05})},
 select(){tone({freq:660,dur:.05,gain:.09});tone({freq:990,time:ctx.currentTime+.045,dur:.05,gain:.07})},
 confirm(){[523,659,784].forEach((f,i)=>tone({freq:f,time:ctx.currentTime+i*.05,dur:.09,gain:.09}))},
 denied(){tone({freq:220,to:160,dur:.16,type:'sawtooth',gain:.08})},
 quest(){[659,784,988,1319].forEach((f,i)=>tone({freq:f,time:ctx.currentTime+i*.08,dur:.16,type:'triangle',gain:.13}))},
 pickup(){tone({freq:988,dur:.06,gain:.1});tone({freq:1319,time:ctx.currentTime+.06,dur:.12,gain:.1})},
 portal(){hiss({dur:.5,gain:.16,from:400,to:3200,q:1.2});tone({freq:220,to:660,dur:.45,type:'sine',gain:.1})},
 punch(){hiss({dur:.08,gain:.3,from:1800,to:300,q:.7});tone({freq:140,to:60,dur:.09,type:'sine',gain:.3})},
 kick(){hiss({dur:.11,gain:.3,from:1200,to:200,q:.6});tone({freq:110,to:45,dur:.13,type:'sine',gain:.34})},
 kiBlast(){tone({freq:1200,to:300,dur:.22,type:'sawtooth',gain:.09});hiss({dur:.2,gain:.1,from:5000,to:1500,q:1.5})},
 charge(){tone({freq:180,to:720,dur:.55,type:'sawtooth',gain:.07});hiss({dur:.55,gain:.06,from:800,to:4000,q:3})},
 beam(){hiss({dur:1.1,gain:.24,from:900,to:400,q:.5,type:'lowpass'});tone({freq:90,to:70,dur:1.1,type:'sawtooth',gain:.12});tone({freq:660,to:440,dur:.5,type:'square',gain:.05})},
 hurt(){tone({freq:300,to:120,dur:.16,type:'square',gain:.12});hiss({dur:.1,gain:.15,from:2500,to:800})},
 levelUp(){[523,659,784,1047,1319].forEach((f,i)=>tone({freq:f,time:ctx.currentTime+i*.07,dur:.18,type:'square',gain:.09}))},
 transform(){tone({freq:110,to:880,dur:1.2,type:'sawtooth',gain:.1});hiss({dur:1.3,gain:.18,from:300,to:6000,q:.8});
  [880,1109,1319].forEach((f,i)=>tone({freq:f,time:ctx.currentTime+1.15+i*.06,dur:.35,type:'triangle',gain:.1}))}
};
function sfx(name){
 if(!enabled)return;
 if(!ensure()||ctx.state!=='running')return;
 effects[name]?.();
}

function setEnabled(on){
 enabled=!!on;
 try{localStorage.setItem(KEY,JSON.stringify({enabled}))}catch{}
 if(ctx){
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(enabled?.8:0,ctx.currentTime,.05);
 }
 for(const fn of listeners)fn(enabled);
}
root.KiAudio={music,sfx,setEnabled,get enabled(){return enabled},onChange(fn){listeners.add(fn);return()=>listeners.delete(fn)},tracks:Object.keys(tracks)};
})(typeof window!=='undefined'?window:globalThis);
