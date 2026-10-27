import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const {RemoteHost,sanitizeCommand}=createRequire(import.meta.url)('../desktop/remote-host.cjs');
test('live state stream and artwork require pairing; updates arrive without polling and stop on revocation',async t=>{
 const host=new RemoteHost({publicDir:fileURLToPath(new URL('../public',import.meta.url)),dispatch(){}});host.publish({decks:[]});
 const status=await host.start();t.after(()=>host.stop());const link=status.links.find(l=>l.origin.includes('127.0.0.1')),headers={Authorization:'Bearer '+new URL(link.url).hash.slice(6)},controller=new AbortController();t.after(()=>controller.abort());
 for(const p of ['/api/events','/api/artwork/cover-1'])assert.equal((await fetch(link.origin+p)).status,401);
 host.storeArtwork({id:'cover-1',data:'data:image/jpeg;base64,aGVsbG8='});const art=await fetch(link.origin+'/api/artwork/cover-1',{headers});assert.equal(art.status,200);assert.equal(await art.text(),'hello');
 const response=await fetch(link.origin+'/api/events',{headers,signal:controller.signal});assert.equal(response.status,200);const reader=response.body.getReader(),decoder=new TextDecoder();let data=decoder.decode((await reader.read()).value);assert.match(data,/event: state/);assert.match(data,/"revision":1/);
 host.publish({decks:[{playing:true,duration:120,position:4,loop:{start:3,end:5}}]});data=decoder.decode((await reader.read()).value);assert.match(data,/"revision":2/);assert.match(data,/"playing":true/);assert.equal(host.events.clients.size,1);
 await host.stop();assert.equal(host.events.clients.size,0);assert.equal((await reader.read()).done,true);
});
test('sampler commands accept only bounded pads, capture duration and loaded decks; production demos are removed',()=>{
 const state={decks:[{loaded:true},{}],catalog:[],library:[],recommendations:[]};
 assert.deepEqual(sanitizeCommand({type:'sampler:capture',slot:7,deck:0,seconds:16},state),{type:'sampler:capture',slot:7,deck:0,seconds:16});
 for(const cmd of [{type:'sampler:capture',slot:1,deck:1,seconds:4},{type:'sampler:capture',slot:0,deck:0,seconds:17},{type:'sampler:trigger',slot:8},{type:'sampler:gain',slot:0,value:2},{type:'library:demos'}])assert.throws(()=>sanitizeCommand(cmd,state));
});
