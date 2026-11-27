// Run with: node --test tests/campaign-dialogue.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
require('../campaign/dialogue.js');
const Talk = globalThis.KFDialogue;
const state = (stage, quests = {}) => ({stage, quests});

test('topic ids are unique and every line is written', () => {
  const ids = new Set();
  for (const [id, who] of Object.entries(Talk.characters)) {
    assert.ok(who.name && who.role, id);
    for (const topic of who.topics) {
      assert.ok(!ids.has(topic.id), 'duplicate ' + topic.id);
      ids.add(topic.id);
      assert.ok(topic.label && topic.lines.length, topic.id);
      for (const line of topic.lines) assert.ok(line.length > 3 && line.length < 160, topic.id + ': ' + line);
    }
  }
});

test('story beats advance the chapter in order, one per stage', () => {
  const beats = Object.values(Talk.characters).flatMap(w => w.topics).filter(t => t.main);
  beats.push({...Talk.places['inspect-pod'], when: {from: 'investigate'}});
  const order = Talk.stages;
  for (let i = 0; i < order.length - 1; i++) {
    const due = beats.filter(b => (b.when.from) === order[i]);
    assert.equal(due.length, 1, 'beats at ' + order[i]);
    assert.equal(due[0].next, order[i + 1]);
  }
});

test('every character has something to say at every stage', () => {
  for (const id of Object.keys(Talk.characters)) {
    for (const stage of Talk.stages) {
      assert.ok(Talk.greetingFor(id, state(stage)).length, id + ' ' + stage);
    }
  }
});

test('side quests: offer, progress, ready, hand-in', () => {
  const s = state('investigate');
  assert.ok(Talk.topicsFor('bulma', s).some(t => t.start === 'pod-scrap'));
  s.quests['pod-scrap'] = {count: 1};
  assert.equal(Talk.questState(s, 'pod-scrap'), 'active');
  assert.match(Talk.questLines(s)[0], /1\/3/);
  assert.ok(!Talk.topicsFor('bulma', s).some(t => t.finish));
  s.quests['pod-scrap'].count = 3;
  assert.equal(Talk.questState(s, 'pod-scrap'), 'ready');
  assert.ok(Talk.topicsFor('bulma', s).some(t => t.finish === 'pod-scrap'));
  s.quests['pod-scrap'].done = true;
  assert.equal(Talk.questState(s, 'pod-scrap'), 'done');
  assert.ok(!Talk.topicsFor('bulma', s).some(t => t.when.quest?.id === 'pod-scrap'));
  assert.deepEqual(Talk.questLines(s), []);
  assert.ok(Talk.topicsFor('piccolo', state('meet-piccolo')).some(t => t.start === 'ki-focus'));
});

test('Raditz has nothing to discuss before the standoff', () => {
  assert.equal(Talk.topicsFor('raditz', state('meet-piccolo')).length, 0);
  assert.ok(Talk.topicsFor('raditz', state('encounter-ready')).length >= 3);
});
