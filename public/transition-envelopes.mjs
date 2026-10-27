import {clamp} from './audio-math.mjs';

// Piecewise gain curves for the transition EQ layer.
export function segment(p, from, to, start, end) {
  return from + (to - from) * clamp((p - start) / (end - start), 0, 1);
}
export function eqEnvelope(style, progress) {
  const p=clamp(progress,0,1),r=(a,b,c,d)=>segment(p,a,b,c,d);
  if(style==='bass')return {
    out:[r(0,-18,.47,.6),r(0,-9,.8,1)+r(0,2,.4,.5)+r(0,-2,.5,.8),r(0,-12,.3,1)],
    in:[r(-18,0,.4,.53),r(-9,0,0,.2)+r(0,2,.2,.5)+r(0,-2,.5,.6),r(-12,0,0,.7)]
  };
  if(style==='dissolve')return {
    out:[r(0,-24,.2,.62),r(0,3,.2,.5)-r(0,3,.6,1),r(0,-24,.2,1)],
    in:[r(-24,0,.15,.4),r(-24,0,.25,.65),0]
  };
  return {out:[0,0,0],in:[0,0,0]};
}
export function eqCurves(style,count=1024){
  const curves={out:Array.from({length:3},()=>new Float32Array(count)),in:Array.from({length:3},()=>new Float32Array(count))};
  for(let i=0;i<count;i++){const point=eqEnvelope(style,i/(count-1));for(const side of ['out','in'])for(let band=0;band<3;band++)curves[side][band][i]=point[side][band];}
  return curves;
}
