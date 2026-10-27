import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {createRequire} from 'node:module';
import {createStudioServer} from '../server.mjs';
import {resolveTransition,faderCurves} from '../public/transition-design.mjs';
import {musicalExit} from '../public/musical-plan.mjs';
const {FolderLibrary}=createRequire(import.meta.url)('../desktop/folder-library.cjs');
test('local server exposes no online integrations and confines content to this application',async t=>{
 const server=await createStudioServer({port:0});t.after(server.close);
 const page=await fetch(server.origin),html=await page.text();assert.equal(page.status,200);assert.doesNotMatch(html,/spotify|mixcloud|soundcloud/i);assert.match(page.headers.get('content-security-policy'),/frame-src 'none'/);
 assert.equal((await(await fetch(server.origin+'/api/health')).json()).localOnly,true);
 for(const endpoint of ['/api/spotify/status','/callback','/services.mjs','/service-hub.js','/spotify-utils.mjs'])assert.equal((await fetch(server.origin+endpoint)).status,404);
 assert.equal((await fetch(server.origin+'/app.js',{headers:{Origin:'https://foreign.example'}})).status,403);
 assert.equal((await fetch(server.origin+'/%2e%2e%2fserver.mjs')).status,403);
 assert.equal((await fetch(server.origin+'/index.html',{method:'POST'})).status,405);
});
test('folder browser filters audio, preserves navigation and rejects arbitrary paths or replaced directories',async t=>{
 const base=await fs.mkdtemp(path.join(os.tmpdir(),'sillage-folders-'));t.after(()=>fs.rm(base,{recursive:true,force:true}));const music=path.join(base,'music'),sub=path.join(music,'Album'),outside=path.join(base,'private');await fs.mkdir(sub,{recursive:true});await fs.mkdir(outside);await fs.writeFile(path.join(music,'Track.mp3'),'');await fs.writeFile(path.join(music,'secret.txt'),'');await fs.writeFile(path.join(sub,'Track.flac'),'');
 const settingsFile=path.join(base,'settings.json'),describe=async full=>({name:path.basename(full),token:full});const library=new FolderLibrary({music,settingsFile,describe});const roots=await library.init(),listing=await library.list(roots[0].token);assert.deepEqual(listing.files.map(f=>f.name),['Track.mp3']);assert.equal(listing.directories.length,1);const nested=await library.list(listing.directories[0].token);assert.equal(nested.crumbs.length,2);assert.equal(nested.files[0].name,'Track.flac');
 await assert.rejects(()=>library.list(outside),/non sélectionné/);await library.add(outside);const reload=new FolderLibrary({music,settingsFile,describe});assert.equal((await reload.init()).length,2);
 await fs.rename(sub,sub+'-old');await fs.symlink(outside,sub,'junction');await assert.rejects(()=>library.list(listing.directories[0].token),/hors de la bibliothèque/);
});
test('musical tempo changes retain the groove until a short equal-power relay',()=>{
 const source={bpm:120,buffer:{duration:150},audibleEnd:148,mixOut:142,structure:[{time:120,rms:.1},{time:136,rms:.03},{time:144,rms:.08}]},target={bpm:142,buffer:{duration:192},mixIn:1,structure:[{time:1,rms:.1},{time:8,rms:.2}]};
 const plan=resolveTransition({track:source},{track:target},{style:'auto',profile:'musical',sync:true});assert.equal(plan.style,'clean');assert.equal(plan.sync,false);assert.equal(plan.rate,1);assert.equal(plan.seconds,8);assert.equal(plan.stages.length,4);assert.ok(plan.outPoint>130&&plan.outPoint<145);
 assert.equal(musicalExit(source,8,plan.outPoint-2,plan),plan.outPoint);assert.equal(musicalExit(source,8,plan.outPoint-1,plan),plan.outPoint);
 for(const targetId of [0,1]){const curves=faderCurves(1-targetId,targetId,'clean',8);let overlap=0;for(let i=0;i<curves[0].length;i++){assert.ok(Math.abs(curves[0][i]**2+curves[1][i]**2-1)<1e-6);if(curves[0][i]*curves[1][i]>1e-6)overlap++;}assert.ok(overlap/curves[0].length*8<.08);assert.equal(curves[targetId].at(-1),1);}
});
