/* Shared lazy area lifecycle. Rendering and input belong to the caller. */
(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.KFAreaLoader=api;
})(typeof globalThis!=="undefined"?globalThis:null,function(){
"use strict";

function createAreaLoader({load,dispose=()=>{},maxCached=3}={}){
 if(typeof load!=="function")throw Error("load(areaId) required");
 if(!Number.isInteger(maxCached)||maxCached<1)throw Error("maxCached must be >= 1");
 const cache=new Map(),pending=new Map();
 let active=null,latest=null;

 function evict(){
  for(const [id,value] of cache){
   if(cache.size<=maxCached)break;
   if(id===active||id===latest?.id)continue;
   cache.delete(id);
   dispose(id,value);
  }
 }

 async function ensure(id){
  if(!id)throw Error("area id required");
  if(cache.has(id)){
   const value=cache.get(id);
   cache.delete(id);
   cache.set(id,value);
   return value;
  }
  if(pending.has(id))return pending.get(id);

  const promise=Promise.resolve().then(()=>load(id)).then(value=>{
   if(value==null)throw Error("area not found: "+id);
   if(pending.get(id)!==promise){
    dispose(id,value);
    throw Error("area load cleared: "+id);
   }
   cache.set(id,value);
   return value;
  }).finally(()=>{
   if(pending.get(id)===promise)pending.delete(id);
  });
  pending.set(id,promise);
  return promise;
 }

 async function activate(id){
  const request={id};
  latest=request;
  try{
   const value=await ensure(id);
   if(latest===request)active=id;
   return value;
  }finally{
   if(latest===request)latest=null;
   evict();
  }
 }

 async function prefetch(ids){
  const results=await Promise.allSettled([...new Set(ids)].filter(id=>id&&id!==active)
   .map(async id=>{
    try{return await ensure(id)}finally{evict()}
   }));
  return results;
 }

 function clear(){
  latest=null;
  active=null;
  pending.clear();
  const entries=[...cache];
  cache.clear();
  for(const [id,value] of entries)dispose(id,value);
 }

 return {activate,prefetch,ensure,clear,get activeId(){return active},
  get cachedIds(){return [...cache.keys()]},get pendingIds(){return [...pending.keys()]}};
}

return {createAreaLoader};
});
