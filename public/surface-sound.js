import './surface.js';
import {RemoteLive} from './live-remote.js';
import {LiveSettings} from './live-settings.js';
import {ProgramSettings} from './program-settings.js';
if(document.body.dataset.mode==='sound'){
 const root=document.querySelector('#surface-sound-root'),desktop=window.sillageDesktop;
 let snapshot={};const command=c=>desktop.surfaceCommand(c),adapter=new RemoteLive({snapshot:()=>snapshot,command});
 const inputs=document.createElement('div'),program=document.createElement('div');program.id='program-settings-root';root.replaceChildren(inputs,program);
 const live=new LiveSettings(adapter,inputs),master=new ProgramSettings(program,{get:()=>snapshot.program,set:value=>command({type:'program:configure',value}),panic:()=>command({type:'program:panic'}),onError:error=>{document.querySelector('#surface-status').textContent=error.message;}});
 let stopped=false,busy=false;const poll=async()=>{if(busy||stopped)return;busy=true;try{snapshot=await desktop.surfaceState()||{};adapter.changed();master.update();}catch(error){document.querySelector('#surface-status').textContent=error.message;}finally{busy=false;}};
 poll().then(()=>live.open());const timer=setInterval(poll,300);window.addEventListener('pagehide',()=>{stopped=true;clearInterval(timer);live.dispose();},{once:true});
}
