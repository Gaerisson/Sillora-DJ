import {makeTransitionPlan} from './analysis.mjs';

// This timer only prepares and arms the passage. Sources and effect envelopes
// are scheduled by the engine on the audio clock, before the OUT boundary.
export class AutomixScheduler {
  constructor(engine,{enabled,prepare,options,onExhausted=()=>{},onError=()=>{},lookahead=6}={}) {
    Object.assign(this,{engine,enabled,prepare,options,onExhausted,onError,lookahead});
    this.state={phase:'off',countdown:null};this.busy=false;
    this.metrics={scheduled:0,recovered:0,late:0,preparationMs:0};
  }
  async tick() {
    if(this.busy)return;
    const engine=this.engine;
    if(!this.enabled()){this.state={phase:'off',countdown:null};return;}
    if(!engine.context)return;
    if(engine.transition){
      const t=engine.transition,wait=t.start-engine.context.currentTime;
      this.state={phase:wait>0?'scheduled':'mixing',countdown:Math.max(0,wait),style:t.style,target:t.titleB};return;
    }
    const active=engine.crossfade<.5?0:1,other=1-active,d=engine.decks[active];
    if(!d.track||d.scratching||engine.decks[other].scratching)return;
    // A pause is never an instruction to restart the set. Natural EOF carries
    // a separate flag so a delayed preparation can recover without replaying A.
    if(!d.playing&&!d.endedNaturally){this.state={phase:'paused',countdown:null};return;}
    if(d.loop){this.state={phase:'loop',countdown:null};return;}
    const track=d.track;
    this.busy=true;
    try {
      const began=performance.now(),ready=await this.prepare(active);
      this.metrics.preparationMs=performance.now()-began;
      if(!this.enabled()||engine.transition||(engine.crossfade<.5?0:1)!==active||engine.decks[active].track!==track)return;
      if((!d.playing&&!d.endedNaturally)||d.scratching||d.loop)return;
      const b=engine.decks[other];
      if(!ready||!b.track){
        this.state={phase:'waiting',countdown:null};
        if(d.endedNaturally)this.onExhausted();return;
      }
      const options=this.options(),position=engine.position(active),rate=engine.currentRate(active);
      const plan=makeTransitionPlan({...d,rate},b,{...options,position,stemsAvailable:Boolean(d.stemGains&&b.track.stemBuffer)});
      const until=(plan.outPoint-position)/Math.max(.01,rate),remaining=(d.track.buffer.duration-position)/Math.max(.01,rate);
      this.state={phase:'ready',countdown:Math.max(0,until),style:plan.style,target:b.track.title,seconds:plan.seconds};
      if(until>this.lookahead&&remaining>plan.seconds+this.lookahead)return;
      if(until<0)this.metrics.late++;
      if(d.endedNaturally)this.metrics.recovered++;
      await engine.startTransition({...options,automix:true,plannedPoint:plan.outPoint});
      if(engine.transition){this.metrics.scheduled++;this.state={...this.state,phase:'scheduled',countdown:Math.max(0,engine.transition.start-engine.context.currentTime)};}
    }catch(error){this.state={phase:'error',countdown:null,error:error.message};this.onError(error);}
    finally{this.busy=false;}
  }
}
