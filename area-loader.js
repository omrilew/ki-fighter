/* Area resource lifecycle for Ki Fighter. No render loops or extra canvases.
 * Register manifest IDs with load functions supplied by the existing engine.
 */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.KFAreaLoader=api})(typeof globalThis!=="undefined"?globalThis:null,function(){
"use strict";
function createAreaLoader({load,dispose=()=>{},maxCached=3}={}){
 if(typeof load!=="function")throw Error("load(areaId) required");
 if(!Number.isInteger(maxCached)||maxCached<1)throw Error("maxCached must be >= 1");
 const cache=new Map(),pending=new Map();let active=null;
 async function ensure(id){if(!id)throw Error("area id required");
  if(cache.has(id)){const value=cache.get(id);cache.delete(id);cache.set(id,value);return value}
  if(pending.has(id))return pending.get(id);
  const promise=Promise.resolve().then(()=>load(id)).then(value=>{pending.delete(id);if(value==null)throw Error("area not found: "+id);cache.set(id,value);evict();return value},error=>{pending.delete(id);throw error});
  pending.set(id,promise);return promise;
 }
 function evict(){for(const [id,value] of cache){if(cache.size<=maxCached)break;if(id===active)continue;cache.delete(id);dispose(id,value)}}
 async function activate(id){const value=await ensure(id);active=id;evict();return value}
 function prefetch(ids){return Promise.allSettled([...new Set(ids)].filter(id=>id&&id!==active).map(ensure))}
 function clear(){for(const [id,value] of cache)dispose(id,value);cache.clear();pending.clear();active=null}
 return {activate,prefetch,ensure,clear,get activeId(){return active},get cachedIds(){return [...cache.keys()]},get pendingIds(){return [...pending.keys()]}};
}
return {createAreaLoader};
});
