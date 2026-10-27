import {minimumDuck} from './live-dsp.mjs';
class DuckMixerProcessor extends AudioWorkletProcessor{
 constructor(){super();this.gain=0;this.frames=0;}
 process(inputs,outputs){const out=outputs[0]?.[0];if(!out)return true;for(let frame=0;frame<out.length;frame++){let target=0;for(let channel=0;channel<inputs.length;channel++){const value=inputs[channel][0]?.[frame];if(Number.isFinite(value))target=Math.min(target,Math.max(-1,value));}this.gain+=(target-this.gain)*.04;out[frame]=Math.max(-1,Math.min(0,this.gain));}this.frames+=out.length;if(this.frames>=sampleRate/30){this.frames=0;this.port.postMessage({reductionDb:-20*Math.log10(Math.max(1e-8,1+this.gain))});}return true;}
}
registerProcessor('sillage-duck-mixer',DuckMixerProcessor);
