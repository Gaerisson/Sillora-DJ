import {stemBudget} from './stem-budget.mjs';
export function encodeStemWave(buffer,onProgress=()=>{}){
 stemBudget(buffer,buffer.sampleRate,{memoryMiB:1024});
 const bytes=new ArrayBuffer(44+buffer.length*8),view=new DataView(bytes),text=(at,value)=>[...value].forEach((c,i)=>view.setUint8(at+i,c.charCodeAt(0)));
 text(0,'RIFF');view.setUint32(4,bytes.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,3,true);view.setUint16(22,2,true);view.setUint32(24,buffer.sampleRate,true);view.setUint32(28,buffer.sampleRate*8,true);view.setUint16(32,8,true);view.setUint16(34,32,true);text(36,'data');view.setUint32(40,bytes.byteLength-44,true);
 const left=buffer.getChannelData(0),right=buffer.getChannelData(buffer.numberOfChannels===1?0:1);if(left.length!==buffer.length||right.length!==buffer.length)throw Error('Longueur audio incohérente.');
 const little=new Uint8Array(new Uint32Array([1]).buffer)[0]===1,payload=little?new Float32Array(bytes,44):null;
 for(let i=0;i<buffer.length;i++){const l=left[i],r=right[i];if(!Number.isFinite(l)||!Number.isFinite(r))throw Error('Signal audio non fini.');if(payload){payload[i*2]=l;payload[i*2+1]=r;}else{view.setFloat32(44+i*8,l,true);view.setFloat32(48+i*8,r,true);}if(i%262144===0)onProgress(i/buffer.length*100);}
 return bytes;
}
export function stemEnvelope(channels,sampleRate,onProgress=()=>{}){
 if(channels.length!==2||channels[0].length!==channels[1].length)throw Error('Stem stéréo incohérent.');
 const hop=Math.max(1,Math.round(sampleRate*.1)),values=[];for(let start=0;start<channels[0].length;start+=hop){let sum=0;const end=Math.min(channels[0].length,start+hop);for(let i=start;i<end;i++){const a=channels[0][i],b=channels[1][i];if(!Number.isFinite(a)||!Number.isFinite(b))throw Error('Stem audio non fini.');sum+=(a*a+b*b)/2;}values.push(Math.sqrt(sum/(end-start)));if(values.length%32===0)onProgress(end/channels[0].length*100);}return values;
}
