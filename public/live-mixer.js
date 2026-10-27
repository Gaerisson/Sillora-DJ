import {AudioIO} from './audio-io.js';
export class LiveMixer extends EventTarget{
 constructor(engine,{window:hostWindow=globalThis.window,...options}={}){
  super();this.engine=engine;this.reductionDb=0;this.selected=0;this.hostWindow=hostWindow;
  this.inputs=Array.from({length:4},(_,index)=>new AudioIO(engine,{...options,window:null,storageKey:index?'sillage:live-input-'+index:'sillage:audio-io-v11',duckSink:{ready:()=>this.ready(),connect:node=>node.connect(this.duckNode,0,index),disconnect:node=>node.disconnect()}}));
  this.primary=this.inputs[0];this.change=()=>this.dispatchEvent(new Event('change'));this.meter=()=>this.dispatchEvent(new Event('meter'));
  for(const input of this.inputs){input.addEventListener('change',this.change);input.addEventListener('meter',this.meter);}
  this.unload=()=>this.dispose();hostWindow?.addEventListener('beforeunload',this.unload,{once:true});
 }
 get state(){const inputs=this.inputs.map(input=>input.state);return{...inputs[0],inputs,reductionDb:this.reductionDb,selected:this.selected,activeInputs:inputs.filter(input=>input.armed).length};}
 get options(){return this.primary.options;}
 async ready(){
  if(this.duckNode)return;
  this.preparing||=(async()=>{const context=await this.engine.init();await context.audioWorklet.addModule('/duck-mixer-worklet.js');const node=new AudioWorkletNode(context,'sillage-duck-mixer',{numberOfInputs:4,numberOfOutputs:1,outputChannelCount:[1],channelCount:1,channelCountMode:'explicit'});node.connect(this.engine.musicBus.gain);node.port.onmessage=({data})=>{this.reductionDb=Number.isFinite(data.reductionDb)?data.reductionDb:0;this.meter();};node.onprocessorerror=()=>{this.stopAll();this.primary.fail(new Error('Le ducking live a été interrompu. Rechargez le studio.'));};this.duckNode=node;})().catch(error=>{this.preparing=null;throw error;});
  return this.preparing;
 }
 input(index=0){if(!Number.isInteger(index)||index<0||index>=4)throw new Error('Entrée live invalide.');return this.inputs[index];}
 configure(index,value){this.input(index).setOptions(value);return this.state;}
 setOptions(value){return this.configure(0,value);}
 start(index=0){return this.input(index).startInput();}
 startInput(){return this.start(0);}
 stop(index=0){this.input(index).stopInput();return this.state;}
 stopInput(){return this.stop(0);}
 talk(index,enabled,options){return this.input(index).setTalk(enabled,options);}
 setTalk(enabled,options){return this.talk(0,enabled,options);}
 muteAll(){for(const input of this.inputs)input.setTalk(false);return this.state;}
 stopAll(){for(const input of this.inputs)input.stopInput();return this.state;}
 resetFeedback(index=0){this.input(index).resetFeedback();return this.state;}
 async refreshDevices(){const devices=await this.primary.refreshDevices();for(const input of this.inputs.slice(1)){input.devices=devices.map(device=>({...device}));input.changed();}return devices;}
 async selectOutput(id){const actual=await this.primary.selectOutput(id);for(const input of this.inputs.slice(1))input.actualOutputId=actual;this.change();return actual;}
 async restoreOutput(){const result=await this.primary.restoreOutput();for(const input of this.inputs.slice(1))input.actualOutputId=this.primary.actualOutputId;return result;}
 dispose(){for(const input of this.inputs){input.removeEventListener('change',this.change);input.removeEventListener('meter',this.meter);input.dispose();}if(this.duckNode){this.duckNode.disconnect();this.duckNode.port.close();this.duckNode=null;const gain=this.engine.musicBus.gain,now=this.engine.context.currentTime;gain.cancelScheduledValues(now);gain.setValueAtTime(10**(-this.reductionDb/20),now);gain.setTargetAtTime(1,now,.05);}this.hostWindow?.removeEventListener('beforeunload',this.unload);}
}
