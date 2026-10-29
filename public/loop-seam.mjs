const unit=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=unit(x);return x*x*(3-2*x);};
export const LOOP_FADE_SECONDS=.004;
export function splitTime(value){const high=Math.fround(value);return[high,Math.fround(value-high)];}
export function roundedLoop(start,end,sampleRate){if(!(sampleRate>0))return{start,end};return{start:Math.round(start*sampleRate)/sampleRate,end:Math.round(end*sampleRate)/sampleRate};}

// Positive playback, with the same k-rate speed and native-file bounds as the
// BufferSource. No PCM copy, lookahead buffer or extra audio latency is needed.
export class LoopSeam{
 constructor({offset=0,started=0,sampleRate=48000}={}){Object.assign(this,{offset,position:offset,started,sampleRate});this.began=false;this.entered=false;this.wrapped=false;this.wasEnabled=false;this.gain=1;this.last=[];this.correction=[];this.join=0;}
 arm(offset,started){this.offset=this.position=offset;this.started=started;this.began=false;this.entered=false;this.wrapped=false;}
 process(input,output,parameters,firstFrame){
  const p=parameters,rate=Math.max(.001,p.rate[0]),enabled=p.enabled[0]>.5,start=p.start[0]+p.startFine[0],end=p.end[0]+p.endFine[0],length=end-start,active=enabled&&length>1/this.sampleRate,seconds=Math.min(Math.max(0,p.fade[0]),Math.max(0,length/rate/8)),fadeFrames=Math.max(1,Math.round(LOOP_FADE_SECONDS*this.sampleRate));
  if(!active){this.entered=false;this.wrapped=false;}
  const activation=active&&!this.wasEnabled,changed=active&&this.wasEnabled&&(start!==this.lastStart||end!==this.lastEnd),joining=activation||changed;if(activation){this.entered=false;this.wrapped=false;}if(joining){this.wrapped=false;this.join=seconds>0?fadeFrames:0;}
  // A forward native source clamps to the new IN when a shorter OUT has
  // already been passed. Normal repeated wraps retain their remainder.
  if(joining&&this.began&&this.position>=end){this.position=start;this.entered=true;this.wrapped=true;}else if(changed&&this.position<start)this.entered=false;
  const n=output[0]?.length||0;
  for(let i=0;i<n;i++){
   const time=(firstFrame+i)/this.sampleRate;let gain=1;
   if(time>=this.started){
    if(!this.began){this.position=this.offset+Math.max(0,time-this.started)*rate;this.began=true;if(active&&this.offset>=end)this.position=end;}
    if(active){
     if(!this.entered&&((this.offset<end&&this.position>=start)||(this.offset>=end&&this.position<end)))this.entered=true;
     if(this.entered&&this.position>=end){this.position=start+(this.position-start)%length;this.wrapped=true;}
     if(this.entered&&seconds>0){const remaining=(end-this.position)/rate,elapsed=(this.position-start)/rate;gain=smooth(Math.min(remaining,this.wrapped?elapsed:Infinity)/seconds);}
    }else gain=Math.min(1,this.gain+1/fadeFrames);
    this.position+=rate/this.sampleRate;
    if(active&&this.entered&&this.position>=end){this.position=start+(this.position-start)%length;this.wrapped=true;}
   }
   for(let c=0;c<output.length;c++){
    const x=input[c]?.[i]||0,y=x*gain;
    if(joining&&i===0)this.correction[c]=this.last[c]??y;
    const weight=this.join>0?smooth(this.join/fadeFrames):0,value=y*(1-weight)+(this.correction[c]||0)*weight;output[c][i]=value;this.last[c]=value;
   }
   this.gain=gain;if(this.join>0)this.join--;
  }
  this.wasEnabled=active;this.lastStart=start;this.lastEnd=end;
 }
}
