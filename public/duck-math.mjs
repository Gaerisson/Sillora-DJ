const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const number=(value,fallback,min,max)=>clamp(Number.isFinite(value)?value:fallback,min,max);
export const duckDefaults=Object.freeze({enabled:false,thresholdDb:-36,depthDb:12,attackMs:35,holdMs:250,releaseMs:550,preDelayMs:0,hysteresisDb:3,curve:'exp',triggerMode:'auto',manualActive:false});
export function duckOptions(value={}){
 return {enabled:value.enabled===true,thresholdDb:number(value.thresholdDb,-36,-70,-6),depthDb:number(value.depthDb,12,0,60),attackMs:number(value.attackMs,35,5,2000),holdMs:number(value.holdMs,250,0,5000),releaseMs:number(value.releaseMs,550,50,5000),preDelayMs:number(value.preDelayMs,0,0,2000),hysteresisDb:number(value.hysteresisDb,3,0,18),curve:['linear','smooth'].includes(value.curve)?value.curve:'exp',triggerMode:value.triggerMode==='manual'?'manual':'auto',manualActive:value.manualActive===true};
}
export class DuckEnvelope{
 constructor(sampleRate=48000,options={}){this.sampleRate=sampleRate;this.power=0;this.gain=1;this.voicing=false;this.hold=0;this.setOptions(options);}
 setOptions(value){this.options=duckOptions({...this.options,...value});const rate=this.sampleRate,o=this.options;this.detector=1-Math.exp(-1/(rate*.008));this.attack=1-Math.exp(-1/(rate*o.attackMs/1000));this.release=1-Math.exp(-1/(rate*o.releaseMs/1000));this.floor=10**(-o.depthDb/20);this.threshold=10**(o.thresholdDb/10);this.closeThreshold=10**((o.thresholdDb-o.hysteresisDb)/10);}
 step(power){
  this.power+=(Math.max(0,Number.isFinite(power)?power:0)-this.power)*this.detector;
  const forced=this.options.triggerMode==='manual'&&this.options.manualActive,above=forced||this.options.triggerMode==='auto'&&this.power>=this.threshold,below=this.options.triggerMode==='manual'?!forced:this.power<this.closeThreshold;
  if(!this.options.enabled){this.voicing=false;this.hold=0;this.preFrames=0;}
  else if(above){this.preFrames=(this.preFrames||0)+1;if(this.preFrames>=this.options.preDelayMs*this.sampleRate/1000){this.voicing=true;this.hold=this.options.holdMs*this.sampleRate/1000;}}
  else if(below){this.preFrames=0;this.hold=Math.max(0,this.hold-1);if(this.hold===0)this.voicing=false;}
  else if(!this.voicing)this.preFrames=0;
  const target=this.voicing?this.floor:1;
  if(this.options.curve==='exp')this.gain+=(target-this.gain)*(target<this.gain?this.attack:this.release);
  else{if(target!==this.rampTarget){this.rampTarget=target;this.rampFrom=this.gain;this.rampFrame=0;this.rampLength=Math.max(1,this.sampleRate*(target<this.gain?this.options.attackMs:this.options.releaseMs)/1000);}const p=clamp(++this.rampFrame/this.rampLength,0,1),u=this.options.curve==='smooth'?p*p*(3-2*p):p;this.gain=this.rampFrom+(target-this.rampFrom)*u;}
  return clamp(this.gain,0,1);
 }
 get levelDb(){return Math.max(-100,10*Math.log10(Math.max(1e-10,this.power)));}
 get reductionDb(){return Math.max(0,-20*Math.log10(Math.max(1e-10,this.gain)));}
}
