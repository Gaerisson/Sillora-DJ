// One analysis worker at a time. Decoding/playback are independent, and the
// next waiting job can be promoted when a deck or Automix needs it.
export class AnalysisQueue {
  constructor(){this.jobs=new Map();this.running=null;this.sequence=0;this.backgroundPaused=false;this.performanceBusy=false;}
  setBackgroundPaused(value){this.backgroundPaused=Boolean(value);this.restrictBackground();}
  setPerformanceBusy(value){if(this.performanceBusy===Boolean(value))return;this.performanceBusy=Boolean(value);this.restrictBackground();}
  restrictBackground(){if((this.backgroundPaused||this.performanceBusy)&&this.running?.priority>=10){this.running.preempted=true;this.running.controller.abort();}queueMicrotask(()=>this.drain());}
  setPriorities(priorities){for(const job of this.jobs.values())job.priority=Math.min(job.stickyPriority,priorities.get(job.key)??50);const next=[...this.jobs.values()].filter(j=>j!==this.running&&(!(this.backgroundPaused||this.performanceBusy)||j.priority<10)).sort((a,b)=>a.priority-b.priority)[0];if(this.running&&next&&next.priority<this.running.priority){this.running.preempted=true;this.running.controller.abort();}this.restrictBackground();}
  enqueue(key,run,{priority=50,sticky=false}={}){
    if(this.jobs.has(key)){this.promote(key,priority);return this.jobs.get(key).promise;}
    let resolve,reject;
    const job={key,run,priority,stickyPriority:sticky?priority:Infinity,sequence:this.sequence++,controller:new AbortController(),promise:new Promise((a,b)=>{resolve=a;reject=b;})};
    Object.assign(job,{resolve,reject});this.jobs.set(key,job);queueMicrotask(()=>this.drain());return job.promise;
  }
  promote(key,priority=0){
    const job=this.jobs.get(key);if(!job)return;job.priority=Math.min(job.priority,priority);
    if(this.running&&this.running!==job&&this.running.priority>job.priority){this.running.preempted=true;this.running.controller.abort();}
  }
  cancel(key){const job=this.jobs.get(key);if(!job)return;job.preempted=false;job.controller.abort();if(this.running!==job){this.jobs.delete(key);job.reject(new DOMException('Analyse annulée','AbortError'));}}
  async drain(){
    if(this.running)return;
    const job=[...this.jobs.values()].filter(j=>!(this.backgroundPaused||this.performanceBusy)||j.priority<10).sort((a,b)=>a.priority-b.priority||a.sequence-b.sequence)[0];if(!job)return;
    this.running=job;
    try{const result=await job.run(job.controller.signal);if(!job.preempted)job.resolve(result);}catch(error){if(!job.preempted)job.reject(error);}
    finally{
      if(job.preempted){job.preempted=false;job.controller=new AbortController();job.sequence=this.sequence++;}
      else this.jobs.delete(job.key);
      this.running=null;queueMicrotask(()=>this.drain());
    }
  }
  get state(){return {active:this.running?.key??null,waiting:this.jobs.size-(this.running?1:0),backgroundPaused:this.backgroundPaused,performanceBusy:this.performanceBusy};}
}
