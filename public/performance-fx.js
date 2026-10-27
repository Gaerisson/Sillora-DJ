import {clamp} from './audio-math.mjs';
import {synthTexture} from './transition-design.mjs';
export function impulse(context){
 const length=Math.round(context.sampleRate*1.35),buffer=context.createBuffer(2,length,context.sampleRate);let seed=8123;
 for(let channel=0;channel<2;channel++){const data=buffer.getChannelData(channel);let low=0,high=0;for(let i=0;i<length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1;low+=.18*(noise-low);high+=.012*(low-high);const t=i/context.sampleRate;data[i]=t<.022?0:(low-high)*Math.exp(-5.7*(t-.022)/1.35)*.28;}
  for(const [at,level] of [[.023,.22],[.037,.16],[.053,.1],[.079,.07]]){const i=Math.round((at+channel*.0017)*context.sampleRate);data[i]+=level;}}
 return buffer;
}
export class DeckEffects {
  constructor(ctx){
    this.ctx=ctx;this.kind='reverb';this.amount=0;
    this.input=ctx.createGain();this.gate=ctx.createGain();this.output=ctx.createGain();this.dry=ctx.createGain();this.input.connect(this.dry).connect(this.gate).connect(this.output);
    this.convolver=ctx.createConvolver();this.convolver.buffer=impulse(ctx);this.reverbWet=ctx.createGain();this.reverbWet.gain.value=0;this.input.connect(this.convolver).connect(this.reverbWet).connect(this.gate);
    this.flanger=ctx.createDelay(0.1);this.flanger.delayTime.value=0.004;this.flangerWet=ctx.createGain();this.flangerWet.gain.value=0;this.feedback=ctx.createGain();this.feedback.gain.value=0.25;
    this.input.connect(this.flanger).connect(this.flangerWet).connect(this.gate);this.flanger.connect(this.feedback).connect(this.flanger);
    this.lfo=ctx.createOscillator();this.lfo.frequency.value=0.18;this.depth=ctx.createGain();this.depth.gain.value=0;this.lfo.connect(this.depth).connect(this.flanger.delayTime);this.lfo.start();
    this.pulse=ctx.createOscillator();this.pulse.frequency.value=4;this.pulseDepth=ctx.createGain();this.pulseDepth.gain.value=0;this.pulse.connect(this.pulseDepth).connect(this.gate.gain);this.pulse.start();
  }
  set(kind,amount,bpm=120){
    this.kind=['reverb','flanger','tremolo'].includes(kind)?kind:'reverb';this.amount=clamp(amount,0,1);const t=this.ctx.currentTime,a=this.amount;
    this.dry.gain.setTargetAtTime(this.kind==='flanger'?1-a*.25:this.kind==='reverb'?1-a*.12:1,t,.03);
    this.reverbWet.gain.setTargetAtTime(this.kind==='reverb'?a*0.32:0,t,0.03);
    this.flangerWet.gain.setTargetAtTime(this.kind==='flanger'?a*0.5:0,t,0.03);
    this.depth.gain.setTargetAtTime(this.kind==='flanger'?a*0.0025:0,t,0.03);
    this.gate.gain.cancelScheduledValues(t);this.gate.gain.setTargetAtTime(this.kind==='tremolo'?1-a*0.4:1,t,0.015);
    this.pulseDepth.gain.setTargetAtTime(this.kind==='tremolo'?a*0.4:0,t,0.015);this.pulse.frequency.setTargetAtTime(bpm/30,t,0.03);
  }
  reset(){this.set(this.kind,0);}
}
export class TextureBus {
  constructor(ctx,master){this.ctx=ctx;this.master=master;this.voices=new Set();}
  play(kind,{start=this.ctx.currentTime,duration=2,intensity=0.5}={}){
    if(!['rise','fall','impact','laser','roll','air'].includes(kind))return;
    if(this.voices.size>=8)this.stop([...this.voices][0]);
    const ctx=this.ctx,data=synthTexture(kind,ctx.sampleRate,duration,intensity),buffer=ctx.createBuffer(1,data.length,ctx.sampleRate);buffer.getChannelData(0).set(data);
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=buffer;source.connect(filter).connect(gain).connect(this.master);gain.gain.value=0.45;filter.Q.value=0.6;
    if(['rise','fall','air'].includes(kind)){filter.type='bandpass';filter.frequency.setValueAtTime(kind==='fall'?9000:350,start);filter.frequency.exponentialRampToValueAtTime(kind==='fall'?300:9000,start+buffer.duration);}
    else{filter.type='lowpass';filter.frequency.value=14000;}
    const voice={source,filter,gain,start,end:start+buffer.duration};this.voices.add(voice);source.onended=()=>{this.voices.delete(voice);source.disconnect();filter.disconnect();gain.disconnect();};source.start(start);return voice;
  }
  stop(voice){if(!voice||!this.voices.has(voice))return;const now=this.ctx.currentTime;voice.gain.gain.cancelScheduledValues(now);voice.gain.gain.setTargetAtTime(0,now,0.006);try{voice.source.stop(now+0.03);}catch{}}
  stopAll(){for(const voice of this.voices)this.stop(voice);}
}
