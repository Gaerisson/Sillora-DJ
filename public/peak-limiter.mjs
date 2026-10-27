// Stereo-linked sample peak protection with a 5 ms lookahead. Does not claim true-peak metering.
export class PeakLimiter {
 constructor(rate){this.ceiling=.97;this.delay=Math.ceil(rate*.005);this.size=this.delay+1;this.rings=[new Float32Array(this.size),new Float32Array(this.size)];this.peaks=new Float32Array(this.size);this.index=0;this.gain=1;this.release=Math.exp(-1/(rate*.08));this.attack=Math.exp(-1/(rate*.00025));}
 setCeilingDb(db){if(Number.isFinite(db))this.ceiling=10**(Math.max(-12,Math.min(-.1,db))/20);}
 process(input,output){
  for(let i=0;i<output[0].length;i++){
   let peak=0;for(let ch=0;ch<2;ch++){const value=input[ch]?.[i]??input[0]?.[i]??0;this.rings[ch][this.index]=Number.isFinite(value)?value:0;peak=Math.max(peak,Math.abs(this.rings[ch][this.index]));}
   this.peaks[this.index]=peak;let max=0;for(const p of this.peaks)max=Math.max(max,p);
   const target=Math.min(1,(this.ceiling*.94/.97)/Math.max(.0001,max)),c=target<this.gain?this.attack:this.release;this.gain=target+(this.gain-target)*c;
   const read=(this.index+1)%this.size;for(let ch=0;ch<output.length;ch++)output[ch][i]=Math.max(-this.ceiling,Math.min(this.ceiling,this.rings[Math.min(ch,1)][read]*this.gain));this.index=read;
  }
 }
}
