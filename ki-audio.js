/* Ki Fighter audio: music and sound effects.
 *
 *   KiAudio.music('coast' | 'ravine' | 'ridge' | 'village' | 'battle' | null)
 *   KiAudio.sfx('blip' | 'select' | 'confirm' | 'quest' | 'pickup' | 'portal' | 'door' |
 *               'punch' | 'kick' | 'kiBlast' | 'charge' | 'beam' | 'hurt' |
 *               'levelUp' | 'transform' | 'denied')
 *   KiAudio.setEnabled(bool), KiAudio.enabled, KiAudio.onChange(fn)
 *
 * By default everything is synthesised with the Web Audio API: calm ambient
 * music (soft pads, a gentle melody, reverb) and punchy anime-style effects.
 *
 * Your own sound files: list them in assets/audio/audio.json, e.g.
 *   {"sfx": {"kiBlast": "sfx/ki-blast.mp3", "beam": "sfx/beam.ogg"},
 *    "music": {"coast": "music/coast.mp3"}}
 * Paths are relative to assets/audio/. A listed file replaces the synthesised
 * sound or track; anything not listed keeps the built-in one.
 *
 * Audio starts on the first user gesture (browser autoplay rules). The on/off
 * choice is stored in localStorage and shared by every page of the game.
 */
(function(root){
'use strict';
const KEY='ki-fighter-audio-v1';
const MUSIC_LEVEL=.26,SFX_LEVEL=.7;
let enabled=true;
try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&typeof saved.enabled==='boolean')enabled=saved.enabled}catch{}
let ctx=null,master=null,musicBus=null,sfxBus=null,reverb=null,noise=null,drive=null;
let track=null,wanted=null,timer=null,step=0,nextTime=0,fileMusic=null;
const listeners=new Set();

// ---------------------------------------------------------------- user files
const files={sfx:{},music:{}},buffers=new Map();
let manifestLoaded=false;
function loadManifest(){
 if(manifestLoaded||typeof fetch!=='function')return;
 manifestLoaded=true;
 fetch('assets/audio/audio.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(m=>{
  if(!m)return;
  Object.assign(files.sfx,m.sfx||{});Object.assign(files.music,m.music||{});
  if(ctx)for(const p of Object.values(files.sfx))decode(p);
  if(track&&files.music[track]){const t=track;track=null;startMusic(t)}
 }).catch(()=>{});
}
function decode(path){
 if(buffers.has(path))return buffers.get(path);
 const job=fetch('assets/audio/'+path).then(r=>r.arrayBuffer()).then(b=>new Promise((ok,no)=>ctx.decodeAudioData(b,ok,no)))
  .then(buf=>{buffers.set(path,buf);return buf}).catch(()=>{buffers.delete(path);return null});
 buffers.set(path,job);
 return job;
}
function playFile(path,bus,{loop=false,gain=1}={}){
 const buf=buffers.get(path);
 if(!(buf instanceof AudioBuffer)){decode(path);return null}
 const s=ctx.createBufferSource(),g=ctx.createGain();
 s.buffer=buf;s.loop=loop;g.gain.value=gain;s.connect(g);g.connect(bus);s.start();
 return {s,g};
}

// ---------------------------------------------------------------- graph
function impulse(seconds,decay){
 const len=Math.floor(ctx.sampleRate*seconds),buf=ctx.createBuffer(2,len,ctx.sampleRate);
 for(let ch=0;ch<2;ch++){const d=buf.getChannelData(ch);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,decay)}
 return buf;
}
function ensure(){
 if(ctx)return ctx;
 const AC=root.AudioContext||root.webkitAudioContext;
 if(!AC)return null;
 ctx=new AC();
 master=ctx.createGain();master.gain.value=enabled?.85:0;master.connect(ctx.destination);
 const comp=ctx.createDynamicsCompressor();comp.threshold.value=-16;comp.ratio.value=3;comp.connect(master);
 // music: soft low-pass and a long, gentle reverb
 musicBus=ctx.createGain();musicBus.gain.value=MUSIC_LEVEL;
 const warm=ctx.createBiquadFilter();warm.type='lowpass';warm.frequency.value=3200;warm.Q.value=.3;
 musicBus.connect(warm);warm.connect(comp);
 reverb=ctx.createConvolver();reverb.buffer=impulse(3.2,2.6);
 const wet=ctx.createGain();wet.gain.value=.55;warm.connect(reverb);reverb.connect(wet);wet.connect(comp);
 // effects: a little saturation for weight, short room reverb
 sfxBus=ctx.createGain();sfxBus.gain.value=SFX_LEVEL;
 drive=ctx.createWaveShaper();
 const curve=new Float32Array(1024);for(let i=0;i<1024;i++){const x=i/512-1;curve[i]=Math.tanh(x*1.8)}
 drive.curve=curve;sfxBus.connect(drive);drive.connect(comp);
 const room=ctx.createConvolver();room.buffer=impulse(.9,3.5);const roomWet=ctx.createGain();roomWet.gain.value=.18;
 drive.connect(room);room.connect(roomWet);roomWet.connect(comp);
 const len=ctx.sampleRate*2;noise=ctx.createBuffer(1,len,ctx.sampleRate);
 const data=noise.getChannelData(0);for(let i=0;i<len;i++)data[i]=Math.random()*2-1;
 loadManifest();
 for(const p of Object.values(files.sfx))decode(p);
 return ctx;
}
function unlock(){
 if(!ensure())return;
 if(ctx.state==='suspended')ctx.resume();
 if(wanted&&!track)startMusic(wanted);
}
for(const type of ['pointerdown','keydown','touchstart'])root.addEventListener?.(type,unlock,{passive:true});
loadManifest();

const midi=n=>440*Math.pow(2,(n-69)/12);
const now=()=>ctx.currentTime;
function tone({freq,to=null,time=0,dur=.12,type='sine',gain=.2,bus=sfxBus,attack=.004,release=.06,detune=0,curve='exp',vibrato=0,vibratoRate=6,filter=0}){
 if(!ctx||!enabled)return;
 const t=(time||now());
 const o=ctx.createOscillator(),g=ctx.createGain();
 o.type=type;o.frequency.setValueAtTime(freq,t);o.detune.value=detune;
 if(to){if(curve==='exp')o.frequency.exponentialRampToValueAtTime(Math.max(20,to),t+dur);else o.frequency.linearRampToValueAtTime(to,t+dur)}
 if(vibrato){const l=ctx.createOscillator(),lg=ctx.createGain();l.frequency.value=vibratoRate;lg.gain.value=vibrato;l.connect(lg);lg.connect(o.frequency);l.start(t);l.stop(t+dur+.05)}
 g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+attack);
 g.gain.setValueAtTime(gain,t+Math.max(attack,dur-release));g.gain.linearRampToValueAtTime(0,t+dur);
 let out=o;
 if(filter){const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=filter;o.connect(f);out=f}
 out.connect(g);g.connect(bus);o.start(t);o.stop(t+dur+.02);
}
function hiss({time=0,dur=.15,gain=.2,from=3000,to=600,q=.8,bus=sfxBus,type='bandpass',attack=0}){
 if(!ctx||!enabled)return;
 const t=(time||now());
 const s=ctx.createBufferSource();s.buffer=noise;
 const f=ctx.createBiquadFilter();f.type=type;f.Q.value=q;
 f.frequency.setValueAtTime(from,t);f.frequency.exponentialRampToValueAtTime(Math.max(40,to),t+dur);
 const g=ctx.createGain();
 if(attack){g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+attack)}else g.gain.setValueAtTime(gain,t);
 g.gain.exponentialRampToValueAtTime(.001,t+dur);
 s.connect(f);f.connect(g);g.connect(bus);s.start(t,Math.random()*1.2);s.stop(t+dur+.02);
}
// electric crackle: a burst of very short clicks
function crackle({time=0,dur=.6,density=40,gain=.08}){
 const t=time||now();
 for(let i=0;i<dur*density;i++){
  const at=t+Math.random()*dur;
  hiss({time:at,dur:.012+Math.random()*.02,gain:gain*(.5+Math.random()),from:3000+Math.random()*5000,to:2000,q:3});
 }
}

// ---------------------------------------------------------------- music
// Calm, slow pieces: a soft pad holds each chord, a warm bass breathes under
// it, and a sparse bell-like melody wanders the scale (seeded per bar, so it
// varies without repeating mechanically). All original.
const tracks={
 village:{bpm:66,chords:[[60,64,67,71],[57,60,64,67],[53,57,60,64],[55,59,62,67]],scale:[0,2,4,7,9],key:60,lead:'triangle',density:.42},
 coast:{bpm:60,chords:[[57,61,64,69],[54,57,61,64],[50,54,57,62],[52,56,59,64]],scale:[0,2,4,7,9],key:57,lead:'sine',density:.36,waves:true},
 ravine:{bpm:58,chords:[[52,55,59,62],[48,52,55,59],[50,53,57,60],[47,50,54,57]],scale:[0,3,5,7,10],key:52,lead:'sine',density:.3},
 ridge:{bpm:64,chords:[[50,53,57,60],[46,50,53,57],[48,52,55,58],[45,49,52,57]],scale:[0,2,3,7,8],key:50,lead:'triangle',density:.38},
 battle:{bpm:92,chords:[[52,55,59],[48,52,55],[50,53,57],[47,51,54]],scale:[0,3,5,7,10],key:52,lead:'triangle',density:.55,pulse:true}
};
let rngState=1;
const rnd=()=>{rngState=(Math.imul(rngState,1664525)+1013904223)>>>0;return rngState/4294967296};
let melodyDeg=2;
function pad(chord,time,dur,t){
 for(const [k,n] of chord.entries()){
  // two slightly detuned voices per note, slow swell in and out
  for(const det of [-6,6])tone({freq:midi(n),time,dur,type:k===0?'triangle':'sine',gain:.045,bus:musicBus,attack:dur*.35,release:dur*.45,detune:det,filter:1400});
 }
 tone({freq:midi(chord[0]-12),time,dur:dur*.95,type:'sine',gain:.13,bus:musicBus,attack:.4,release:dur*.5});
}
function schedule(){
 if(!ctx||!track||fileMusic)return;
 const t=tracks[track],beat=60/t.bpm;
 while(nextTime<now()+.4){
  const barLen=beat*4,barIndex=Math.floor(step/8),bar=barIndex%t.chords.length,s=step%8;   // 8 half-beats per bar
  const time=nextTime,chord=t.chords[bar];
  if(s===0){
   rngState=(barIndex*2654435761+track.length*97)>>>0;
   pad(chord,time,barLen*1.05,t);
   if(t.waves)hiss({time,dur:barLen,gain:.05,from:500,to:300,q:.4,bus:musicBus,type:'lowpass',attack:barLen*.45});
  }
  if(t.pulse&&s%2===0)tone({freq:midi(chord[0]-12),time,dur:beat*.45,type:'triangle',gain:.07,bus:musicBus,attack:.02,release:.2,filter:600});
  // melody: a gentle random walk on the scale, resting often
  if(s%2===0&&rnd()<t.density){
   melodyDeg=Math.max(0,Math.min(9,melodyDeg+[-2,-1,-1,0,1,1,2][Math.floor(rnd()*7)]));
   const oct=Math.floor(melodyDeg/t.scale.length),note=t.key+12+t.scale[melodyDeg%t.scale.length]+12*oct;
   const len=beat*(rnd()<.35?2:1)*1.2;
   tone({freq:midi(note),time:time+(rnd()<.25?beat*.25:0),dur:len,type:t.lead,gain:.06,bus:musicBus,attack:.03,release:len*.7,filter:2400});
   tone({freq:midi(note+12),time,dur:len*.6,type:'sine',gain:.012,bus:musicBus,attack:.02,release:len*.5});   // bell shimmer
  }
  nextTime+=beat/2;step++;
 }
}
function stopFileMusic(){
 if(!fileMusic)return;
 const {s,g}=fileMusic;fileMusic=null;
 g.gain.setTargetAtTime(0,now(),.4);s.stop(now()+2);
}
function startMusic(name){
 track=name;step=0;nextTime=now()+.1;melodyDeg=2;
 clearInterval(timer);stopFileMusic();
 const path=files.music[name];
 if(path){
  const play=()=>{if(track!==name||fileMusic)return;fileMusic=playFile(path,musicBus,{loop:true,gain:1.4})};
  const buf=buffers.get(path);
  if(buf instanceof AudioBuffer)play();else decode(path).then(play);
  return;
 }
 timer=setInterval(schedule,80);schedule();
}
function music(name){
 wanted=tracks[name]?name:null;
 if(!ctx||ctx.state!=='running'){track=null;return}
 if(track===wanted)return;
 clearInterval(timer);stopFileMusic();track=null;
 if(wanted){
  musicBus.gain.cancelScheduledValues(now());
  musicBus.gain.setValueAtTime(0,now());
  musicBus.gain.linearRampToValueAtTime(MUSIC_LEVEL,now()+2.5);    // slow fade in
  startMusic(wanted);
 }
}

// ---------------------------------------------------------------- effects
// Anime-style energy sounds, synthesised: whooshes, charged hums with
// electric crackle, a roaring beam with sub-bass, a rising power-up scream.
const effects={
 blip(){tone({freq:880+Math.random()*120,dur:.035,type:'triangle',gain:.05})},
 select(){tone({freq:660,dur:.05,type:'triangle',gain:.08});tone({freq:990,time:now()+.045,dur:.06,type:'triangle',gain:.06})},
 confirm(){[523,659,784].forEach((f,i)=>tone({freq:f,time:now()+i*.05,dur:.12,type:'triangle',gain:.08}))},
 denied(){tone({freq:220,to:160,dur:.16,type:'triangle',gain:.08})},
 quest(){[659,784,988,1319].forEach((f,i)=>tone({freq:f,time:now()+i*.09,dur:.3,type:'triangle',gain:.1,release:.2}))},
 pickup(){tone({freq:988,dur:.07,type:'triangle',gain:.09});tone({freq:1319,time:now()+.06,dur:.18,type:'triangle',gain:.09,release:.12})},
 portal(){hiss({dur:.6,gain:.14,from:400,to:3200,q:1.2});tone({freq:220,to:660,dur:.5,type:'sine',gain:.08})},
 door(){hiss({dur:.35,gain:.1,from:900,to:300,q:.6,type:'lowpass'});tone({freq:140,to:90,dur:.18,type:'sine',gain:.12})},
 // melee: a fast swish, then a deep thump with a sharp crack on top
 punch(){
  hiss({dur:.07,gain:.16,from:2500,to:700,q:.9});
  const t=now()+.04;
  tone({freq:160,to:55,time:t,dur:.12,type:'sine',gain:.42});
  hiss({time:t,dur:.06,gain:.32,from:4500,to:1200,q:.6});
 },
 kick(){
  hiss({dur:.12,gain:.2,from:1800,to:400,q:.8});
  const t=now()+.07;
  tone({freq:130,to:40,time:t,dur:.18,type:'sine',gain:.5});
  hiss({time:t,dur:.09,gain:.36,from:3800,to:900,q:.5});
 },
 // ki blast: a bright zap that drops into a whoosh, with a tail of sparks
 kiBlast(){
  tone({freq:1700,to:380,dur:.18,type:'sawtooth',gain:.07,filter:5000});
  tone({freq:900,to:200,dur:.25,type:'square',gain:.04,filter:3000,detune:12});
  hiss({dur:.35,gain:.2,from:6000,to:700,q:.9});
  hiss({time:now()+.05,dur:.4,gain:.12,from:900,to:180,q:.5,type:'lowpass'});
  crackle({time:now()+.04,dur:.22,density:45,gain:.05});
 },
 // charge: a low, rising energy hum that wavers, with electric crackle
 charge(){
  const d=1.6;
  tone({freq:70,to:160,dur:d,type:'sawtooth',gain:.14,attack:.25,release:.4,vibrato:6,vibratoRate:9,filter:700,curve:'lin'});
  tone({freq:140,to:330,dur:d,type:'triangle',gain:.07,attack:.3,release:.4,vibrato:10,vibratoRate:13,curve:'lin'});
  hiss({dur:d,gain:.14,from:300,to:2600,q:1.4,attack:.4});
  crackle({dur:d,density:30,gain:.06});
 },
 // beam: a big launch boom, then a sustained roar with sub-bass rumble
 beam(){
  const t=now(),d=1.8;
  tone({freq:90,to:38,time:t,dur:.5,type:'sine',gain:.6});
  hiss({time:t,dur:.25,gain:.4,from:5000,to:1500,q:.5});
  tone({freq:62,to:50,time:t+.05,dur:d,type:'sawtooth',gain:.16,attack:.1,release:.6,vibrato:3,vibratoRate:17,filter:420});
  hiss({time:t+.05,dur:d,gain:.32,from:1400,to:500,q:.4,type:'lowpass',attack:.08});
  hiss({time:t+.05,dur:d,gain:.12,from:3800,to:2200,q:1.6});
  tone({freq:440,to:300,time:t+.05,dur:d*.8,type:'triangle',gain:.04,vibrato:14,vibratoRate:11,release:.6});
  crackle({time:t+.1,dur:d*.8,density:28,gain:.05});
 },
 hurt(){tone({freq:300,to:110,dur:.18,type:'sawtooth',gain:.1,filter:1800});hiss({dur:.12,gain:.18,from:2500,to:700})},
 levelUp(){[523,659,784,1047,1319].forEach((f,i)=>tone({freq:f,time:now()+i*.08,dur:.3,type:'triangle',gain:.09,release:.2}));hiss({time:now()+.3,dur:.6,gain:.06,from:3000,to:8000,q:2})},
 // transformation: a rising scream of energy, crackling harder, ending in a boom and shimmer
 transform(){
  const t=now(),d=1.5;
  tone({freq:90,to:520,time:t,dur:d,type:'sawtooth',gain:.13,attack:.2,release:.15,vibrato:14,vibratoRate:7,filter:2200});
  tone({freq:180,to:1040,time:t,dur:d,type:'square',gain:.04,attack:.3,release:.15,vibrato:20,vibratoRate:9,filter:3000});
  hiss({time:t,dur:d,gain:.22,from:250,to:6000,q:.8,attack:.5});
  crackle({time:t+.2,dur:d-.2,density:60,gain:.08});
  tone({freq:70,to:30,time:t+d,dur:.7,type:'sine',gain:.6});
  hiss({time:t+d,dur:.6,gain:.4,from:6000,to:600,q:.4});
  [880,1109,1319,1760].forEach((f,i)=>tone({freq:f,time:t+d+.05+i*.05,dur:.6,type:'triangle',gain:.05,release:.45}));
 }
};
function sfx(name){
 if(!enabled)return;
 if(!ensure()||ctx.state!=='running')return;
 const path=files.sfx[name];
 if(path&&playFile(path,sfxBus))return;
 effects[name]?.();
}

function setEnabled(on){
 enabled=!!on;
 try{localStorage.setItem(KEY,JSON.stringify({enabled}))}catch{}
 if(ctx){
  master.gain.cancelScheduledValues(now());
  master.gain.setTargetAtTime(enabled?.85:0,now(),.05);
 }
 for(const fn of listeners)fn(enabled);
}
root.KiAudio={music,sfx,setEnabled,get enabled(){return enabled},onChange(fn){listeners.add(fn);return()=>listeners.delete(fn)},tracks:Object.keys(tracks),effects:Object.keys(effects)};
})(typeof window!=='undefined'?window:globalThis);
