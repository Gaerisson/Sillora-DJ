export class PumpingBus{
 constructor(context,options={}){this.context=context;this.options=options;this.input=context.createGain();this.output=context.createGain();this.input.connect(this.output);this.meter={available:null,reductionDb:0,levelDb:-100};this.kickUntil=0;}
 async prepare(){
  if(!this.context.audioWorklet||typeof AudioWorkletNode==='undefined'){this.meter.available=false;return false;}
  try{
   await this.context.audioWorklet.addModule('/pumping-worklet.js');
   const node=new AudioWorkletNode(this.context,'gaerisson-kick-pumping',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],processorOptions:this.options});
   node.port.onmessage=({data})=>{this.meter={available:true,reductionDb:Math.min(6,Math.max(0,data.reductionDb||0)),levelDb:data.levelDb??-100,kicks:Math.max(0,data.kicks||0)};if(data.kick)this.kickUntil=performance.now()+120;};
   this.input.disconnect();this.input.connect(node).connect(this.output);this.node=node;this.meter.available=true;return true;
  }catch(error){this.meter.available=false;this.meter.error=String(error?.message||error);return false;}
 }
 set(options){this.options=options;this.node?.port.postMessage({type:'options',options});}
 reset(){this.node?.port.postMessage({type:'reset'});this.meter.reductionDb=0;this.kickUntil=0;}
 get state(){return {...this.meter,enabled:this.options.pumpEnabled===true,kick:performance.now()<this.kickUntil};}
}
