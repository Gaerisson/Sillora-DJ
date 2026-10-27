// Measured band energies for color waveforms. One pass, stereo power, no random color.
export function analyzeWaveBands(channels,rate,bins=2048){
 const length=channels[0]?.length||0,n=Math.max(1,Math.min(bins,Math.ceil(length/128))),low=new Float32Array(n),mid=new Float32Array(n),high=new Float32Array(n);
 const a=1-Math.exp(-2*Math.PI*250/rate),b=1-Math.exp(-2*Math.PI*2500/rate),states=channels.map(()=>[0,0]),counts=new Uint32Array(n);
 for(let i=0;i<length;i++){const at=Math.min(n-1,Math.floor(i*n/length));counts[at]++;for(let ch=0;ch<channels.length;ch++){const x=Number.isFinite(channels[ch][i])?channels[ch][i]:0,s=states[ch];s[0]+=a*(x-s[0]);s[1]+=b*(x-s[1]);const l=s[0],m=s[1]-s[0],h=x-s[1];low[at]+=l*l/channels.length;mid[at]+=m*m/channels.length;high[at]+=h*h/channels.length;}}
 let peak=0;for(let i=0;i<n;i++){low[i]=Math.sqrt(low[i]/Math.max(1,counts[i]));mid[i]=Math.sqrt(mid[i]/Math.max(1,counts[i]));high[i]=Math.sqrt(high[i]/Math.max(1,counts[i]));peak=Math.max(peak,low[i]+mid[i]+high[i]);}
 const normalize=v=>Array.from(v,x=>Math.round(Math.min(1,x/Math.max(.000001,peak))*1000)/1000);
 return {low:normalize(low),mid:normalize(mid),high:normalize(high),version:1};
}
export function bandColor(bands,index){const lo=bands?.low?.[index]||0,mi=bands?.mid?.[index]||0,hi=bands?.high?.[index]||0,total=Math.max(.0001,lo+mi+hi);return `rgb(${Math.round(50+205*lo/total)},${Math.round(70+185*mi/total)},${Math.round(85+170*hi/total)})`;}

// Keep the short transients visible when zoomed. Stereo peaks use the loudest
// channel so an out-of-phase signal cannot disappear from the waveform.
export function analyzeWaveDetail(channels,rate){
 const length=channels[0]?.length||0,count=Math.min(16384,Math.max(1,length)),peaks=new Float32Array(count);
 for(let i=0;i<length;i++){
  const bin=Math.min(count-1,Math.floor(i*count/Math.max(1,length)));
  for(const channel of channels){const value=Number.isFinite(channel[i])?Math.abs(channel[i]):0;if(value>peaks[bin])peaks[bin]=value;}
 }
 return {waveformVersion:2,peaks,waveBands:{...analyzeWaveBands(channels,rate,8192),version:2}};
}
