import {KickPumping} from './pumping-dsp.mjs';
class PumpingProcessor extends AudioWorkletProcessor{
 constructor(options){super();this.dsp=new KickPumping(sampleRate,options.processorOptions);this.frames=0;this.kicks=0;this.peakReduction=0;this.port.onmessage=({data})=>{if(data?.type==='reset'){this.dsp.reset();this.peakReduction=0;}else if(data?.type==='options')this.dsp.set(data.options);};}
 process(inputs,outputs){this.dsp.process(inputs[0]||[],outputs[0]);this.peakReduction=Math.max(this.peakReduction,this.dsp.stats.reductionDb);this.frames+=outputs[0][0]?.length||0;if(this.frames>=2048){this.frames=0;this.port.postMessage({...this.dsp.stats,reductionDb:this.peakReduction,kick:this.dsp.kicks!==this.kicks});this.peakReduction=0;this.kicks=this.dsp.kicks;}return true;}
}
registerProcessor('gaerisson-kick-pumping',PumpingProcessor);
