export const stemNames=['drums','bass','other','vocals'];
export const stemLabels={drums:'Batterie',bass:'Basse',other:'Instruments',vocals:'Voix'};
export function waveForSeparation(buffer){
 if(buffer.duration>480)throw new Error('La préparation des stems est limitée à 8 minutes par morceau.');
 const bytes=new ArrayBuffer(44+buffer.length*8),view=new DataView(bytes),text=(offset,value)=>[...value].forEach((c,i)=>view.setUint8(offset+i,c.charCodeAt(0)));
 text(0,'RIFF');view.setUint32(4,bytes.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,3,true);view.setUint16(22,2,true);view.setUint32(24,buffer.sampleRate,true);view.setUint32(28,buffer.sampleRate*8,true);view.setUint16(32,8,true);view.setUint16(34,32,true);text(36,'data');view.setUint32(40,bytes.byteLength-44,true);
 for(let ch=0;ch<2;ch++){const data=buffer.getChannelData(Math.min(ch,buffer.numberOfChannels-1));for(let i=0;i<data.length;i++){if(!Number.isFinite(data[i]))throw new Error('Signal audio non fini.');view.setFloat32(44+(i*2+ch)*4,data[i],true);}}
 return bytes;
}
export async function prepareStems(track,context,desktop,onProgress=()=>{},signal){
 const available=await desktop.stemAvailability();if(!available.available)throw new Error(available.message);
 if(signal?.aborted)throw new Error('Préparation annulée.');
 const job=await desktop.prepareStems(waveForSeparation(track.buffer));
 const cancel=()=>desktop.cancelStems(job.id).catch(()=>{});signal?.addEventListener('abort',cancel,{once:true});
 try{
  let state=job;
  while(state.state!=='done'){
   if(signal?.aborted){cancel();throw new Error('Préparation annulée.');}
   onProgress(state);if(['error','cancelled'].includes(state.state))throw new Error(state.error||'Préparation annulée.');
   await new Promise(resolve=>setTimeout(resolve,750));state=await desktop.stemStatus(job.id);
  }
  onProgress({...state,stage:'decoding'});
  const combined=context.createBuffer(8,track.buffer.length,context.sampleRate);
  for(const [index,name] of stemNames.entries()){
   if(signal?.aborted)throw new Error('Préparation annulée.');
   const decoded=await context.decodeAudioData(await desktop.readStem(job.id,name));
   if(Math.abs(decoded.duration-track.buffer.duration)>.03)throw new Error('Durées des stems incohérentes.');
   for(let channel=0;channel<2;channel++)combined.getChannelData(index*2+channel).set(decoded.getChannelData(Math.min(channel,decoded.numberOfChannels-1)).subarray(0,combined.length));
  }
  track.stemEnvelopes=Object.fromEntries(stemNames.map((name,index)=>{
   const left=combined.getChannelData(index*2),right=combined.getChannelData(index*2+1),hop=Math.round(context.sampleRate*.1),values=[];
   for(let start=0;start<combined.length;start+=hop){let sum=0;const end=Math.min(combined.length,start+hop);for(let i=start;i<end;i++)sum+=(left[i]**2+right[i]**2)/2;values.push(Math.sqrt(sum/(end-start)));}
   return [name,values];
  }));
  track.stemBuffer=combined;track.stemModel=state.manifest.model;track.stemLevels=Object.fromEntries(stemNames.map(name=>[name,1]));
  return track;
 }finally{signal?.removeEventListener('abort',cancel);}
}
