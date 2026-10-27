import {createDemo} from './engine.js';
self.onmessage=({data})=>{
  try{
    let channels;
    const context={sampleRate:data.sampleRate,createBuffer:(count,length,sampleRate)=>{channels=Array.from({length:count},()=>new Float32Array(length));return {duration:length/sampleRate,sampleRate,getChannelData:i=>channels[i]};}};
    const track=createDemo(context,data.spec);delete track.buffer;
    const buffers=channels.map(channel=>channel.buffer);self.postMessage({track,channels:buffers},buffers);
  }catch(error){self.postMessage({error:error.message});}
};
