import {clamp} from './audio-math.mjs';

export const tempoShapes=Object.freeze({linear:'Linéaire',smooth:'Souple',early:'Anticipée',late:'Tardive'});
export const tempoShape=value=>Object.hasOwn(tempoShapes,value)?value:'linear';
const segments=128,profiles={};
for(const id of Object.keys(tempoShapes)){
 const points=Array.from({length:segments+1},(_,i)=>{const x=i/segments;return id==='smooth'?x*x*(3-2*x):id==='early'?x*(2-x):id==='late'?x*x:x;});
 const area=[0];for(let i=1;i<=segments;i++)area[i]=area[i-1]+(points[i-1]+points[i])/(2*segments);
 profiles[id]={points,area};
}
function shapeValue(x,id){const {points}=profiles[tempoShape(id)],index=clamp(x,0,1)*segments,lo=Math.min(segments-1,Math.floor(index));return points[lo]+(points[lo+1]-points[lo])*(index-lo);}
function shapeArea(x,id){const {points,area}=profiles[tempoShape(id)],index=clamp(x,0,1)*segments,lo=Math.min(segments-1,Math.floor(index)),part=index-lo;return area[lo]+(points[lo]*part+(points[lo+1]-points[lo])*part*part/2)/segments;}
export function tempoMean(from,to,shape='linear'){return from+(to-from)*profiles[tempoShape(shape)].area[segments];}
// The audio ramps and their exact piecewise integral share these knots.
export function scheduleTempo(param,from,to,start,duration,shape='linear'){
 const id=tempoShape(shape),points=profiles[id].points;
 if(id==='linear'){param.linearRampToValueAtTime(to,start+duration);return;}
 for(let i=1;i<=segments;i++)param.linearRampToValueAtTime(from+(to-from)*points[i],start+duration*i/segments);
}
export function tempoAt(time,from,to,duration,shape='linear'){return from+(to-from)*shapeValue(time/Math.max(.001,duration),shape);}
export function rampDistance(time,from,to,duration,shape='linear'){
 duration=Math.max(.001,duration);const t=clamp(time,0,duration),after=Math.max(0,time-duration);
 return from*t+(to-from)*duration*shapeArea(t/duration,shape)+after*to;
}
export function tempoBeats(time,from,to,duration,shape='linear'){return rampDistance(time,from,to,duration,shape)/60;}
export function tempoTime(beats,from,to,duration,shape='linear'){
 const count=tempoBeats(duration,from,to,duration,shape);
 if(beats<0)return beats*60/from;
 if(beats>count)return duration+(beats-count)*60/to;
 if(tempoShape(shape)!=='linear'){
  let lo=0,hi=duration;for(let i=0;i<48;i++){const mid=(lo+hi)/2;if(tempoBeats(mid,from,to,duration,shape)<beats)lo=mid;else hi=mid;}return (lo+hi)/2;
 }
 // Stable quadratic root, including equal or descending tempos.
 return 120*beats/(from+Math.sqrt(Math.max(0,from*from+120*(to-from)*beats/duration)));
}
export function tempoFraction(fraction,from,to,duration,shape='linear'){return tempoTime(clamp(fraction,0,1)*tempoBeats(duration,from,to,duration,shape),from,to,duration,shape);}
export function tempoDelay(time,beats,from,to,duration,shape='linear'){
 const count=tempoBeats(time,from,to,duration,shape);
 return time-tempoTime(count-beats,from,to,duration,shape);
}
export function warpTempoCurve(curve,from,to,duration,shape='linear'){
 const result=new Float32Array(curve.length),total=tempoBeats(duration,from,to,duration,shape);
 for(let i=0;i<result.length;i++){
  const x=clamp(tempoBeats(duration*i/(result.length-1),from,to,duration,shape)/total,0,1)*(curve.length-1),lo=Math.floor(x),hi=Math.min(curve.length-1,lo+1);
  result[i]=curve[lo]+(curve[hi]-curve[lo])*(x-lo);
 }
 return result;
}
