import {bindWaveSeek} from './wave-seek.mjs';
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
// getRandomValues is also available on the paired LAN HTTP origin.
export function newWaveGestureId(random=globalThis.crypto){const bytes=new Uint8Array(16);random.getRandomValues(bytes);return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');}

// Relative hand motion in the frozen displayed range. Absolute audio targets
// permit first/latest coalescing on Remote without replaying a backlog of deltas.
export function bindWaveGesture(canvas,{getSettings=()=>({mode:'seek',sensitivity:1}),getRange,getContext,getPosition,getDuration,isCurrent=()=>true,startScratch,moveScratch,endScratch,seek,onError=()=>{},orientation='horizontal',heartbeatMs=0,eventTarget=globalThis}){
 let active=null,disposed=false;
 const releaseSeek=bindWaveSeek(canvas,{getRange,getContext,isCurrent,orientation,enabled:()=>getSettings().mode!=='scratch',seek});
 const names=['onpointerdown','onpointermove','onpointerup','onpointercancel','onlostpointercapture'],seekHandlers=Object.fromEntries(names.map(n=>[n,canvas[n]]));
 const coordinate=e=>orientation==='vertical'?e.clientY:e.clientX;
 const release=g=>{if(canvas.hasPointerCapture(g.id))canvas.releasePointerCapture(g.id);canvas.classList?.remove('wave-held');};
 const flush=async g=>{
  if(g.busy)return g.busy;
  g.busy=(async()=>{while(g.dirty&&g.ready&&isCurrent(g.context)){g.dirty=false;await moveScratch(g.target,g.elapsed,g.context);}})();
  try{await g.busy;}finally{g.busy=null;}
 };
 const finish=g=>{
  if(!g||g.ended)return g?.completion;
  g.ended=true;clearInterval(g.heartbeat);release(g);
  g.completion=(async()=>{try{await g.boot;if(g.ready){await flush(g);}}catch(error){onError(error);}finally{try{if(g.ready&&isCurrent(g.context))await endScratch(g.context);}catch(error){onError(error);}if(active===g)active=null;}})();return g.completion;
 };
 const move=e=>{
  const g=active;if(!g||g.ended||e.pointerId!==g.id)return;
  if(!isCurrent(g.context)){finish(g);return;}
  const at=coordinate(e);if(!Number.isFinite(at))return;
  const delta=-(at-g.last)*g.scale;g.last=at;g.elapsed=clamp((e.timeStamp-g.time)||16,8,120);g.time=e.timeStamp;
  if(!delta)return;g.target=clamp(g.target+delta,0,g.duration);g.dirty=true;
  if(g.ready)flush(g).catch(error=>{onError(error);finish(g);});
 };
 canvas.onpointerdown=e=>{
  if(disposed||active||getSettings().mode!=='scratch'){if(!active)seekHandlers.onpointerdown?.(e);return;}
  if(e.button!==0)return;const context=getContext();if(context==null||!isCurrent(context))return;
  const range=getRange(),rect=canvas.getBoundingClientRect(),pixels=orientation==='vertical'?rect.height:rect.width,duration=getDuration(context),initial=getPosition(context);
  if(!(range?.length===2&&range.every(Number.isFinite)&&range[1]>range[0]&&pixels>0&&duration>0&&Number.isFinite(initial)))return;
  e.preventDefault();canvas.setPointerCapture(e.pointerId);canvas.classList?.add('wave-held');
  const g=active={id:e.pointerId,context,initial,target:initial,duration,last:coordinate(e),time:e.timeStamp,elapsed:16,scale:(range[1]-range[0])/pixels*clamp(Number(getSettings().sensitivity)||1,.25,2),ready:false,dirty:false,ended:false,busy:null};
  g.boot=(async()=>{const result=await startScratch(context);if(result===false)return;if(!isCurrent(context))return;g.ready=true;if(Number.isFinite(result?.position))g.target=clamp(g.target+result.position-initial,0,duration);if(!g.ended&&g.dirty)await flush(g);})();
  g.boot.then(()=>{if(!g.ready)finish(g);}).catch(()=>finish(g));
  if(heartbeatMs>0)g.heartbeat=setInterval(()=>{if(!g.ended&&g.ready){g.dirty=true;flush(g).catch(error=>{onError(error);finish(g);});}},heartbeatMs);
 };
 canvas.onpointermove=e=>active?move(e):seekHandlers.onpointermove?.(e);
 canvas.onpointerup=e=>{if(active){if(e.pointerId===active.id){move(e);finish(active);}}else seekHandlers.onpointerup?.(e);};
 for(const name of ['onpointercancel','onlostpointercapture'])canvas[name]=e=>{if(active){if(e.pointerId===active.id)finish(active);}else seekHandlers[name]?.(e);};
 const blur=()=>finish(active);eventTarget.addEventListener?.('blur',blur);
 return {cancel:blur,destroy(){disposed=true;finish(active);releaseSeek();eventTarget.removeEventListener?.('blur',blur);}};
}
