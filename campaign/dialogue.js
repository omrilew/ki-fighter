/* Chapter One conversations and side quests.
 *
 * Every character can be talked to at any time. A conversation opens with
 * the story beat if one is due ("main"), otherwise with a greeting, then
 * offers the topics whose `when` matches the current story stage and quest
 * state. Topics the player has read are dimmed, not removed.
 *
 *   when: {from, to}       story stages (inclusive) in which the topic shows
 *         quest: {id, is}  'none' | 'active' | 'ready' | 'done'
 *   main: true             the story beat; plays automatically, then `next`
 *   next                   story stage to advance to
 *   start / finish         quest id to start / complete
 *
 * Original dialogue written for this game.
 */
(function(root){
'use strict';
const stages=['briefing','investigate','meet-piccolo','confront','challenge','fight','victory'];

const quests={
 'pod-scrap':{title:'Plating from the sky',goal:3,
  hint:count=>`Collect pod plating in the ravine (${count}/3).`,ready:'Bring the plating to Bulma.'},
 'ki-focus':{title:'Feel his energy',goal:1,
  hint:()=>'Focus your ki at the ridge lookout.',ready:'Tell Piccolo what you sensed.'},
 'raider-bounty':{title:'Raiders in the ravine',goal:4,
  hint:count=>`Defeat raiders in Landing Ravine (${count}/4).`,ready:'Tell Bulma the ravine is clear.'}
};

const characters={
 bulma:{name:'Bulma',role:'Inventor · Capsule tracker',
  greeting:{
   briefing:['Goku! Over here!'],
   investigate:['Did you find it yet? The ravine is just east of here.'],
   default:['Still in one piece? Good. Tell me everything when you get back.']},
  topics:[
   {id:'bulma-briefing',main:true,when:{from:'briefing',to:'briefing'},next:'investigate',label:'What happened?',lines:[
    'Goku! You felt that too, right? Something came down out of the sky a few minutes ago.',
    'My tracker followed it inland, then the signal just stopped, right at the ravine.',
    'Here’s the weird part: it slowed down before it hit. Meteors don’t brake.',
    'Go take a look before anyone wanders over there. Follow the trail east.']},
   {id:'bulma-reunion',when:{from:'briefing',to:'confront'},label:'Why are you out here?',lines:[
    'Everyone’s at the house for the reunion. Krillin, Master Roshi, the whole crowd.',
    'I was showing off my new tracker when it started beeping like crazy.',
    'Gohan’s inside with them. Don’t worry, nobody’s letting him near a crater.']},
   {id:'bulma-signal',when:{from:'investigate',to:'victory'},label:'About the signal',lines:[
    'The reading doesn’t look like metal. It looks like energy, a lot of it, packed into something small.',
    'If it’s a ship, somebody built it to cross a very long distance. Alone.']},
   {id:'bulma-quest',when:{from:'investigate',to:'victory',quest:{id:'pod-scrap',is:'none'}},start:'pod-scrap',label:'Need anything from the ravine?',lines:[
    'Actually, yes! If that thing came in hard, pieces of it must be lying around.',
    'Bring me three bits of the plating. I want to know what it’s made of.']},
   {id:'bulma-quest-progress',when:{from:'investigate',to:'victory',quest:{id:'pod-scrap',is:'active'}},label:'About the plating',repeat:true,lines:[
    'Three pieces of plating, Goku. Look around the impact site in the ravine.']},
   {id:'bulma-quest-done',when:{from:'investigate',to:'victory',quest:{id:'pod-scrap',is:'ready'}},finish:'pod-scrap',label:'Here’s the plating',lines:[
    'Let me see... It’s lighter than anything we make, and there isn’t a single scratch on it.',
    'It survived falling out of the sky. Whoever built that pod is way ahead of us.',
    'Goku, whatever was inside it, be careful. I mean it.']},
   {id:'bulma-bounty',when:{from:'investigate',to:'victory',quest:{id:'raider-bounty',is:'none'}},start:'raider-bounty',label:'Anything else going on?',lines:[
    'Raiders have been camping in the ravine since the crash. They think the pod is treasure.',
    'If you knock four of them out, I can get my equipment in there safely. Good practice for you, too.']},
   {id:'bulma-bounty-progress',when:{from:'investigate',to:'victory',quest:{id:'raider-bounty',is:'active'}},label:'About the raiders',repeat:true,lines:[
    'Four raiders in the ravine, Goku. They come back if you leave them alone, so don’t dawdle.']},
   {id:'bulma-bounty-done',when:{from:'investigate',to:'victory',quest:{id:'raider-bounty',is:'ready'}},finish:'raider-bounty',label:'The ravine is clear',lines:[
    'Nice work! Here, I found this charm in the house. It’s supposed to make you lighter on your feet.']},
   {id:'bulma-victory',when:{from:'victory',to:'victory'},label:'It’s over',lines:[
    'You beat him? A real alien, from another planet... and he was your brother?',
    'I need a minute. And then I need everything you can tell me about that scouter.']},
   {id:'bulma-standoff',when:{from:'confront',to:'fight'},label:'There’s a stranger on the ridge',lines:[
    'Piccolo AND a visitor from space on the same afternoon? Some reunion.',
    'If he really came in that pod, he didn’t come to sightsee.']}
  ]},
 piccolo:{name:'Piccolo',role:'Rival · Watching the ridge',
  greeting:{
   briefing:['...'],investigate:['...'],
   'meet-piccolo':['Took you long enough.'],
   default:['Stop wasting time talking to me.']},
  topics:[
   {id:'piccolo-witness',main:true,when:{from:'meet-piccolo',to:'meet-piccolo'},next:'confront',label:'You saw it land?',lines:[
    'Don’t get the wrong idea, Goku. I’m not here to help you.',
    'That traveler crossed the ravine like the ground meant nothing to him. His energy is enormous.',
    'He’s waiting further along the ridge. Find out what he wants. I’ll hold the edge.']},
   {id:'piccolo-why',when:{from:'meet-piccolo',to:'victory'},label:'Why are you here?',lines:[
    'This planet is mine to conquer. I won’t let some outsider take it first.',
    'When this is over, you and I still have a score to settle. Don’t forget it.']},
   {id:'piccolo-quest',when:{from:'meet-piccolo',to:'victory',quest:{id:'ki-focus',is:'none'}},start:'ki-focus',label:'How strong is he?',lines:[
    'You rely on your eyes too much. Go to the lookout, close your eyes, and feel for him.',
    'Ki has weight. Learn to read it and nobody will ever catch you off guard.']},
   {id:'piccolo-quest-progress',when:{from:'meet-piccolo',to:'victory',quest:{id:'ki-focus',is:'active'}},label:'The lookout?',repeat:true,lines:[
    'Up at the lookout. Stop talking and start feeling.']},
   {id:'piccolo-quest-done',when:{from:'meet-piccolo',to:'victory',quest:{id:'ki-focus',is:'ready'}},finish:'ki-focus',label:'I felt it',lines:[
    'Cold and heavy, wasn’t it? Now you know what we’re up against.',
    'Remember that feeling. The next time it gets close, you won’t need your eyes.']},
   {id:'piccolo-ready',when:{from:'challenge',to:'fight'},label:'Can we beat him?',lines:[
    'Not as we are. Get stronger first: hit the dummies on the coast, clear the raiders, meditate at the lookout.',
    'When you’re ready, he’s waiting. I won’t wait forever.']},
   {id:'piccolo-victory',when:{from:'victory',to:'victory'},main:true,label:'We did it',lines:[
    'Hmph. Not bad. That scouter of his was reading our power the whole fight.',
    'He said more of them are coming. Stronger ones. Train, Goku. We’ll need it.']},
   {id:'piccolo-brother',when:{from:'challenge',to:'victory'},label:'He called me his brother',lines:[
    'Brother... So you aren’t from this world either. That explains a few things.',
    'Family or not, he didn’t cross space to talk. Get ready.']}
  ]},
 raditz:{name:'Raditz',role:'Traveler from space',
  greeting:{
   briefing:['He watches the horizon and ignores you.'],
   investigate:['He watches the horizon and ignores you.'],
   'meet-piccolo':['He glances at you, then smirks, as if he already knows your name.'],
   default:['Well? I’m waiting, little brother.']},
  topics:[
   {id:'raditz-standoff',main:true,when:{from:'confront',to:'confront'},next:'challenge',label:'Who are you?',lines:[
    'So this is where you’ve been hiding, Kakarot. This planet has made you soft.',
    'You don’t remember? You were sent here as a baby to clear this world for our people.',
    'I am Raditz, your elder brother. We are Saiyans, and there is work waiting for warriors like us.',
    'Leave this planet with me, and the people here can stay out of it.']},
   {id:'raditz-name',when:{from:'challenge',to:'challenge'},label:'Why call me Kakarot?',lines:[
    'It’s the name you were born with. “Goku” is something these Earthlings gave you.',
    'A Saiyan’s strength, and you spent it farming and playing with children.']},
   {id:'raditz-saiyans',when:{from:'challenge',to:'challenge'},label:'What happened to our people?',lines:[
    'Our home world is gone. Only a handful of Saiyans are left, and every one of them is needed.',
    'You should be grateful I came all this way for you.']},
   {id:'raditz-refuse',when:{from:'challenge',to:'challenge'},next:'fight',fight:true,label:'I’m not going anywhere (fight)',lines:[
    'Then you leave me no choice.',
    'Let’s see what this planet taught you, Kakarot!']}
  ]}
};

// Places (non-character points) with short narration.
const places={
 'inspect-pod':{main:true,next:'meet-piccolo',lines:[
  'A round pod sits at the bottom of a fresh crater, its hatch wide open.',
  'It’s empty. Footprints lead out of the crater and up toward the ridge.']},
 'ridge-lookout':{quest:'ki-focus',lines:[
  'You close your eyes and slow your breathing.',
  'Far along the ridge, an energy waits, heavy and cold. Behind you, Piccolo’s: sharp and steady.']},
 pickup:{quest:'pod-scrap',lines:['A curved piece of pod plating, still warm. You pick it up.']}
};

function stageIndex(stage){return stages.indexOf(stage)}
function matches(topic,state){
 const w=topic.when||{};
 const i=stageIndex(state.stage);
 if(w.from&&i<stageIndex(w.from))return false;
 if(w.to&&i>stageIndex(w.to))return false;
 if(w.quest&&questState(state,w.quest.id)!==w.quest.is)return false;
 return true;
}
function questState(state,id){
 const q=state.quests[id];
 if(!q)return 'none';
 if(q.done)return 'done';
 return q.count>=quests[id].goal?'ready':'active';
}
function topicsFor(id,state){return (characters[id]?.topics||[]).filter(t=>matches(t,state))}
function greetingFor(id,state){
 const g=characters[id]?.greeting||{};
 return g[state.stage]||g.default||['...'];
}
function questLines(state){
 return Object.keys(quests).filter(id=>questState(state,id)==='active'||questState(state,id)==='ready')
  .map(id=>questState(state,id)==='ready'?quests[id].ready:quests[id].hint(state.quests[id].count));
}

root.KFDialogue={stages,quests,characters,places,topicsFor,greetingFor,questState,questLines};
})(typeof window!=='undefined'?window:globalThis);
