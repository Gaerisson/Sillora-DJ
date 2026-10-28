import {clamp,waveformPeaks} from './audio-math.mjs';
import {rhythmEvidence} from './rhythm-evidence.mjs';
export {rhythmEvidence} from './rhythm-evidence.mjs';
export const ANALYSIS_VERSION=3;
const mean=a=>a.reduce((s,x)=>s+x,0)/Math.max(1,a.length);
const median=a=>{const s=[...a].sort((a,b)=>a-b);return s[Math.floor(s.length/2)]||0;};
function fft(real,imag){
 const n=real.length;for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j)[real[i],real[j]]=[real[j],real[i]];}
 for(let len=2;len<=n;len<<=1){const angle=-2*Math.PI/len;for(let at=0;at<n;at+=len)for(let j=0;j<len/2;j++){const c=Math.cos(angle*j),s=Math.sin(angle*j),k=at+j+len/2,r=real[k]*c-imag[k]*s,im=real[k]*s+imag[k]*c;real[k]=real[at+j]-r;imag[k]=imag[at+j]-im;real[at+j]+=r;imag[at+j]+=im;}}
}
function coefficient(type,f,q,g,sr){
 const w=2*Math.PI*f/sr,c=Math.cos(w),s=Math.sin(w),a=s/(2*q),A=10**(g/40);let b0,b1,b2,a0,a1,a2;
 if(type==='highpass'){b0=(1+c)/2;b1=-(1+c);b2=b0;a0=1+a;a1=-2*c;a2=1-a;}
 else{const t=2*Math.sqrt(A)*a;b0=A*((A+1)+(A-1)*c+t);b1=-2*A*((A-1)+(A+1)*c);b2=A*((A+1)+(A-1)*c-t);a0=(A+1)-(A-1)*c+t;a1=2*((A-1)-(A+1)*c);a2=(A+1)-(A-1)*c-t;}
 return [b0/a0,b1/a0,b2/a0,a1/a0,a2/a0];
}
function filterState(c){let x1=0,x2=0,y1=0,y2=0;return x=>{const y=c[0]*x+c[1]*x1+c[2]*x2-c[3]*y1-c[4]*y2;x2=x1;x1=x;y2=y1;y1=y;return y;};}
function envelopes(channels,sr){
 const hop=Math.max(1,Math.round(sr*.1)),energy=[],weighted=[],bass=[],mono=new Float32Array(channels[0].length);let peak=0;
 const states=channels.map(()=>[filterState(coefficient('shelf',1681,.707,4,sr)),filterState(coefficient('highpass',38,.5,0,sr))]);let low=0;const alpha=1-Math.exp(-2*Math.PI*180/sr);
 for(let at=0;at<mono.length;at+=hop){let e=0,k=0,b=0;const end=Math.min(at+hop,mono.length);
  for(let i=at;i<end;i++){let m=0;for(let ch=0;ch<channels.length;ch++){const x=Number.isFinite(channels[ch][i])?channels[ch][i]:0;m+=x;peak=Math.max(peak,Math.abs(x));e+=x*x/channels.length;const y=states[ch][1](states[ch][0](x));k+=y*y;}m/=channels.length;mono[i]=m;low+=alpha*(m-low);b+=low*low;}
  energy.push(e/Math.max(1,end-at));weighted.push(k/Math.max(1,end-at));bass.push(Math.sqrt(b/Math.max(1,end-at)));
 }
 // K weighting and relative gating; estimate, not a certified LUFS/true-peak meter.
 const blocks=[];for(let i=0;i+3<weighted.length;i++)blocks.push(mean(weighted.slice(i,i+4)));
 const absolute=blocks.filter(x=>x>10**((-70+.691)/10)),relative=mean(absolute)*.1,gated=absolute.filter(x=>x>=relative);
 return {mono,energy,bass,peak,lufs:gated.length?-.691+10*Math.log10(mean(gated)):null,rms:Math.sqrt(mean(energy))};
}
function spectrum(samples,sr){
 const rate=11025,step=sr/rate,length=Math.floor(samples.length/step),audio=new Float32Array(length);
 for(let i=0;i<length;i++){const lo=Math.floor(i*step),hi=Math.min(samples.length,Math.max(lo+1,Math.floor((i+1)*step)));let sum=0;for(let j=lo;j<hi;j++)sum+=samples[j];audio[i]=sum/(hi-lo);}
 const size=1024,hop=256,re=new Float64Array(size),im=new Float64Array(size),prev=new Float64Array(size/2),floor=new Float64Array(size/2),flux=[],density=[],chroma=new Float64Array(12);
 const window=Float64Array.from({length:size},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/(size-1)));
 for(let at=0;at+size<=audio.length;at+=hop){im.fill(0);for(let i=0;i<size;i++)re[i]=audio[at+i]*window[i];fft(re,im);let onset=0,occupied=0;
  for(let k=3;k<size/2;k++){const magnitude=Math.hypot(re[k],im[k]);floor[k]=Math.max(magnitude*.02,floor[k]*.96+magnitude*.04);const white=Math.log1p(magnitude/Math.max(.005,floor[k]));onset+=Math.max(0,white-prev[k]);prev[k]=white;occupied+=magnitude>.7?1:0;
   if(at%(hop*4)===0&&k*rate/size>=80&&k*rate/size<=3500){const note=69+12*Math.log2(k*rate/size/440),bin=((Math.round(note)%12)+12)%12;chroma[bin]+=Math.sqrt(magnitude);}}
  flux.push(onset);density.push(occupied/(size/2));
 }
 return {flux:flux.map((v,i)=>Math.max(0,v-mean(flux.slice(Math.max(0,i-16),i+17))*.7)),density,chroma,dt:hop/rate,center:size/2/rate,audio,rate};
}
function rhythm(s){
 const {flux,dt,center}=s,n=flux.length,max=flux.reduce((a,b)=>Math.max(a,b),0);if(n<80||max<.01)return {bpm:null,beatOffset:0,tempoConfidence:0,beatStability:0,beats:[],tempoMap:[]};
 const norm=flux.reduce((a,x)=>a+x*x,0)||1,correlation=[];
 for(let lag=1;lag<=Math.ceil(60/55/dt)*4;lag++){let sum=0;for(let i=lag;i<n;i++)sum+=flux[i]*flux[i-lag];correlation[lag]=sum/norm*n/Math.max(n-lag,1);}
 const ac=lag=>{const i=Math.floor(lag),p=lag-i;return (correlation[i]||0)*(1-p)+(correlation[i+1]||0)*p;};
 const score=bpm=>{const lag=60/bpm/dt;return ac(lag)+.45*ac(lag*2)+.2*ac(lag*3)+.15*ac(lag*4);};
 const candidates=[];for(let bpm=60;bpm<=190;bpm+=.1)candidates.push({bpm,score:score(bpm)*(1-.16*Math.abs(Math.log2(bpm/112)))});candidates.sort((a,b)=>b.score-a.score);let bpm=candidates[0].bpm;const doubled=candidates.find(c=>Math.abs(c.bpm-bpm*2)<.3&&c.score>candidates[0].score*.78);if(bpm<78&&doubled&&doubled.bpm<=155)bpm=doubled.bpm;let period=60/bpm;
 const peaks=[];for(let i=1;i<n-1;i++)if(flux[i]>max*.13&&flux[i]>=flux[i-1]&&flux[i]>flux[i+1])peaks.push({t:i*dt+center,w:flux[i]});
 const phaseScore=phase=>peaks.reduce((sum,p)=>{const d=Math.abs(((p.t-phase+period/2)%period+period)%period-period/2);return sum+p.w*Math.exp(-.5*(d/.035)**2);},0);
 let phase=0,best=-1;for(let t=0;t<period;t+=dt/4){const v=phaseScore(t);if(v>best){best=v;phase=t;}}
 let matched=[];for(let iteration=0;iteration<3;iteration++){
  matched=peaks.map(p=>({...p,k:Math.round((p.t-phase)/period)})).filter(p=>Math.abs(p.t-phase-p.k*period)<.065);
  const byBeat=new Map();for(const p of matched)if(!byBeat.has(p.k)||byBeat.get(p.k).w<p.w)byBeat.set(p.k,p);matched=[...byBeat.values()];
  const sw=matched.reduce((a,p)=>a+p.w,0),mk=matched.reduce((a,p)=>a+p.k*p.w,0)/sw,mt=matched.reduce((a,p)=>a+p.t*p.w,0)/sw;
  const den=matched.reduce((a,p)=>a+(p.k-mk)**2*p.w,0),fit=matched.reduce((a,p)=>a+(p.k-mk)*(p.t-mt)*p.w,0)/den;
  if(Number.isFinite(fit)&&Math.abs(fit-period)<period*.02){period=fit;phase=mt-period*mk;}
 }
 bpm=60/period;
 // Refine spectral attacks against short-time sample energy, avoiding the STFT window bias.
 const energy=[];const stride=Math.round(s.rate*.003);for(let i=0;i<s.audio.length;i+=stride){let sum=0;for(let j=i;j<Math.min(i+stride,s.audio.length);j++)sum+=s.audio[j]*s.audio[j];energy.push(Math.sqrt(sum/stride));}
 const corrections=[];for(const p of matched){const lo=Math.max(1,Math.floor((p.t-.045)*s.rate/stride)),hi=Math.min(energy.length-1,Math.ceil((p.t+.065)*s.rate/stride));let best=0,at=lo;for(let i=lo;i<=hi;i++){const delta=energy[i]-energy[i-1];if(delta>best){best=delta;at=i;}}if(best>.002)corrections.push(at*stride/s.rate-p.t);}
 phase+=clamp(median(corrections),-.04,.06);phase=((phase%period)+period)%period;
 const fitPhase=phase-clamp(median(corrections),-.04,.06),jitter=Math.sqrt(mean(matched.map(p=>(p.t-fitPhase-Math.round((p.t-fitPhase)/period)*period)**2))),periodic=clamp(ac(period/dt)*3,0,1),tempoMap=[];
 for(let start=0;start<n*dt;start+=12){const group=matched.filter(p=>p.t>=start&&p.t<start+12);if(group.length>5){const slopes=[];for(let i=1;i<group.length;i++){const d=group[i].k-group[i-1].k;if(d>0)slopes.push((group[i].t-group[i-1].t)/d);}const p=(group.at(-1).t-group[0].t)/(group.at(-1).k-group[0].k);if(p>0)tempoMap.push({time:start,bpm:Math.round(60/p*10)/10});}}
 const drift=tempoMap.length>1?Math.sqrt(mean(tempoMap.map(x=>(x.bpm-bpm)**2)))/bpm:0,beats=[];for(let t=phase;t<n*dt;t+=period)beats.push(Math.round(t*10000)/10000);
 return {bpm:Math.round(bpm*100)/100,beatOffset:phase,...rhythmEvidence({peaks,matched,period,phase:fitPhase,duration:s.audio.length/s.rate,jitter,periodic,drift,tempoWindowCount:tempoMap.length}),beatJitterMs:Math.round(jitter*1000),beats,tempoMap};
}
function keyEstimate(chroma){
 const major=[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88],minor=[6.33,2.68,3.52,5.38,2.6,3.53,2.54,4.75,3.98,2.69,3.34,3.17],names=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
 const centered=Array.from(chroma,x=>x-mean([...chroma])),norm=Math.hypot(...centered);if(norm<.01)return {key:null,keyConfidence:0};const results=[];
 for(const [mode,profile] of [['major',major],['minor',minor]])for(let root=0;root<12;root++){const p=Array.from({length:12},(_,i)=>profile[(i-root+12)%12]-mean(profile));results.push({root,mode,score:centered.reduce((s,x,i)=>s+x*p[i],0)/(norm*Math.hypot(...p))});}
 results.sort((a,b)=>b.score-a.score);const a=results[0];return {key:names[a.root]+(a.mode==='minor'?'m':''),keyRoot:a.root,keyMode:a.mode,keyConfidence:clamp((a.score-results[1].score)*5,0,1)};
}
export function analyzeTrack(input,sampleRate){
 const channels=Array.isArray(input)?input:[input];if(!channels.length||!Number.isFinite(sampleRate)||sampleRate<4000)throw new Error('Audio non valide.');
 const e=envelopes(channels,sampleRate),s=spectrum(e.mono,sampleRate),r=rhythm(s),duration=e.mono.length/sampleRate,env=e.energy.map(Math.sqrt),max=env.reduce((a,b)=>Math.max(a,b),0);
 const threshold=Math.max(.0001,max*.005),first=env.findIndex(x=>x>threshold),last=env.findLastIndex(x=>x>threshold),audibleStart=first<0?0:first*.1,audibleEnd=last<0?duration:Math.min(duration,(last+1)*.1),beat=60/(r.bpm||120);let downbeat=r.beatOffset,best=-Infinity;
 for(let phase=0;phase<4;phase++){let score=0,n=0;for(let t=r.beatOffset+phase*beat;t<Math.min(audibleEnd,90);t+=4*beat){const i=Math.round(t*10);score+=(e.bass[i]||0)-(e.bass[i-1]||0)*.6;n++;}if(n&&score/n>best){best=score/n;downbeat=r.beatOffset+phase*beat;}}
 const snap=(t,up=false)=>r.bpm?downbeat+(up?Math.ceil:Math.floor)((t-downbeat)/(beat*4))*beat*4:t,windows=[],bar=4*beat;
 for(let at=Math.max(audibleStart,snap(audibleStart,true));at+bar<=audibleEnd;at+=bar){const lo=Math.floor(at*10),hi=Math.floor((at+bar)*10),rms=Math.sqrt(mean(e.energy.slice(lo,hi))),density=mean(s.density.slice(Math.floor(at/s.dt),Math.ceil((at+bar)/s.dt)));windows.push({time:at,rms,density});}
 const choose=(candidates,tail)=>candidates.map(w=>({...w,score:w.density*.65+Math.abs(w.rms/Math.max(.001,e.rms)-.75)*.15+(tail?(audibleEnd-w.time)/Math.max(1,duration):w.time/Math.max(1,duration))*.2})).sort((a,b)=>a.score-b.score)[0];
 const regionLength=Math.min(8*bar,Math.max(bar,(audibleEnd-audibleStart)*.22)),entry=choose(windows.filter(w=>w.time<Math.min(audibleStart+24,duration*.2)),false),outro=choose(windows.filter(w=>w.time>=Math.max(audibleStart+regionLength,audibleEnd-32)&&w.time<=audibleEnd-2*bar),true);
 const mixIn=clamp(entry?.time??audibleStart,0,Math.max(0,duration-.1)),mixOut=clamp(outro?.time??snap(audibleEnd-Math.min(16*beat,duration*.25)),mixIn,duration),confidence=!r.bpm||r.tempoConfidence<.48||r.beatStability<.45?'low':'estimated';
 const autoGain=clamp(e.lufs===null?1:10**((-18-e.lufs)/20),.25,1.8);
 return {...r,...keyEstimate(s.chroma),analysisVersion:ANALYSIS_VERSION,downbeat,audibleStart,audibleEnd,mixIn,mixOut,introEnd:Math.min(mixIn+regionLength,mixOut),outroEnd:audibleEnd,rms:e.rms,peak:e.peak,loudnessLUFS:e.lufs,autoGain:Math.min(autoGain,.84/Math.max(.01,e.peak)),envelope:env,bassEnvelope:e.bass,structure:windows,confidence,peaks:waveformPeaks(e.mono,4096)};
}
