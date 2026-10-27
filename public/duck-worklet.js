import {DuckEnvelope} from './duck-math.mjs';
class SillageDuckProcessor extends AudioWorkletProcessor{
 constructor(){super();this.envelope=new DuckEnvelope(sampleRate);this.frames=0;this.port.onmessage=({data})=>{if(data.type==='options')this.envelope.setOptions(data.value||{});};}
 process(inputs,outputs){
  const channels=inputs[0]||[],output=outputs[0]?.[0];if(!output)return true;
  for(let frame=0;frame<output.length;frame++){
   let power=0;for(const channel of channels){const value=channel[frame];if(Number.isFinite(value))power+=value*value;}
   output[frame]=this.envelope.step(power/Math.max(1,channels.length))-1;
  }
  this.frames+=output.length;if(this.frames>=sampleRate/30){this.frames=0;this.port.postMessage({levelDb:this.envelope.levelDb,reductionDb:this.envelope.reductionDb,voicing:this.envelope.voicing});}
  return true;
 }
}
registerProcessor('sillage-duck',SillageDuckProcessor);
