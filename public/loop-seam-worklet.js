import {LoopSeam} from './loop-seam.mjs';
class LoopSeamProcessor extends AudioWorkletProcessor{
 static get parameterDescriptors(){return[
  {name:'rate',defaultValue:1,minValue:.001,maxValue:4,automationRate:'k-rate'},
  {name:'enabled',defaultValue:0,minValue:0,maxValue:1,automationRate:'k-rate'},
  {name:'start',defaultValue:0,minValue:0,maxValue:86400,automationRate:'k-rate'},
  {name:'startFine',defaultValue:0,minValue:-.01,maxValue:.01,automationRate:'k-rate'},
  {name:'end',defaultValue:1,minValue:0,maxValue:86400,automationRate:'k-rate'},
  {name:'endFine',defaultValue:0,minValue:-.01,maxValue:.01,automationRate:'k-rate'},
  {name:'fade',defaultValue:.004,minValue:0,maxValue:.008,automationRate:'k-rate'}
 ];}
 constructor(options){super();this.seam=new LoopSeam({...options.processorOptions,sampleRate});this.port.onmessage=({data})=>{if(data?.type==='arm'&&Number.isFinite(data.offset)&&Number.isFinite(data.started))this.seam.arm(data.offset,data.started);};}
 process(inputs,outputs,parameters){this.seam.process(inputs[0]||[],outputs[0],parameters,currentFrame);return true;}
}
registerProcessor('sillora-loop-seam',LoopSeamProcessor);
