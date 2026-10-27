import {liveOptions} from './live-dsp.mjs';
import {duckOptions} from './duck-math.mjs';
export class RemoteLive extends EventTarget{
 constructor({snapshot,command}){super();this.snapshot=snapshot;this.command=command;this.devices=[];}
 get state(){const state=this.snapshot()||{},audio=state.audio||{},inputs=state.liveInputs?.length===4?state.liveInputs:[audio,{},{},{}];return{...audio,actualOutputId:audio.outputId||'',devices:this.devices,reductionDb:state.duckReductionDb||audio.reductionDb||0,inputs:inputs.map(input=>({armed:false,starting:false,talking:false,monitor:false,levelDb:-100,reductionDb:0,...input,autoNotches:input.autoNotches||[],options:{...liveOptions(input.options),...duckOptions(input.options),mode:'mic',gainDb:0,compress:true,monitor:false,duckEnabled:false,inputDeviceId:'',...input.options}}))};}
 changed(){this.dispatchEvent(new Event('change'));}
 configure(channel,value){return this.command({type:'audio:configure',channel,value});}
 start(channel=0){return this.command({type:'audio:start',channel});}
 stop(channel=0){return this.command({type:'audio:stop',channel});}
 talk(channel,enabled){return this.command({type:'audio:talk',channel,enabled});}
 muteAll(){return this.command({type:'audio:muteAll'});}
 resetFeedback(channel=0){return this.command({type:'audio:resetFeedback',channel});}
 selectOutput(deviceId){return this.command({type:'audio:output',deviceId});}
 async refreshDevices(){const value=await this.command({type:'query:audio'}),result=value?.result||value;this.devices=(result?.devices||[]).map(d=>({deviceId:d.id,label:d.label,kind:d.kind}));this.changed();return this.devices;}
}
