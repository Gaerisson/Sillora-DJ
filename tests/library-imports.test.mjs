import test from 'node:test';import assert from 'node:assert/strict';import {LibraryImports} from '../public/library-imports.mjs';import {fileKey} from '../public/studio-tools.mjs';
const turn=()=>new Promise(r=>setImmediate(r)),file=name=>({name,size:10,lastModified:20,fileId:name,token:'private-token',arrayBuffer:async()=>new ArrayBuffer(1)}),audio=r=>({id:r.id,title:r.title,artist:r.artist,buffer:{duration:1,length:8,numberOfChannels:2,sampleRate:8,getChannelData:()=>new Float32Array(8)},analysisStatus:'ready'});
test('all discovered rows exist before the first decode; priority beats discovery order without parallel decodes',async()=>{
 const order=[];let release,active=0,maximum=0;const q=new LibraryImports({decode:async(f,r)=>{active++;maximum=Math.max(maximum,active);order.push(f.name);if(f.name==='A')await new Promise(done=>release=done);active--;return audio(r);}});
 const batch=q.start(['A','B','C'].map(file));assert.equal(q.rows().length,3);assert.deepEqual(order,[]);await turn();const id=q.rows().find(t=>t.title==='C').id,urgent=q.ensure(id,{priority:0});release();await urgent;await batch.promise;assert.deepEqual(order,['A','C','B']);assert.equal(maximum,1);assert.equal(q.records.size,3);
});
test('pause finishes current decode, permits explicit loading, and resumes remaining background work',async()=>{
 let release;const order=[],q=new LibraryImports({decode:async(f,r)=>{order.push(f.name);if(f.name==='A')await new Promise(done=>release=done);return audio(r);}}),batch=q.start(['A','B','C'].map(file));await turn();q.pause();release();await turn();assert.deepEqual(order,['A']);await q.ensure(q.rows().find(r=>r.title==='B').id);assert.deepEqual(order,['A','B']);assert.equal(batch.state,'paused');q.resume();await batch.promise;assert.deepEqual(order,['A','B','C']);
});
test('cancel rejects waiting work, does not publish stale native results, and can resume later',async()=>{
 let release,reads=0;const q=new LibraryImports({decode:async(f,r)=>{reads++;if(f.name==='A')await new Promise(done=>release=done);return audio(r);}}),batch=q.start(['A','B'].map(file));await turn();q.cancel();assert.equal(q.pending,false);release();assert.deepEqual(await batch.promise,[]);assert.equal(reads,1);assert.ok(q.rows().every(row=>row.libraryState!=='ready'));const result=await q.ensure(q.rows().find(r=>r.title==='B').id);assert.equal(result.title,'B');
});
test('requesting an aborted active key creates fresh work and old completion cannot erase it',async()=>{
 let release,runs=0;const q=new LibraryImports({decode:async(f,r)=>{if(++runs===1)await new Promise(done=>release=done);return audio(r);}}),batch=q.start([file('A')]);await turn();const id=q.rows()[0].id;q.cancel();const urgent=q.ensure(id);release();await batch.promise;assert.equal((await urgent).id,id);assert.equal(q.get(id).state,'ready');assert.equal(runs,2);
});
test('snapshots contain no PCM or IPC token and restart reconnects by identity without replaying completed import',async()=>{
 const q=new LibraryImports({decode:async(f,r)=>audio(r)}),files=['A','B'].map(file);await q.start(files).promise;const snapshot=q.snapshot(),json=JSON.stringify(snapshot);assert.doesNotMatch(json,/private-token|arrayBuffer|getChannelData|"buffer"/);snapshot.batch.completed=[snapshot.records[0].id];snapshot.batch.state='cancelled';const next=new LibraryImports({decode:async(f,r)=>audio(r)});next.restore(snapshot);assert.ok(next.rows().every(r=>r.libraryState==='missing'));next.bind(files.map(f=>({...f,token:'fresh-token'})));assert.equal(next.rows()[0].id,q.rows()[0].id);assert.deepEqual(next.resumeFiles().map(f=>f.name),['B']);assert.equal(next.stateFor(next.rows()[0].id),'stored');
 assert.deepEqual(next.snapshot().batch.completed,snapshot.batch.completed);assert.equal(next.snapshot().batch.state,'cancelled');
});
test('LRU eviction retains loaded decks and metadata while an evicted title can be loaded again',async()=>{
 const q=new LibraryImports({decode:async(f,r)=>audio(r)});const tracks=await q.start(['A','B','C'].map(file)).promise;const result=q.evict({pinned:new Set([tracks[0]]),budget:80});assert.equal(result.removed,2);assert.ok(tracks[0].buffer.getChannelData);assert.equal(tracks[1].buffer.duration,1);assert.equal(tracks[1].buffer.getChannelData,undefined);assert.ok((await q.ensure(tracks[1].id)).buffer.getChannelData);
});

test('decoded stems count toward cache pressure and only unpinned completed preparations can be evicted',async()=>{
 const q=new LibraryImports({decode:async(f,r)=>audio(r)}),tracks=await q.start(['A','B','C'].map(file)).promise;for(const t of tracks){t.stemBuffer={length:10,numberOfChannels:8};t.stemLevels={vocals:.4};}tracks[2].stemPreparing=true;
 const total=tracks.reduce((sum,t)=>sum+t.buffer.length*t.buffer.numberOfChannels*4+320,0);assert.equal(q.evict({pinned:new Set(tracks),budget:0}).bytes,total);
 const r=q.evict({pinned:new Set([tracks[0]]),budget:0});assert.equal(r.removed,1);assert.ok(tracks[0].stemBuffer);assert.equal(tracks[1].stemBuffer,null);assert.equal(tracks[1].stemLevels.vocals,.4);assert.ok(tracks[2].stemBuffer);assert.equal(tracks[1].buffer.getChannelData,undefined);
});
test('restoring an older catalog cannot overwrite a freshly discovered record, and native identities distinguish same-name files',()=>{
 const q=new LibraryImports({decode:async(f,r)=>audio(r)}),f=file('A'),current=q.discover([f])[0];q.restore({version:1,records:[{...current,id:'older'}]});assert.equal(q.byKey.get(fileKey(f)),current);assert.notEqual(fileKey({...f,fileId:'directory-1'}),fileKey({...f,fileId:'directory-2'}));
});

test('changing visible priorities demotes old background work without demoting an explicit load',async()=>{
 let release;const order=[],q=new LibraryImports({decode:async(f,r)=>{order.push(f.name);if(f.name==='A')await new Promise(done=>release=done);return audio(r);}}),batch=q.start(['A','B','C','D'].map(file));await turn();const ids=Object.fromEntries(q.rows().map(r=>[r.title,r.id]));q.setPriorities(new Map([[ids.B,20],[ids.C,35]]));assert.equal(q.jobs.get(ids.B).priority,20);q.setPriorities(new Map([[ids.C,20]]));assert.equal(q.jobs.get(ids.B).priority,50);const explicit=q.ensure(ids.D,{priority:0});q.setPriorities(new Map([[ids.C,20]]));assert.equal(q.jobs.get(ids.D).priority,0);release();await explicit;await batch.promise;assert.deepEqual(order,['A','D','C','B']);
});

test('content-indexed user preparation survives restart and a renamed file can recover it',async()=>{
 const q=new LibraryImports({decode:async(f,r)=>({...audio(r),contentKey:'sha256:stable-content'})}),t=await q.ensure(q.discover([file('old.mp3')])[0].id);t.hotCues=[2,10,null,null];t.manualGrid=true;t.bpm=127;t.favorite=true;q.touch(t,{user:true});const restored=new LibraryImports();restored.restore(q.snapshot());const prepared=restored.byContent.get('sha256:stable-content');assert.equal(prepared.meta.bpm,127);assert.deepEqual(prepared.meta.hotCues,[2,10,null,null]);assert.equal(prepared.meta.favorite,true);assert.ok(prepared.userUpdatedAt>0);assert.notEqual(fileKey(file('new.mp3')),fileKey(file('old.mp3')));
});
import * as identities from '../public/library-imports.mjs';

test('content preparation lookup follows the audio digest across analysis cache versions',async()=>{
 assert.equal(typeof identities.audioContentId,'function');const hash='a'.repeat(64),old='sha256:'+hash+':2:wave2:region1',current='sha256:'+hash+':2:wave2:region2';
 const q=new LibraryImports({decode:async(f,r)=>({...audio(r),contentKey:old})}),t=await q.ensure(q.discover([file('old.mp3')])[0].id);t.manualRegions=true;t.mixIn=3.41;t.mixOut=80.23;q.touch(t,{user:true});const restored=new LibraryImports();restored.restore(q.snapshot());
 const prepared=restored.byContent.get(identities.audioContentId(current));assert.equal(prepared.meta.mixIn,3.41);assert.equal(prepared.meta.manualRegions,true);assert.notEqual(identities.audioContentId(current),identities.audioContentId(current.replace(hash,'b'.repeat(64))));
});
