import {rampDistance,tempoShape} from './tempo-automation.mjs';
export function tempoRampSnapshot(r,now){
 if(!r)return null;
 return {version:2,from:r.from,to:r.to,duration:r.duration,shape:tempoShape(r.shape),elapsed:Math.max(0,Math.min(r.duration,now-r.start)),remaining:Math.max(0,Math.min(r.duration,r.start+r.duration-now)),wait:Math.max(0,r.start-now)};
}
export function remotePosition(deck,elapsed=0){
 const time=Math.max(0,Math.min(.5,elapsed)),r=deck.rateRamp;
 // A snapshot carries the remaining ramp, so the phone follows the same
 // integral as the audio rather than extrapolating a stale constant speed.
 const wait=r?Math.min(time,Math.max(0,r.wait||0)):0,during=r?Math.min(time-wait,Math.max(0,r.remaining)):0;
 const distance=r?.version===2?r.from*wait+rampDistance(r.elapsed+during,r.from,r.to,r.duration,r.shape)-rampDistance(r.elapsed,r.from,r.to,r.duration,r.shape)+Math.max(0,time-wait-during)*r.to:r?(deck.rate||1)*(wait+during)+(r.to-(deck.rate||1))*during*during/(2*Math.max(.0001,r.remaining))+Math.max(0,time-wait-during)*r.to:time*Math.max(0,deck.rate||1);
 const delta=deck.playing&&!deck.scratching?distance:0;
 let position=Math.max(0,(deck.position||0)+delta);
 const loop=deck.loop;if(loop&&Number.isFinite(loop.start)&&loop.end>loop.start&&position>=loop.end)position=loop.start+(position-loop.start)%(loop.end-loop.start);
 return Math.min(deck.duration||0,position);
}
export class LatestCommands{
 constructor(){this.slots=new Map();}
 send(key,action){const slot=this.slots.get(key)||{running:false};this.slots.set(key,slot);return new Promise((resolve,reject)=>{if(slot.pending)slot.pending.resolve({coalesced:true});slot.pending={action,resolve,reject};this.run(key,slot);});}
 async run(key,slot){if(slot.running)return;slot.running=true;while(slot.pending){const current=slot.pending;slot.pending=null;try{current.resolve(await current.action());}catch(error){current.reject(error);}}slot.running=false;this.slots.delete(key);}
}
