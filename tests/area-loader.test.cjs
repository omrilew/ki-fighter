const assert=require('node:assert/strict');
const {test}=require('node:test');
const {createAreaLoader}=require('../area-loader.js');

test('prefetch deduplicates downloads and evicts without removing the active area',async()=>{
 const fetched=[],disposed=[];
 const loader=createAreaLoader({maxCached:2,load:id=>{fetched.push(id);return {id}},dispose:id=>disposed.push(id)});
 await loader.activate('landing');
 await loader.prefetch(['ridge','ridge','field','landing']);
 assert.deepEqual(fetched,['landing','ridge','field']);
 assert.deepEqual(loader.cachedIds,['landing','field']);
 assert.deepEqual(disposed,['ridge']);
 await loader.activate('field');
 assert.deepEqual(fetched,['landing','ridge','field']);
 assert.equal(loader.activeId,'field');
});

test('an older request finishing late cannot replace the newest active area',async()=>{
 let finishOlder;
 const loader=createAreaLoader({maxCached:1,load:id=>id==='older'?new Promise(resolve=>{finishOlder=resolve}):{id}});
 const older=loader.activate('older');
 await loader.activate('latest');
 finishOlder({id:'older'});
 await older;
 assert.equal(loader.activeId,'latest');
 assert.deepEqual(loader.cachedIds,['latest']);
});

test('failure keeps the current area and clearing cannot repopulate the cache',async()=>{
 let finishLate;
 const disposed=[];
 const loader=createAreaLoader({load:id=>{
  if(id==='unavailable')throw Error('offline');
  if(id==='late')return new Promise(resolve=>{finishLate=resolve});
  return {id};
 },dispose:id=>disposed.push(id)});
 await loader.activate('landing');
 await assert.rejects(loader.activate('unavailable'),/offline/);
 assert.equal(loader.activeId,'landing');
 const late=loader.activate('late');
 const rejected=assert.rejects(late,/area load cleared/);
 await Promise.resolve();
 loader.clear();
 finishLate({id:'late'});
 await rejected;
 assert.equal(loader.activeId,null);
 assert.deepEqual(loader.cachedIds,[]);
 assert.deepEqual(loader.pendingIds,[]);
 assert.deepEqual(disposed,['landing','late']);
});
