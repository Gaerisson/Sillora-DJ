import {makeTransitionPlan} from './analysis.mjs';

// This timer only prepares and arms the passage. Sources and effect envelopes
// are scheduled by the engine on the audio clock, before the OUT boundary.
export class AutomixScheduler {
  constructor(engine,{enabled,prepare,options,pending=()=>false,onExhausted=()=>{},onError=()=>{},lookahead=6,holdAhead=6,maxHold=30}={}) {
    Object.assign(this,{engine,enabled,prepare,options,pending,onExhausted,onError,lookahead,holdAhead,maxHold});
    this.state={phase:'off',countdown:null};this.busy=false;
    this.metrics={scheduled:0,recovered:0,late:0,preparationMs:0,holds:0,holdTimeouts:0};
  }
  releaseHolds(){for(let id=0;id<2;id++)this.engine.releaseContinuity?.(id);}
  protect(active,pending){
    const e=this.engine,d=e.decks[active],held=d.continuity;
    if(held&&e.context.currentTime-held.armedAt>=this.maxHold){this.expiredTrack=d.track;this.metrics.holdTimeouts++;e.releaseContinuity(active);return false;}
    if(!pending||this.expiredTrack===d.track||!d.playing||d.scratching||d.braking)return false;
    const end=Math.min(d.track.buffer.duration,d.track.audibleEnd??d.track.buffer.duration),remaining=(end-e.position(active))/Math.max(.01,e.currentRate(active));
    if(remaining>this.holdAhead&&!held)return false;
    if(!held&&e.holdForNext?.(active,{maxSeconds:this.maxHold}))this.metrics.holds++;
    if(d.continuity){this.state={phase:'holding',countdown:null,remaining:Math.max(0,this.maxHold-(e.context.currentTime-d.continuity.armedAt))};return true;}return false;
  }
  async tick() {
    const engine=this.engine;
    if(!this.enabled()){this.releaseHolds();this.expiredTrack=null;this.state={phase:'off',countdown:null};return;}
    if(!engine.context)return;
    if(engine.transition){
      const t=engine.transition,wait=t.start-engine.context.currentTime;
      this.state={phase:wait>0?'scheduled':'mixing',countdown:Math.max(0,wait),style:t.style,target:t.titleB};return;
    }
    const active=engine.crossfade<.5?0:1,other=1-active,d=engine.decks[active];
    if(engine.decks[other].continuity)engine.releaseContinuity?.(other);
    if(!d.track||d.scratching||engine.decks[other].scratching){this.releaseHolds();return;}
    // A pause is never an instruction to restart the set. Natural EOF carries
    // a separate flag so a delayed preparation can recover without replaying A.
    if(!d.playing&&!d.endedNaturally){this.releaseHolds();this.state={phase:'paused',countdown:null};return;}
    if(d.loop&&!d.continuity){this.state={phase:'loop',countdown:null};return;}
    if(this.busy){if(this.preparing===d.track)this.protect(active,true);return;}
    const track=d.track;
    this.busy=true;this.preparing=track;
    try {
      const began=performance.now(),ready=await this.prepare(active);
      this.metrics.preparationMs=performance.now()-began;
      if(!this.enabled()||engine.transition||(engine.crossfade<.5?0:1)!==active||engine.decks[active].track!==track)return;
      if((!d.playing&&!d.endedNaturally)||d.scratching||(d.loop&&!d.continuity))return;
      const b=engine.decks[other];
      if(!ready||!b.track){
        const pending=this.pending();this.state={phase:'waiting',countdown:null};
        if(this.protect(active,pending))return;
        if(!pending)engine.releaseContinuity?.(active);
        if(d.endedNaturally&&!pending)this.onExhausted();return;
      }
      const options=this.options(),position=engine.position(active),rate=engine.currentRate(active);
      if(d.continuity){
        await engine.startTransition({...options,style:'bass',sync:false,tempoBlend:false,beats:4,quantize:false,startNow:true,skipBeats:4,automix:true,continuityRecovery:true});
        if(engine.transition){this.metrics.scheduled++;this.state={phase:'mixing',countdown:0,style:engine.transition.style,target:b.track.title,reason:'Relais de secours après préparation.'};}return;
      }
      const plan=makeTransitionPlan({...d,rate},b,{...options,position,stemsAvailable:Boolean(d.stemGains&&b.track.stemBuffer)});
      const until=(plan.outPoint-position)/Math.max(.01,rate),remaining=(d.track.buffer.duration-position)/Math.max(.01,rate);
      this.state={phase:'ready',countdown:Math.max(0,until),style:plan.style,target:b.track.title,seconds:plan.seconds};
      if(until>this.lookahead&&remaining>plan.seconds+this.lookahead)return;
      if(until<0)this.metrics.late++;
      if(d.endedNaturally)this.metrics.recovered++;
      await engine.startTransition({...options,automix:true,plannedPoint:plan.outPoint});
      if(engine.transition){this.metrics.scheduled++;this.state={...this.state,phase:'scheduled',countdown:Math.max(0,engine.transition.start-engine.context.currentTime)};}
    }catch(error){this.releaseHolds();this.state={phase:'error',countdown:null,error:error.message};this.onError(error);}
    finally{this.busy=false;this.preparing=null;}
  }
}
