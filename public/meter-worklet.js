import {AudioMeterBank} from './audio-meters.mjs';
class SilloraMeter extends AudioWorkletProcessor{
 constructor(){super();this.meters=new AudioMeterBank(sampleRate);this.port.onmessage=({data})=>{if(data?.type==='reset')this.meters.reset();};}
 process(inputs,outputs){
  // Passive tap. The only output is silence, so a failure cannot interrupt or
  // duplicate the actual programme, which has its own route to the destination.
  const frames=outputs[0]?.[0]?.length||128;
  if(this.meters.process(inputs,frames,currentTime+frames/sampleRate))this.port.postMessage(this.meters.state);
  return true;
 }
}
registerProcessor('sillora-meter',SilloraMeter);
