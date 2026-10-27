import {PeakLimiter} from './peak-limiter.mjs';
class StudioLimiter extends AudioWorkletProcessor {
 constructor(){super();this.limiter=new PeakLimiter(sampleRate);this.port.onmessage=({data})=>this.limiter.setCeilingDb(data?.ceilingDb);}
 process(inputs,outputs){this.limiter.process(inputs[0]||[],outputs[0]);return true;}
}
registerProcessor('sillage-limiter',StudioLimiter);
