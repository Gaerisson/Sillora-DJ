const bounded=(v,f,min,max)=>Number.isFinite(v)?Math.max(min,Math.min(max,v)):f;
export const programDefaults=Object.freeze({highpass:20,low:0,mid:0,high:0,balance:0,mono:false,dim:false,muted:false,dimDb:18,ceilingDb:-.3,pumpEnabled:false,pumpDepth:2.5,pumpRelease:180,pumpThreshold:-27,pumpCrossover:150});
export function programOptions(value={}){
 value=value&&typeof value==='object'?value:{};
 return{highpass:bounded(value.highpass,20,20,160),low:bounded(value.low,0,-12,12),mid:bounded(value.mid,0,-12,12),high:bounded(value.high,0,-12,12),balance:bounded(value.balance,0,-1,1),mono:value.mono===true,dim:value.dim===true,muted:value.muted===true,dimDb:bounded(value.dimDb,18,6,36),ceilingDb:bounded(value.ceilingDb,-.3,-12,-.1),pumpEnabled:value.pumpEnabled===true,pumpDepth:bounded(value.pumpDepth,2.5,0,6),pumpRelease:bounded(value.pumpRelease,180,60,450),pumpThreshold:bounded(value.pumpThreshold,-27,-48,-12),pumpCrossover:bounded(value.pumpCrossover,150,80,220)};
}
export function programMatrix(options){const o=programOptions(options),left=o.balance>0?1-o.balance:1,right=o.balance<0?1+o.balance:1;return o.mono?[left*.5,left*.5,right*.5,right*.5]:[left,0,0,right];}
export class ProgramBus{
 constructor(context,options){
  this.context=context;this.input=context.createGain();this.input.channelCount=2;this.input.channelCountMode='explicit';
  this.hp=context.createBiquadFilter();this.hp.type='highpass';this.hp.Q.value=.707;
  this.low=context.createBiquadFilter();this.low.type='lowshelf';this.low.frequency.value=120;
  this.mid=context.createBiquadFilter();this.mid.type='peaking';this.mid.frequency.value=1500;this.mid.Q.value=.7;
  this.high=context.createBiquadFilter();this.high.type='highshelf';this.high.frequency.value=6000;
  this.split=context.createChannelSplitter(2);this.merge=context.createChannelMerger(2);this.matrix=Array.from({length:4},()=>context.createGain());this.output=context.createGain();
  this.input.connect(this.hp).connect(this.low).connect(this.mid).connect(this.high).connect(this.split);
  for(let target=0;target<2;target++)for(let source=0;source<2;source++){const node=this.matrix[target*2+source];this.split.connect(node,source);node.connect(this.merge,0,target);}
  this.merge.connect(this.output);this.set(options);
 }
 set(value){this.options=programOptions(value);const o=this.options,now=this.context.currentTime,smooth=(p,v)=>{p.cancelScheduledValues(now);p.setTargetAtTime(v,now,.015);};smooth(this.hp.frequency,o.highpass);for(const name of ['low','mid','high'])smooth(this[name].gain,o[name]);programMatrix(o).forEach((v,i)=>smooth(this.matrix[i].gain,v));smooth(this.output.gain,o.muted?0:o.dim?10**(-o.dimDb/20):1);}
}
