import {keyLockProfile} from './keylock-profiles.mjs';

// The profile is a constructor option: calibration and live voices configure
// the DSP before their first block, without asynchronous parameter messages.
export class KeyLockNode extends AudioWorkletNode{
 static register(context){return context.audioWorklet.addModule('/vendor/soundtouch/sillora-processor.js');}
 constructor({context,profile='standard'}){
  super(context,'sillora-keylock',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],processorOptions:{keyLockProfile:keyLockProfile(profile).id}});
  this._lastMetrics=null;this.port.onmessage=({data})=>{if(data?.type!=='metrics')return;this._lastMetrics={framesBuffered:data.framesBuffered,underrunCount:data.underrunCount,blockCount:data.blockCount,outputRms:data.outputRms,outputPeak:data.outputPeak,timestamp:performance.now()};this.dispatchEvent(new CustomEvent('metrics',{detail:this._lastMetrics}));};
 }
 get pitch(){return this.parameters.get('pitch');}
 get pitchSemitones(){return this.parameters.get('pitchSemitones');}
 get playbackRate(){return this.parameters.get('playbackRate');}
 get metrics(){return this._lastMetrics;}
}
