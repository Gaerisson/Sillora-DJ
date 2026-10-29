import {encodeStemWave,stemEnvelope} from './stem-codec.mjs';
self.onmessage=({data})=>{const {id,type,sampleRate}=data;try{
 const channels=data.channels.map(b=>new Float32Array(b)),progress=percent=>self.postMessage({id,progress:percent});
 if(type==='encode'){const bytes=encodeStemWave({sampleRate,numberOfChannels:channels.length,length:channels[0].length,getChannelData:i=>channels[i]},progress);self.postMessage({id,bytes},[bytes]);}
 else if(type==='envelopes'){const envelope=stemEnvelope(channels,sampleRate,progress);self.postMessage({id,envelope,channels:data.channels},data.channels);}
 else throw Error('Calcul stems inconnu.');
 }catch(error){self.postMessage({id,error:error.message});}};
