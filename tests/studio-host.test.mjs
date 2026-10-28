import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {createRequire} from 'node:module';
const {openStudioHost}=createRequire(import.meta.url)('../desktop/studio-host.cjs');
const version='0.10.0';
const absent=async()=>{throw new Error('No existing service');};
test('the production health version follows package metadata used by the desktop host',async t=>{
 const {createStudioServer}=await import('../server.mjs'),pkg=JSON.parse(await fs.readFile(new URL('../package.json',import.meta.url),'utf8')),server=await createStudioServer({port:0});t.after(()=>server.close());const health=await(await fetch(server.origin+'/api/health')).json();assert.equal(health.version,pkg.version);assert.equal(health.localOnly,true);assert.equal(health.application,'sillage-studio');
});
async function profile(t){const directory=await fs.mkdtemp(path.join(os.tmpdir(),'sillage-host-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));return directory;}
async function createServer({port=0,health={application:'sillage-studio',version,localOnly:true}}={}){
 const listener=http.createServer((_request,response)=>{response.setHeader('Content-Type','application/json');response.end(JSON.stringify(health));});
 await new Promise((resolve,reject)=>{listener.once('error',reject);listener.listen(port,'127.0.0.1',resolve);});
 return {origin:'http://127.0.0.1:'+listener.address().port,close:()=>new Promise((resolve,reject)=>{listener.closeAllConnections();listener.close(error=>error?reject(error):resolve());})};
}

test('an ephemeral first launch persists its actual port and the next launch preserves the origin',async t=>{
 const directory=await profile(t),first=await openStudioHost({profile:directory,version,createStudioServer:createServer,candidates:[0]});
 const port=Number(new URL(first.origin).port);assert.ok(port>0);assert.deepEqual(JSON.parse(await fs.readFile(path.join(directory,'studio-port.json'),'utf8')),{port});
 await first.server.close();
 const requested=[],second=await openStudioHost({profile:directory,version,candidates:[0],createStudioServer:async options=>{requested.push(options.port);return createServer(options);}});t.after(()=>second.server.close());
 assert.equal(second.origin,first.origin);assert.deepEqual(requested,[port]);
});

test('a matching running local studio is reused and its preferred origin remains stable',async t=>{
 const directory=await profile(t),running=await createServer(),legacy=await createServer();t.after(()=>running.close());t.after(()=>legacy.close());const port=Number(new URL(running.origin).port);
 await fs.writeFile(path.join(directory,'studio-port.json'),JSON.stringify({port}));let calls=0;
 await fs.writeFile(path.join(directory,'desktop-status.json'),JSON.stringify({origin:legacy.origin}));
 const host=await openStudioHost({profile:directory,version,candidates:[0],createStudioServer:async()=>{calls++;throw new Error('Must not create');}});
 assert.equal(host.server,null);assert.equal(host.origin,running.origin);assert.equal(calls,0);
});

test('legacy desktop status preserves the existing localStorage origin and migrates the port',async t=>{
 const directory=await profile(t),running=await createServer();t.after(()=>running.close());
 await fs.writeFile(path.join(directory,'desktop-status.json'),JSON.stringify({origin:running.origin}));
 const host=await openStudioHost({profile:directory,version,candidates:[0],createStudioServer:createServer});
 assert.equal(host.origin,running.origin);assert.equal(host.server,null);assert.equal(JSON.parse(await fs.readFile(path.join(directory,'studio-port.json'),'utf8')).port,Number(new URL(running.origin).port));
});

test('foreign, remote-enabled, or obsolete services are never reused or terminated',async t=>{
 const directory=await profile(t);
 for(const health of [{application:'other',version,localOnly:true},{application:'sillage-studio',version,localOnly:false},{application:'sillage-studio',version:'0.9.0',localOnly:true}]){
  const foreign=await createServer({health}),port=Number(new URL(foreign.origin).port);await fs.writeFile(path.join(directory,'studio-port.json'),JSON.stringify({port}));
  const host=await openStudioHost({profile:directory,version,candidates:[0],createStudioServer:createServer});
  assert.notEqual(host.origin,foreign.origin);assert.ok(host.server);assert.deepEqual(await(await fetch(foreign.origin+'/api/health')).json(),health);
  await host.server.close();await foreign.close();
 }
});

test('malformed stored data and non-loopback legacy origins are ignored',async t=>{
 const directory=await profile(t);
 for(const [preferred,legacy] of [['{broken','{broken'],[JSON.stringify({port:99999}),JSON.stringify({origin:'https://127.0.0.1:443'})],[JSON.stringify({port:'44001'}),JSON.stringify({origin:'http://example.com:44002'})],[JSON.stringify({port:-1}),JSON.stringify({origin:'http://127.0.0.1:44003/path'})]]){
  await fs.writeFile(path.join(directory,'studio-port.json'),preferred);await fs.writeFile(path.join(directory,'desktop-status.json'),legacy);
  const requested=[];const host=await openStudioHost({profile:directory,version,fetcher:absent,candidates:[44004],createStudioServer:async({port})=>{requested.push(port);return {origin:'http://127.0.0.1:'+port,close(){}};}});
  assert.equal(host.origin,'http://127.0.0.1:44004');assert.deepEqual(requested,[44004]);
 }
});

test('only address-in-use skips a candidate; other startup errors propagate',async t=>{
 const directory=await profile(t),requested=[];
 const host=await openStudioHost({profile:directory,version,fetcher:absent,candidates:[44005,44006],createStudioServer:async({port})=>{requested.push(port);if(port===44005)throw Object.assign(new Error('busy'),{code:'EADDRINUSE'});return {origin:'http://127.0.0.1:'+port,close(){}};}});
 assert.equal(host.origin,'http://127.0.0.1:44006');assert.deepEqual(requested,[44005,44006]);
 const denied=Object.assign(new Error('denied'),{code:'EACCES'});
 await assert.rejects(openStudioHost({profile:directory,version,fetcher:absent,candidates:[44007],createStudioServer:async()=>{throw denied;}}),error=>error===denied);
});
