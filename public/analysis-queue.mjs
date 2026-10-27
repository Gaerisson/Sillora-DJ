// One analysis worker at a time. Decoding/playback are independent, and the
// next waiting job can be promoted when a deck or Automix needs it.
export class AnalysisQueue {
  constructor(){this.jobs=new Map();this.running=null;this.sequence=0;}
  enqueue(key,run,{priority=50}={}){
    if(this.jobs.has(key)){this.promote(key,priority);return this.jobs.get(key).promise;}
    let resolve,reject;
    const job={key,run,priority,sequence:this.sequence++,controller:new AbortController(),promise:new Promise((a,b)=>{resolve=a;reject=b;})};
    Object.assign(job,{resolve,reject});this.jobs.set(key,job);queueMicrotask(()=>this.drain());return job.promise;
  }
  promote(key,priority=0){
    const job=this.jobs.get(key);if(!job)return;job.priority=Math.min(job.priority,priority);
    if(this.running&&this.running!==job&&this.running.priority>job.priority){this.running.preempted=true;this.running.controller.abort();}
  }
  cancel(key){const job=this.jobs.get(key);if(!job)return;job.preempted=false;job.controller.abort();if(this.running!==job){this.jobs.delete(key);job.reject(new DOMException('Analyse annulée','AbortError'));}}
  async drain(){
    if(this.running)return;
    const job=[...this.jobs.values()].sort((a,b)=>a.priority-b.priority||a.sequence-b.sequence)[0];if(!job)return;
    this.running=job;
    try{const result=await job.run(job.controller.signal);if(!job.preempted)job.resolve(result);}catch(error){if(!job.preempted)job.reject(error);}
    finally{
      if(job.preempted){job.preempted=false;job.controller=new AbortController();job.sequence=this.sequence++;}
      else this.jobs.delete(job.key);
      this.running=null;queueMicrotask(()=>this.drain());
    }
  }
  get state(){return {active:this.running?.key??null,waiting:this.jobs.size-(this.running?1:0)};}
}
