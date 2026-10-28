import test from 'node:test';
import assert from 'node:assert/strict';
import {AnalysisQueue} from '../public/analysis-queue.mjs';
import {contentAnalysisKey} from '../public/analysis-cache.mjs';
import {REGION_ANALYSIS_VERSION} from '../public/analysis.mjs';
const turn=()=>new Promise(resolve=>setImmediate(resolve));

test('content cache identity invalidates pre-arrangement region baselines',async()=>{const key=await contentAnalysisKey(new Uint8Array([7,4,2]));assert.ok(key.endsWith(':region'+REGION_ANALYSIS_VERSION));assert.equal(REGION_ANALYSIS_VERSION,2);});

test('background suspension preempts a worker but preserves a foreground request and resumes the old job',async()=>{
 const q=new AnalysisQueue(),order=[];let count=0;const old=q.enqueue('background',signal=>{order.push('background');if(++count===1)return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('pause','AbortError'))));return 1;});await turn();q.setBackgroundPaused(true);await turn();assert.equal(q.running,null);const front=q.enqueue('play',()=>{order.push('play');return 2;},{priority:0});assert.equal(await front,2);q.setBackgroundPaused(false);assert.equal(await old,1);assert.deepEqual(order,['background','play','background']);
});

test('updated priorities demote obsolete background requests but keep explicit reanalysis ahead of folder scans',async()=>{
 const q=new AnalysisQueue();q.setBackgroundPaused(true);const order=[],first=q.enqueue('old',()=>{order.push('old');return 1;},{priority:20}),manual=q.enqueue('manual',()=>{order.push('manual');return 2;},{priority:20,sticky:true}),folder=q.enqueue('folder',()=>{order.push('folder');return 3;},{priority:35});q.setPriorities(new Map([['folder',35]]));assert.equal(q.jobs.get('old').priority,50);assert.equal(q.jobs.get('manual').priority,20);q.setBackgroundPaused(false);await Promise.all([first,manual,folder]);assert.deepEqual(order,['manual','folder','old']);
});

test('queued analysis priorities are independent from discovery order and deduplicate a request',async()=>{
 const queue=new AnalysisQueue(),order=[];
 const a=queue.enqueue('background',()=>{order.push('background');return 1;});
 const b=queue.enqueue('next',()=>{order.push('next');return 2;},{priority:5});
 const same=queue.enqueue('next',()=>{throw Error('duplicate');});assert.equal(b,same);
 assert.deepEqual(await Promise.all([a,b]),[1,2]);assert.deepEqual(order,['next','background']);await turn();assert.equal(queue.state.waiting,0);
});
test('a newly loaded deck preempts a low priority analysis and the interrupted job resumes',async()=>{
 const queue=new AnalysisQueue(),order=[];let count=0;
 const a=queue.enqueue('background',signal=>{order.push('background');if(++count===1)return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('cancelled','AbortError'))));return 1;});
 await turn();const b=queue.enqueue('deck',()=>{order.push('deck');return 2;},{priority:10});queue.promote('deck',0);
 assert.deepEqual(await Promise.all([a,b]),[1,2]);assert.deepEqual(order,['background','deck','background']);
});
test('cancelling a waiting analysis leaves playback and other analyses available',async()=>{
 const queue=new AnalysisQueue();let done;
 const a=queue.enqueue('active',()=>new Promise(resolve=>{done=resolve;}));await turn();
 const b=queue.enqueue('cancelled',()=>{throw Error('must not run');});const rejected=assert.rejects(b,{name:'AbortError'});queue.cancel('cancelled');await rejected;done('ok');assert.equal(await a,'ok');
 assert.equal(await queue.enqueue('later',()=>3),3);
});
test('persistent keys distinguish changed content and reuse renamed identical files',async()=>{
 const original=new Uint8Array([1,2,3,4]),modified=new Uint8Array([1,2,3,5]);
 const first=await contentAnalysisKey(original);assert.match(first,/^sha256:[a-f0-9]{64}:/);assert.equal(first,await contentAnalysisKey(original.slice()));assert.notEqual(first,await contentAnalysisKey(modified));
});
