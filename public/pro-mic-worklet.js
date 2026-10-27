import {GateLimiter} from './live-dsp.mjs';
class ProMicProcessor extends AudioWorkletProcessor{
 constructor(options={}){super();this.dsp=new GateLimiter(sampleRate,options.processorOptions||{});this.frames=0;this.port.onmessage=({data})=>{if(data.type==='options')this.dsp.setOptions(data.value);};}
 process(inputs,outputs){const input=inputs[0]||[],output=outputs[0];if(!output?.length)return true;for(let frame=0;frame<output[0].length;frame++){const a=input[0]?.[frame]||0,b=input[1]?.[frame]??a,processed=this.dsp.processStereo(a,b);for(let channel=0;channel<output.length;channel++)output[channel][frame]=processed[Math.min(channel,1)];}this.frames+=output[0].length;if(this.frames>=sampleRate/20){this.frames=0;this.port.postMessage({gateOpen:this.dsp.open,gateReductionDb:-20*Math.log10(Math.max(1e-8,this.dsp.gateGain)),compressionDb:-20*Math.log10(Math.max(1e-8,this.dsp.compressionGain)),limitReductionDb:-20*Math.log10(Math.max(1e-8,this.dsp.limitGain))});}return true;}
}
registerProcessor('sillage-pro-mic',ProMicProcessor);
