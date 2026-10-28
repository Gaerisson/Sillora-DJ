// Sample peak (not true peak), RMS and peak hold measured on the audio clock.
// Storage is allocated once. No array/object creation in the sample loop.
export const meterFloorDb=-100;
export const signalDb=value=>20*Math.log10(Math.max(1e-5,value));
const channel=()=>({rmsDb:meterFloorDb,peakDb:meterFloorDb,holdDb:meterFloorDb,clipped:false,clipSamples:0,invalidSamples:0});
export function emptyMeterFrame(){return{available:false,sequence:0,audioTime:0,windowSamples:0,master:{left:channel(),right:channel()},decks:[{left:channel(),right:channel()},{left:channel(),right:channel()}]};}

export class AudioMeterBank{
 constructor(rate,{interval=.05,hold=1.5,clipHold=2}={}){
  this.rate=rate;this.window=Math.max(128,Math.round(rate*interval));this.hold=hold;this.clipHold=clipHold;
  this.state=emptyMeterFrame();this.state.available=true;
  this.channels=[this.state.master.left,this.state.master.right,...this.state.decks.flatMap(d=>[d.left,d.right])];
  this.sum=new Float64Array(6);this.peak=new Float64Array(6);this.clips=new Uint32Array(6);this.invalid=new Uint32Array(6);this.holdUntil=new Float64Array(6);this.clipUntil=new Float64Array(6);this.samples=0;
 }
 process(inputs,frames,audioTime){
  for(let bus=0;bus<3;bus++)for(let ch=0;ch<2;ch++){
   const index=bus*2+ch,data=inputs[bus]?.[ch]??inputs[bus]?.[0];
   for(let i=0;i<frames;i++){
    let value=data?.[i]??0;if(!Number.isFinite(value)){value=0;this.invalid[index]++;}
    const absolute=Math.abs(value);this.sum[index]+=value*value;if(absolute>this.peak[index])this.peak[index]=absolute;if(absolute>=1)this.clips[index]++;
   }
  }
  this.samples+=frames;if(this.samples<this.window)return false;
  const elapsed=this.samples/this.rate;
  for(let i=0;i<6;i++){
   const c=this.channels[i];c.rmsDb=signalDb(Math.sqrt(this.sum[i]/this.samples));c.peakDb=signalDb(this.peak[i]);
   if(c.peakDb>=c.holdDb){c.holdDb=c.peakDb;this.holdUntil[i]=audioTime+this.hold;}
   else if(audioTime>this.holdUntil[i])c.holdDb=Math.max(c.peakDb,c.holdDb-20*elapsed);
   if(this.clips[i])this.clipUntil[i]=audioTime+this.clipHold;
   c.clipped=audioTime<this.clipUntil[i];c.clipSamples+=this.clips[i];c.invalidSamples+=this.invalid[i];
   this.sum[i]=0;this.peak[i]=0;this.clips[i]=0;this.invalid[i]=0;
  }
  this.state.sequence++;this.state.audioTime=audioTime;this.state.windowSamples=this.samples;this.samples=0;return true;
 }
 reset(){for(let i=0;i<6;i++){Object.assign(this.channels[i],channel());this.holdUntil[i]=0;this.clipUntil[i]=0;this.sum[i]=0;this.peak[i]=0;this.clips[i]=0;this.invalid[i]=0;}this.samples=0;}
}
