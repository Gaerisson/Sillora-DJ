import {rampDistance} from './tempo-automation.mjs';
export function slipPosition(roll,now){
 const from=roll.started,to=Math.max(from,now),r=roll.ramp;
 if(!r)return roll.position+(to-from)*roll.rate;
 const integral=time=>{const before=Math.max(0,Math.min(time,r.start)-from),a=Math.max(0,from-r.start),b=Math.max(0,time-r.start);return before*r.from+rampDistance(b,r.from,r.to,r.duration,r.shape)-rampDistance(a,r.from,r.to,r.duration,r.shape);};
 return roll.position+integral(to);
}
