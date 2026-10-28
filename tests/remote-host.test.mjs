import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';import os from 'node:os';import http from 'node:http';
const {RemoteHost,sanitizeState,sanitizeCommand,privateIPv4}=createRequire(import.meta.url)('../desktop/remote-host.cjs');
const publicDir=fileURLToPath(new URL('../public',import.meta.url));
const snapshot=()=>({decks:[{loaded:true,title:'Titre A',artist:'Artiste A',playing:true,duration:180,position:30},{loaded:true,title:'Titre B',duration:200}],master:.7,crossfader:.2,automix:{enabled:true,mode:'compatible',scopeName:'Musique',remaining:2},library:[{id:'track-1',title:'Titre A',bpm:120,key:'Am · 8A',duration:180},{id:'track-2',title:'Titre B',bpm:122,key:'C · 8B',duration:200}],recommendations:[{id:'track-2',title:'Titre B',reason:'Tonalité relative'}]});

test('Remote preserves bounded grid evidence and serves its shared interpretation',async t=>{
 const raw=snapshot();raw.decks[0].grid={mode:'auto',confidence:.81,coverage:.35,observations:161,jitterMs:12,path:'private'};const state=sanitizeState(raw);assert.deepEqual(state.decks[0].grid,{mode:'auto',confidence:.81,coverage:.35,observations:161,jitterMs:12});
 raw.decks[0].grid={mode:'wrong',confidence:Infinity,coverage:NaN,observations:-2,jitterMs:NaN};assert.equal(sanitizeState(raw).decks[0].grid,null);const f=await fixture(t);assert.equal((await fetch(f.origin+'/grid-status.mjs')).status,200);
});

test('remote arrangement landmarks are bounded, sorted and stripped of private fields',()=>{
 const raw=snapshot();raw.decks[0].arrangement={version:1,landmarks:[{time:40,confidence:.9,kind:'lift',path:'private'},{time:-1,confidence:1,kind:'release'},{time:180,confidence:1,kind:'release'},{time:NaN,confidence:1,kind:'change'},{time:20,confidence:.3,kind:'change'},{time:24,confidence:.8,kind:'change'},...Array.from({length:300},()=>({time:40,confidence:.9,kind:'lift'}))]};
 const r=sanitizeState(raw).decks[0].arrangement;assert.equal(r.version,1);assert.deepEqual(r.landmarks,[{time:24,confidence:.8,kind:'change'},{time:40,confidence:.9,kind:'lift'}]);assert.equal(JSON.stringify(r).includes('private'),false);
});
async function fixture(t,options={}){
 let host;host=new RemoteHost({publicDir,dispatch:message=>queueMicrotask(()=>host.acknowledge({id:message.id,ok:true})),...options});host.publish(snapshot());const status=await host.start();t.after(()=>host.stop());
 const link=status.links.find(item=>item.origin.includes('127.0.0.1')),origin=link.origin,token=new URLSearchParams(new URL(link.url).hash.slice(1)).get('pair'),headers={Authorization:'Bearer '+token};
 return {host,status,origin,token,headers,get:()=>fetch(origin+'/api/state',{headers}),post:(command,revision=host.revision,extra={})=>fetch(origin+'/api/command',{method:'POST',headers:{...headers,'Content-Type':'application/json',...extra},body:JSON.stringify({command,revision})})};
}

test('shared stereo meter modules are available to the paired remote interface',async t=>{
 const f=await fixture(t);for(const asset of ['/audio-meter-view.js','/audio-meters.mjs','/audio-meter.css']){const response=await fetch(f.origin+asset);assert.equal(response.status,200,asset);assert.ok((await response.text()).length>500);}
});

test('the remote waveform serves its entire static module dependency graph',async t=>{
 const f=await fixture(t),pending=['/dj-waveform.mjs','/keylock-settings.js'],seen=new Set();
 while(pending.length){const asset=pending.shift();if(seen.has(asset))continue;seen.add(asset);const response=await fetch(f.origin+asset);assert.equal(response.status,200,asset);const source=await response.text();for(const match of source.matchAll(/(?:from\s*|import\s*)['"](\.\.?\/[^'"]+)['"]/g)){const dependency=new URL(match[1],f.origin+asset).pathname;if(!seen.has(dependency))pending.push(dependency);}}
 assert.ok(seen.has('/transition-score.mjs'));assert.ok(seen.has('/tempo-automation.mjs'));assert.ok(seen.has('/audio-math.mjs'));
});

test('remote key-lock profile settings retain measured latency and reject invalid or busy commands',()=>{
 const state=sanitizeState({...snapshot(),keyLockProfile:'rhythm',keyLockLatencyMs:59.4,keyLockProfileBusy:false});assert.equal(state.keyLockProfile,'rhythm');assert.equal(state.keyLockLatencyMs,59.4);
 assert.deepEqual(sanitizeCommand({type:'mixer:keyLockProfile',value:'standard'},state),{type:'mixer:keyLockProfile',value:'standard'});
 assert.throws(()=>sanitizeCommand({type:'mixer:keyLockProfile',value:'__proto__'},state));
 assert.throws(()=>sanitizeCommand({type:'mixer:keyLockProfile',value:'rhythm'},{...state,keyLockProfileBusy:true}));
 assert.equal(sanitizeState({...snapshot(),keyLockLatencyMs:NaN}).keyLockLatencyMs,null);
});

test('state is explicitly filtered, bounded and excludes audio, local paths and credentials',()=>{
 assert.equal(sanitizeState(null).decks.length,2);
 const raw=snapshot();Object.assign(raw,{token:'private-pair-secret',path:'C:\\Users\\Name\\Music',audio:new Uint8Array(1000)});raw.decks[0].buffer={secret:'audio'};raw.decks[0].title='C:\\Users\\Name\\Music\\song.mp3';raw.library=Array.from({length:400},(_,i)=>({id:'track-'+i,title:'x'.repeat(300),path:'C:\\private',token:'audio-token',duration:Infinity}));raw.recommendations.push({id:'foreign',title:'outside collection'});
 const state=sanitizeState(raw),serialized=JSON.stringify(state);assert.equal(state.library.length,250);assert.equal(state.library[0].title.length,120);assert.equal(state.decks[0].title,'');assert.equal(state.library[0].duration,0);assert.equal(state.audio.armed,false);assert.equal(Object.hasOwn(state.audio,'0'),false);assert.equal(/private-pair-secret|C:|audio-token|"buffer"|"path"|"token"/.test(serialized),false);
});

test('on-demand separate host requires bearer pairing and serves only remote assets',async t=>{
 const f=await fixture(t);assert.equal(f.host.server.address().address,'0.0.0.0');assert.ok(f.token.length===43);assert.equal(new URL(f.status.links[0].url).search,'');
 assert.equal((await fetch(f.origin+'/api/state')).status,401);assert.equal((await fetch(f.origin+'/api/state',{headers:{Authorization:'Bearer invalid'}})).status,401);
 const response=await f.get(),state=await response.json();assert.equal(response.status,200);assert.equal(state.fresh,true);assert.equal(state.decks[0].title,'Titre A');assert.equal(Object.hasOwn(state,'token'),false);
 for(const file of ['/','/remote.js','/remote.css'])assert.equal((await fetch(f.origin+file)).status,200);
 const icon=await fetch(f.origin+'/icon.svg');assert.equal(icon.status,200);assert.equal(icon.headers.get('content-type'),'image/svg+xml');assert.match(await icon.text(),/<svg/);
 for(const file of ['/app.js','/server.mjs','/desktop/main.cjs','/audio.mp3','/api/health'])assert.equal((await fetch(f.origin+file,{headers:f.headers})).status,404);
 assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.equal(response.headers.get('referrer-policy'),'no-referrer');
});

test('Host and Origin validation rejects DNS aliases and foreign browser requests',async t=>{
 const f=await fixture(t);
 const foreignHostStatus=await new Promise((resolve,reject)=>{const request=http.get(f.origin+'/api/state',{headers:{...f.headers,Host:'evil.example:'+f.status.port}},response=>{response.resume();resolve(response.statusCode);});request.on('error',reject);});assert.equal(foreignHostStatus,403);
 assert.equal((await f.post({type:'automix:toggle'},f.host.revision,{Origin:'https://evil.example'})).status,403);
 assert.equal((await fetch(f.origin+'/remote.js',{headers:{Origin:'https://evil.example'}})).status,403);
 assert.equal((await f.post({type:'automix:mode',mode:'shuffle'},f.host.revision,{Origin:f.origin})).status,200);
 assert.equal((await fetch(f.origin+'/api/command',{method:'POST',headers:{...f.headers,'Content-Type':'application/json'},body:'null'})).status,400);
});

test('commands use a strict allowlist, known track IDs and matching renderer acknowledgments',async t=>{
 const received=[];let host;const f=await fixture(t,{dispatch:message=>{received.push(message);queueMicrotask(()=>host.acknowledge({id:message.id,ok:true}));}});host=f.host;
 for(const command of [{type:'deck:toggle',deck:0},{type:'deck:cue',deck:1},{type:'deck:volume',deck:0,value:.4},{type:'mixer:crossfader',value:.5},{type:'mixer:master',value:.8},{type:'automix:toggle'},{type:'automix:next'},{type:'automix:mode',mode:'order'},{type:'transition:start'},{type:'library:load',trackId:'track-1',deck:1},{type:'recommendation:load',trackId:'track-2',deck:0}])assert.equal((await f.post(command)).status,200);
 assert.equal(received.length,11);assert.equal(host.acknowledge({id:'unrelated',ok:true}),false);
 for(const command of [{type:'shell:execute',path:'C:\\x'},{type:'mixer:master',value:1.5},{type:'deck:play',deck:2},{type:'automix:mode',mode:'external'},{type:'library:load',trackId:'outside',deck:0},{type:'recommendation:load',trackId:'track-1',deck:0}])assert.equal((await f.post(command)).status,400);
 assert.equal(received.length,11);assert.deepEqual(sanitizeCommand({type:'mixer:master',value:.2,path:'do not forward'},snapshot()),{type:'mixer:master',value:.2});
});

test('stale renderer state and stale client revisions suspend commands until refreshed',async t=>{
 let now=10000;const f=await fixture(t,{now:()=>now});const oldRevision=f.host.revision;now+=3000;
 assert.equal((await(await f.get()).json()).fresh,false);assert.equal((await f.post({type:'automix:toggle'})).status,409);
 f.host.publish(snapshot());assert.equal((await f.post({type:'automix:toggle'},oldRevision)).status,409);assert.equal((await f.post({type:'automix:toggle'})).status,200);
});

test('missing or rejected acknowledgments return clear errors and late acknowledgments are ignored',async t=>{
 let message;const f=await fixture(t,{commandTimeout:35,dispatch:value=>{message=value;}});
 assert.equal((await f.post({type:'automix:toggle'})).status,504);assert.equal(f.host.pending.size,0);assert.equal(f.host.acknowledge({id:message.id,ok:true}),false);
 f.host.dispatch=value=>queueMicrotask(()=>f.host.acknowledge({id:value.id,ok:false,error:'Chargez le prochain titre.'}));const response=await f.post({type:'transition:start'});assert.equal(response.status,409);assert.match((await response.json()).error,/Chargez/);
});

test('stopping closes the listener, rejects pending work and revokes the old pairing on restart',async t=>{
 const f=await fixture(t,{dispatch:()=>{}}),oldToken=f.token;
 const pending=assert.rejects(f.host.run({type:'automix:toggle'},f.host.revision),/arrêtée/);await f.host.stop();await pending;assert.equal(f.host.status().active,false);assert.equal(f.host.pending.size,0);
 await assert.rejects(fetch(f.origin+'/api/state',{headers:f.headers}));
 const restarted=await f.host.start(),link=restarted.links.find(item=>item.origin.includes('127.0.0.1')),freshToken=new URLSearchParams(new URL(link.url).hash.slice(1)).get('pair');assert.ok(freshToken!==oldToken);
 assert.equal((await fetch(link.origin+'/api/state',{headers:f.headers})).status,401);assert.equal((await fetch(link.origin+'/api/state',{headers:{Authorization:'Bearer '+freshToken}})).status,200);
});

test('a local LAN interface can reach the distinct remote listener without exposing the studio',async t=>{
 const interfaces=os.networkInterfaces(),address=Object.values(interfaces).flat().find(item=>item.family==='IPv4'&&!item.internal&&privateIPv4(item.address))?.address;
 if(!address){t.skip('No local IPv4 LAN interface available');return;}
 const f=await fixture(t),origin='http://'+address+':'+f.status.port;const response=await fetch(origin+'/api/state',{headers:f.headers,signal:AbortSignal.timeout(2000)});assert.equal(response.status,200);assert.equal((await response.json()).fresh,true);
 for(const address of ['127.0.0.1','10.1.2.3','192.168.1.5','172.16.0.1','172.31.0.1','::ffff:192.168.1.2'])assert.equal(privateIPv4(address),true);
 for(const address of ['8.8.8.8','172.15.0.1','172.32.0.1','1.2.3.4','999.1.2.3','::1'])assert.equal(privateIPv4(address),false);
});
