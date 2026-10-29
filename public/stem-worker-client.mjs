export const stemAbort=()=>new DOMException('Préparation annulée.','AbortError');
export const nextStemTurn=()=>new Promise(resolve=>setTimeout(resolve,0));
export function throwStemAbort(signal){if(signal?.aborted)throw stemAbort();}
export function abortableStem(promise,signal){if(!signal)return promise;return new Promise((resolve,reject)=>{const abort=()=>reject(stemAbort());signal.addEventListener('abort',abort,{once:true});Promise.resolve(promise).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));if(signal.aborted)abort();});}
export class StemWorkerSession{
 constructor(signal,onProgress=()=>{},{createWorker=()=>{if(typeof Worker==='undefined')throw Error('Un Worker est requis pour préparer les stems.');return new Worker(new URL('./stem-worker.js',import.meta.url),{type:'module'});}}={}){
  throwStemAbort(signal);this.worker=createWorker();this.pending=new Map();this.sequence=0;this.signal=signal;this.onProgress=onProgress;this.abort=()=>this.close(stemAbort());signal?.addEventListener('abort',this.abort,{once:true});
  this.worker.onmessage=({data})=>{const item=this.pending.get(data.id);if(!item)return;if(Number.isFinite(data.progress)){onProgress({stage:item.stage,percent:data.progress});return;}this.pending.delete(data.id);data.error?item.reject(Error(data.error)):item.resolve(data);};
  this.worker.onerror=()=>this.close(Error('Le Worker de préparation des stems a échoué.'));if(signal?.aborted)this.abort();
 }
 request(type,channels,sampleRate){throwStemAbort(this.signal);if(this.closed)throw Error('Worker de stems fermé.');return new Promise((resolve,reject)=>{const id=++this.sequence;this.pending.set(id,{resolve,reject,stage:type==='encode'?'encoding':'envelopes'});try{this.worker.postMessage({id,type,sampleRate,channels},channels);}catch(error){this.pending.delete(id);reject(error);}});}
 close(error=stemAbort()){if(this.closed)return;this.closed=true;this.signal?.removeEventListener('abort',this.abort);this.worker.terminate();for(const item of this.pending.values())item.reject(error);this.pending.clear();}
}
export async function copyStemChannels(buffer,signal,onProgress=()=>{}){
 const channels=[];for(let ch=0;ch<buffer.numberOfChannels;ch++){const source=buffer.getChannelData(ch),target=new Float32Array(source.length);for(let start=0;start<source.length;start+=262144){throwStemAbort(signal);target.set(source.subarray(start,Math.min(source.length,start+262144)),start);if(start%1048576===0){onProgress({stage:'copying',percent:(ch+start/source.length)/buffer.numberOfChannels*100});await nextStemTurn();}}channels.push(target.buffer);}throwStemAbort(signal);return channels;
}
export async function assembleStem(combined,index,channels,signal,onProgress=()=>{}){
 for(let ch=0;ch<2;ch++){const target=combined.getChannelData(index*2+ch),source=new Float32Array(channels[ch]);for(let start=0;start<source.length&&start<target.length;start+=262144){throwStemAbort(signal);target.set(source.subarray(start,Math.min(source.length,target.length,start+262144)),start);onProgress({stage:'assembling',percent:(index+(ch+start/source.length)/2)/4*100});await nextStemTurn();}}throwStemAbort(signal);
}
