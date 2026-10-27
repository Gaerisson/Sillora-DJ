const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const bounded=(value,fallback,min,max)=>Number.isFinite(value)?clamp(value,min,max):fallback;

// Original, linked-stereo kick detector and complementary-band ducking. No
// lookahead or added audio delay. Only the music bus passes through this DSP.
export class KickPumping {
 constructor(rate=48000,options={}){
  this.rate=Math.max(8000,rate);this.low1=new Float64Array(2);this.low2=new Float64Array(2);this.dc=new Float64Array(2);this.detector=new Float64Array(2);
  this.fast=0;this.slow=0;this.peakFast=0;this.envelope=0;this.reduction=0;this.wet=0;this.frames=0;this.lastKick=-this.rate;this.armed=true;this.kicks=0;
  this.set(options);this.stats={reductionDb:0,levelDb:-100,kicks:0};
 }
 set(options={}){
  this.options={pumpEnabled:options.pumpEnabled===true,pumpDepth:bounded(options.pumpDepth,2.5,0,6),pumpRelease:bounded(options.pumpRelease,180,60,450),pumpThreshold:bounded(options.pumpThreshold,-27,-48,-12),pumpCrossover:bounded(options.pumpCrossover,150,80,220)};
  const exp=ms=>1-Math.exp(-1/(this.rate*ms/1000));
  this.cross=1-Math.exp(-2*Math.PI*this.options.pumpCrossover/this.rate);this.hp=1-Math.exp(-2*Math.PI*32/this.rate);this.lp=1-Math.exp(-2*Math.PI*145/this.rate);
  this.attack=exp(3);this.fastAlpha=exp(4);this.slowAlpha=exp(180);this.mixAlpha=exp(12);this.release=Math.exp(-3.5/(this.rate*this.options.pumpRelease/1000));this.threshold=10**(this.options.pumpThreshold/10);
 }
 reset(){this.fast=this.slow=this.peakFast=this.envelope=this.reduction=0;this.armed=true;this.lastKick=this.frames-this.rate;this.stats={reductionDb:0,levelDb:-100,kicks:this.kicks};}
 process(input,output){
  const length=output[0]?.length||0,channels=Math.min(2,output.length);let peakReduction=0,energySum=0;
  for(let i=0;i<length;i++){
   let energy=0;
   for(let ch=0;ch<channels;ch++){
    const raw=(input[ch]||input[0])?.[i],x=Number.isFinite(raw)?raw:0;
    this.dc[ch]+=this.hp*(x-this.dc[ch]);this.detector[ch]+=this.lp*(x-this.dc[ch]-this.detector[ch]);energy+=this.detector[ch]**2/Math.max(1,channels);
   }
   this.fast+=this.fastAlpha*(energy-this.fast);this.slow+=this.slowAlpha*(energy-this.slow);energySum+=energy;
   this.peakFast=Math.max(this.peakFast,this.fast);
   if(this.fast<this.peakFast*.38||this.fast<this.threshold*.55)this.armed=true;
   if(this.options.pumpEnabled&&this.armed&&this.frames-this.lastKick>this.rate*.12&&this.fast>this.threshold&&this.fast>this.slow*1.65){this.lastKick=this.frames;this.armed=false;this.peakFast=this.fast;this.envelope=1;this.kicks++;}
   this.envelope*=this.release;
   const target=this.options.pumpEnabled?this.options.pumpDepth*this.envelope:0;
   this.reduction+=this.attack*(target-this.reduction);this.wet+=this.mixAlpha*((this.options.pumpEnabled?1:0)-this.wet);if(this.wet<1e-7)this.wet=0;
   const gain=10**(-this.reduction/20);peakReduction=Math.max(peakReduction,this.reduction*this.wet);
   for(let ch=0;ch<channels;ch++){
    const raw=(input[ch]||input[0])?.[i],x=Number.isFinite(raw)?raw:0;
    this.low1[ch]+=this.cross*(x-this.low1[ch]);this.low2[ch]+=this.cross*(this.low1[ch]-this.low2[ch]);
    const pumped=this.low2[ch]+(x-this.low2[ch])*gain;
    output[ch][i]=this.wet===0||this.reduction<1e-10?x:x+this.wet*(pumped-x);
   }
   for(let ch=channels;ch<output.length;ch++)output[ch][i]=0;
   this.frames++;
  }
  this.stats={reductionDb:peakReduction,levelDb:Math.max(-100,10*Math.log10(Math.max(1e-10,energySum/Math.max(1,length)))),kicks:this.kicks};
 }
}
