import {clamp} from './audio-math.mjs';

// The same integral drives the audio, rhythmic effects and the displayed clock.
export function tempoAt(time,from,to,duration){return from+(to-from)*clamp(time/Math.max(.001,duration),0,1);}
export function tempoBeats(time,from,to,duration){
 const t=clamp(time,0,duration),after=Math.max(0,time-duration);
 return (from*t+(to-from)*t*t/(2*duration)+after*to)/60;
}
export function tempoTime(beats,from,to,duration){
 const count=tempoBeats(duration,from,to,duration);
 if(beats<0)return beats*60/from;
 if(beats>count)return duration+(beats-count)*60/to;
 // Stable quadratic root, including equal or descending tempos.
 return 120*beats/(from+Math.sqrt(Math.max(0,from*from+120*(to-from)*beats/duration)));
}
export function tempoFraction(fraction,from,to,duration){return tempoTime(clamp(fraction,0,1)*tempoBeats(duration,from,to,duration),from,to,duration);}
export function tempoDelay(time,beats,from,to,duration){
 const count=tempoBeats(time,from,to,duration);
 return time-tempoTime(count-beats,from,to,duration);
}
export function warpTempoCurve(curve,from,to,duration){
 const result=new Float32Array(curve.length),total=tempoBeats(duration,from,to,duration);
 for(let i=0;i<result.length;i++){
  const x=tempoBeats(duration*i/(result.length-1),from,to,duration)/total*(curve.length-1),lo=Math.floor(x),hi=Math.min(curve.length-1,lo+1);
  result[i]=curve[lo]+(curve[hi]-curve[lo])*(x-lo);
 }
 return result;
}
