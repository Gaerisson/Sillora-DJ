import {stemBudget,stemOptions} from './stem-budget.mjs';
import {StemWorkerSession,copyStemChannels,assembleStem,abortableStem,throwStemAbort} from './stem-worker-client.mjs';
export {encodeStemWave as waveForSeparation} from './stem-codec.mjs';
export const stemNames=['drums','bass','other','vocals'];
export const stemLabels={drums:'Batterie',bass:'Basse',other:'Instruments',vocals:'Voix'};
export async function prepareStems(track,context,desktop,onProgress=()=>{},signal,options={},dependencies={}){
 throwStemAbort(signal);if(track.ensureAudio&&!track.buffer?.getChannelData)await abortableStem(track.ensureAudio({priority:20}),signal);throwStemAbort(signal);
 const source=track.buffer,budget=stemBudget(source,context.sampleRate,stemOptions(options)),available=await abortableStem(desktop.stemAvailability(),signal);throwStemAbort(signal);
 if(!available.available)throw Error(available.message||'Le moteur de stems est indisponible.');if(available.busy)throw Error('Une préparation est déjà en cours. Attendez sa fin ou annulez-la.');
 const worker=new StemWorkerSession(signal,onProgress,dependencies);let job=null;
 const cancel=()=>{if(job?.id)Promise.resolve(desktop.cancelStems(job.id)).catch(()=>{});};signal?.addEventListener('abort',cancel,{once:true});
 try{
  onProgress({stage:'copying',percent:0,...budget});const channels=await copyStemChannels(source,signal,onProgress);throwStemAbort(signal);
  onProgress({stage:'encoding',percent:0});const {bytes}=await worker.request('encode',channels,source.sampleRate);throwStemAbort(signal);
  // Keep the acknowledgement: cancellation can happen while IPC creates the job.
  job=await desktop.prepareStems(bytes,{cpuThreads:budget.cpuThreads,memoryMiB:budget.memoryMiB,timeoutMinutes:budget.timeoutMinutes});if(signal?.aborted){cancel();throwStemAbort(signal);}
  let state=job;
  while(state.state!=='done'){
   throwStemAbort(signal);if(['error','cancelled'].includes(state.state))throw Error(state.error||'Préparation annulée.');onProgress(state);
   await abortableStem(new Promise(resolve=>setTimeout(resolve,150)),signal);state=await abortableStem(desktop.stemStatus(job.id),signal);
  }
  throwStemAbort(signal);const combined=context.createBuffer(8,budget.frames,context.sampleRate),envelopes={};
  for(const [index,name]of stemNames.entries()){
   throwStemAbort(signal);onProgress({stage:'decoding',percent:index/4*100});const bytes=await abortableStem(desktop.readStem(job.id,name),signal);throwStemAbort(signal);
   let decoded=await abortableStem(context.decodeAudioData(bytes),signal);throwStemAbort(signal);
   if(decoded.numberOfChannels!==2||decoded.sampleRate!==context.sampleRate||Math.abs(decoded.length-budget.frames)>2)throw Error('Horloges ou formats des stems incohérents.');
   const channels=await copyStemChannels(decoded,signal,()=>{});decoded=null;
   const result=await worker.request('envelopes',channels,context.sampleRate);throwStemAbort(signal);envelopes[name]=result.envelope;
   await assembleStem(combined,index,result.channels,signal,onProgress);
  }
  throwStemAbort(signal);if(track.buffer!==source)throw Error('Le fichier audio a changé pendant la préparation.');
  const levels=Object.fromEntries(stemNames.map(name=>[name,Number.isFinite(track.stemLevels?.[name])?Math.max(0,Math.min(1,track.stemLevels[name])):1]));
  Object.assign(track,{stemBuffer:combined,stemEnvelopes:envelopes,stemModel:state.manifest.model,stemLevels:levels});onProgress({stage:'ready',percent:100,cached:Boolean(state.cached),...budget});return track;
 }catch(error){cancel();throw error;}finally{signal?.removeEventListener('abort',cancel);worker.close();}
}
