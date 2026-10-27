import {analyzeAudio} from './analysis.mjs';
self.onmessage=({data})=>{try{const channels=(data.channels||[data.samples]).map(x=>new Float32Array(x));self.postMessage({id:data.id,result:analyzeAudio(channels,data.sampleRate)});}catch(error){self.postMessage({id:data.id,error:error.message});}};
