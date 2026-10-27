const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),number=(v,d,a,b)=>clamp(Number.isFinite(v)?v:d,a,b);
export const liveDefaults=Object.freeze({hpEnabled:true,highpassHz:80,eqLowDb:0,eqMidDb:0,eqHighDb:0,eqMidHz:1400,eqMidQ:1,gateEnabled:false,gateThresholdDb:-48,gateRangeDb:60,gateAttackMs:5,gateHoldMs:120,gateReleaseMs:100,compThresholdDb:-20,compRatio:3,compKneeDb:16,compAttackMs:8,compReleaseMs:180,makeupDb:0,limitEnabled:true,ceilingDb:-2,limitReleaseMs:100,autoNotchEnabled:false,autoNotchThresholdDb:-24,autoNotchProminenceDb:14,autoNotchHoldMs:800,autoNotchQ:18,autoNotchDepthDb:-9});
const limits={highpassHz:[80,20,500],eqLowDb:[0,-18,18],eqMidDb:[0,-18,18],eqHighDb:[0,-18,18],eqMidHz:[1400,180,8000],eqMidQ:[1,.2,10],gateThresholdDb:[-48,-80,-6],gateRangeDb:[60,0,90],gateAttackMs:[5,1,100],gateHoldMs:[120,0,2000],gateReleaseMs:[100,10,2000],compThresholdDb:[-20,-60,0],compRatio:[3,1,20],compKneeDb:[16,0,40],compAttackMs:[8,.1,500],compReleaseMs:[180,10,3000],makeupDb:[0,-12,24],ceilingDb:[-2,-18,-.1],limitReleaseMs:[100,10,1500],autoNotchThresholdDb:[-24,-70,-3],autoNotchProminenceDb:[14,6,40],autoNotchHoldMs:[800,300,5000],autoNotchQ:[18,3,40],autoNotchDepthDb:[-9,-24,-1]};
export function notchOptions(value={}){return{enabled:value.enabled===true,frequency:number(value.frequency,1000,100,12000),Q:number(value.Q,12,1,40),depthDb:number(value.depthDb,-12,-30,0)};}
export function liveOptions(value={}){const out={...liveDefaults};for(const [key,[fallback,min,max]] of Object.entries(limits))out[key]=number(value[key],fallback,min,max);for(const key of ['hpEnabled','limitEnabled'])out[key]=value[key]!==false;for(const key of ['gateEnabled','autoNotchEnabled','compress'])out[key]=value[key]===true;out.notches=Array.from({length:3},(_,index)=>notchOptions(value.notches?.[index]));return out;}
export function compressorReduction(levelDb,{compThresholdDb=-20,compRatio=3,compKneeDb=16}={}){const delta=levelDb-compThresholdDb,slope=1-1/compRatio;if(compKneeDb>0&&delta> -compKneeDb/2&&delta<compKneeDb/2)return slope*(delta+compKneeDb/2)**2/(2*compKneeDb);return delta>=compKneeDb/2?Math.max(0,delta*slope):0;}
export class GateLimiter{
 constructor(sampleRate,options={}){this.sampleRate=sampleRate;this.power=0;this.gateGain=1;this.limitGain=1;this.compressionGain=1;this.open=false;this.hold=0;this.output=new Float64Array(2);this.setOptions(options);}
 setOptions(value){this.options=liveOptions({...this.options,...value});const o=this.options,sr=this.sampleRate;this.detector=1-Math.exp(-1/(sr*.005));this.attack=1-Math.exp(-1/(sr*o.gateAttackMs/1000));this.release=1-Math.exp(-1/(sr*o.gateReleaseMs/1000));this.compAttack=1-Math.exp(-1/(sr*o.compAttackMs/1000));this.compRelease=1-Math.exp(-1/(sr*o.compReleaseMs/1000));this.limitRelease=1-Math.exp(-1/(sr*o.limitReleaseMs/1000));this.ceiling=10**(o.ceilingDb/20);}
 process(frame){const result=this.processStereo(frame[0],frame[1]??frame[0]);return frame.map((_,index)=>result[Math.min(index,1)]);}
 processStereo(left,right){const o=this.options,a=Number.isFinite(left)?left:0,b=Number.isFinite(right)?right:0,power=(a*a+b*b)/2;this.power+=(power-this.power)*this.detector;
  if(!o.gateEnabled)this.open=true;else if(this.power>=10**(o.gateThresholdDb/10)){this.open=true;this.hold=o.gateHoldMs*this.sampleRate/1000;}else if(this.power<10**((o.gateThresholdDb-3)/10)){this.hold=Math.max(0,this.hold-1);if(!this.hold)this.open=false;}
  const target=this.open?1:10**(-o.gateRangeDb/20);this.gateGain+=(target-this.gateGain)*(target>this.gateGain?this.attack:this.release);
  const reduction=o.compress?compressorReduction(10*Math.log10(Math.max(1e-12,this.power*this.gateGain*this.gateGain)),o):0,compTarget=10**(-reduction/20);this.compressionGain+=(compTarget-this.compressionGain)*(compTarget<this.compressionGain?this.compAttack:this.compRelease);
  const makeup=10**((o.makeupDb||0)/20),peak=Math.max(Math.abs(a),Math.abs(b))*this.gateGain*this.compressionGain*makeup,limit=o.limitEnabled&&peak>this.ceiling?this.ceiling/peak:1;
  if(limit<this.limitGain)this.limitGain=limit;else this.limitGain+=(limit-this.limitGain)*this.limitRelease;
  const gain=this.gateGain*this.compressionGain*makeup*this.limitGain;this.output[0]=a*gain;this.output[1]=b*gain;return this.output;
 }
}
export class TonalDetector{
 constructor(){this.frequency=0;this.since=0;this.last=0;}
 reset(){this.frequency=0;this.since=0;}
 inspect(spectrum,sampleRate,fftSize,timeMs,options){const o=liveOptions(options),binHz=sampleRate/fftSize,first=Math.ceil(180/binHz),last=Math.min(spectrum.length-2,Math.floor(10000/binHz));let best=-Infinity,index=-1;const levels=[];
  for(let i=first;i<=last;i++){const level=spectrum[i];if(Number.isFinite(level)){levels.push(level);if(level>best){best=level;index=i;}}}
  levels.sort((a,b)=>a-b);const median=levels[Math.floor(levels.length/2)]??-100,freq=index*binHz;
  if(index<0||best<o.autoNotchThresholdDb||best-median<o.autoNotchProminenceDb){this.reset();return null;}
  if(!this.frequency||Math.abs(freq-this.frequency)>Math.max(binHz*2,this.frequency*.018)){this.frequency=freq;this.since=timeMs;return null;}
  this.frequency=this.frequency*.8+freq*.2;
  if(timeMs-this.since<o.autoNotchHoldMs||timeMs-this.last<1200)return null;
  this.last=timeMs;return{frequency:this.frequency,Q:o.autoNotchQ,depthDb:o.autoNotchDepthDb,enabled:true,levelDb:best,prominenceDb:best-median};
 }
}
export function minimumDuck(controls){let result=1;for(const value of controls)if(Number.isFinite(value))result=Math.min(result,clamp(1+value,0,1));return result-1;}
