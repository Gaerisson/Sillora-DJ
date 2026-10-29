// Decoding may be shared with the library. Invalidation cancels this consumer,
// never another consumer's job, and a late result cannot commit to a deck.
export class NextPreparation{
 constructor({select,ensure,isCurrent,commit,reject=()=>{},release=()=>{},onState=()=>{},onSkip=()=>{},maxAttempts=32}={}){Object.assign(this,{select,ensure,isCurrent,commit,reject,release,onState,onSkip,maxAttempts});this.failed=new Map();this.state={phase:'idle',title:'',skipped:0};this.generation=0;this.job=null;}
 get busy(){return Boolean(this.job);}
 setState(phase,title=''){this.state={phase,title,skipped:this.failed.size};this.onState(this.state);}
 invalidate({clearFailures=false}={}){this.generation++;const job=this.job;this.job=null;job?.cancel();if(clearFailures)this.failed.clear();this.setState('idle');}
 prepare(context){
  if(this.job)return this.job.promise;
  const generation=this.generation,job={};let cancel;const cancelled=new Promise(resolve=>{cancel=()=>resolve(false);});job.cancel=cancel;this.job=job;
  const valid=()=>this.job===job&&generation===this.generation&&this.isCurrent(context);
  const work=(async()=>{
   for(let attempt=0;attempt<this.maxAttempts&&valid();attempt++){
    const candidate=this.select(context,this.failed);if(!candidate){this.setState('empty');return false;}
    if(this.failed.has(candidate.id))return false;
    this.setState('loading',candidate.title||'');
    let track;
    try{track=await this.ensure(candidate,context);if(!track?.buffer?.getChannelData)throw Error('Audio indisponible.');}
    catch(error){if(!valid())return false;if(error.name==='AbortError'){this.setState('idle');return false;}this.failed.set(candidate.id,String(error.message||'Audio indisponible.').slice(0,220));this.reject(candidate,context);this.onSkip(candidate,error);continue;}
    if(!valid())return false;
    this.commit(track,context);this.setState('ready',track.title||'');return true;
   }
   if(valid())this.setState('waiting');return false;
  })();
  job.promise=Promise.race([work,cancelled]).finally(()=>{this.release(context);if(this.job===job){this.job=null;this.onState(this.state);}});return job.promise;
 }
}
