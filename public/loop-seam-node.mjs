import {splitTime,LOOP_FADE_SECONDS} from './loop-seam.mjs';
export class LoopSeamNode extends AudioWorkletNode{
 static register(context){return context.audioWorklet.addModule('/loop-seam-worklet.js');}
 constructor(context,{offset,started,rate=1,channels=2,loop}={}){super(context,'sillora-loop-seam',{numberOfInputs:1,numberOfOutputs:1,channelCount:channels,channelCountMode:'explicit',channelInterpretation:'discrete',outputChannelCount:[channels],processorOptions:{offset,started},parameterData:{rate}});this.configure(loop,context.currentTime);}
 get playbackRate(){return this.parameters.get('rate');}
 arm(offset,started){this.port.postMessage({type:'arm',offset,started});}
 configure(loop,now){const put=(name,value)=>this.parameters.get(name).setValueAtTime(value,now),[a,af]=splitTime(loop?.start||0),[b,bf]=splitTime(loop?.end||1);put('start',a);put('startFine',af);put('end',b);put('endFine',bf);put('enabled',loop?1:0);put('fade',loop?.kind==='continuity'?0:LOOP_FADE_SECONDS);}
}
