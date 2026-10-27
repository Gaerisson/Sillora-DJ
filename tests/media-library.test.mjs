import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {createHash} from 'node:crypto';

const require=createRequire(import.meta.url),{MediaLibrary,artworkURL,artworkQuery}=require('../desktop/media-library.cjs'),{DownloadService,youtubeURL,soundcloudURL,mediaURL,soundcloudFormat,filename,MAX_BYTES,MAX_DURATION}=require('../desktop/download-service.cjs');
const VIDEO='BaW_jenozKc';
const RELEASE='76df3287-6cda-33eb-8e9a-044b5e15ffdd';
const jpeg=Buffer.from([255,216,255,192,0,17,8,0,100,0,100,3,1,17,0,2,17,0,3,17,0,255,217]);
const image={isEmpty:()=>false,resize(){return this;},toJPEG:()=>jpeg},nativeImage={createFromBuffer:()=>image};
async function sandbox(t){const folder=await mkdtemp(path.join(tmpdir(),'gaerisson-media-'));t.after(()=>rm(folder,{recursive:true,force:true}));return folder;}
async function serviceFixture(t,{duration=120,failure=false}={}){
 const root=await sandbox(t),music=path.join(root,'Music'),profileDir=path.join(root,'profile'),vendorDir=path.join(root,'vendor');await mkdir(music);await mkdir(vendorDir);await writeFile(path.join(vendorDir,'yt-dlp.exe'),'test');await writeFile(path.join(vendorDir,'node.exe'),'test');
 const calls=[],events=[];
 const service=new DownloadService({music,profileDir,vendorDir,describe:async file=>({token:'registered-track-token',name:path.basename(file),metadata:{}}),onEvent:event=>events.push(event),spawnProcess:(executable,args,options)=>{
  calls.push({executable,args,options});const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>{setImmediate(()=>child.emit('close',1));return true;};
  setImmediate(async()=>{if(args.includes('--dump-single-json'))child.stdout.write(JSON.stringify({id:VIDEO,title:'A real title',artist:'An artist',duration}));else{const output=args[args.indexOf('--output')+1].replace('%(id)s',VIDEO).replace('%(ext)s','m4a');await writeFile(output,Buffer.from('real audio fixture'));child.stdout.write('SILLAGE_PROGRESS:'+JSON.stringify({downloaded_bytes:18,total_bytes:18,speed:9,eta:1})+'\n');}if(failure)child.stderr.write('ERROR: Sign in to confirm your age');child.emit('close',failure?1:0);});return child;
 }});await service.init();return{root,music,profileDir,vendorDir,service,calls,events};
}

test('YouTube input is canonicalized to one video and rejects arbitrary hosts, commands, credentials and playlists',()=>{
 for(const url of ['https://www.youtube.com/watch?v='+VIDEO+'&list=playlist','https://youtu.be/'+VIDEO+'?si=tracking','https://music.youtube.com/watch?v='+VIDEO,'https://youtube.com/shorts/'+VIDEO])assert.deepEqual(youtubeURL(url),{id:VIDEO,url:'https://www.youtube.com/watch?v='+VIDEO});
 for(const url of ['http://youtube.com/watch?v='+VIDEO,'https://evil.test/watch?v='+VIDEO,'https://youtube.com.evil.test/watch?v='+VIDEO,'https://youtube.com@evil.test/watch?v='+VIDEO,'https://user:secret@youtube.com/watch?v='+VIDEO,'https://youtube.com:444/watch?v='+VIDEO,'https://youtube.com/playlist?list=abc','https://youtu.be/../../local','--exec calc.exe','https://youtu.be/'+VIDEO+'#fragment'])assert.throws(()=>youtubeURL(url),undefined,url);
 assert.equal(filename('CON'),'YouTube');assert.equal(filename('../../evil|name.mp3'),'.. .. evil name.mp3');
});

test('download runs the bundled tool without a shell and imports one bounded audio file under Music',async t=>{
 const {service,calls,events,profileDir,vendorDir}=await serviceFixture(t);const job=await service.start({url:'https://youtu.be/'+VIDEO});await service.active.promise;const result=service.get(job.id);
 assert.equal(result.status,'completed');assert.equal(result.descriptor.token,'registered-track-token');assert.equal(result.descriptor.metadata.title,'A real title');assert.equal(result.descriptor.metadata.sourceURL,'https://www.youtube.com/watch?v='+VIDEO);assert.equal(result.progress,1);assert.equal(Object.hasOwn(result,'url'),false);assert.equal(Object.hasOwn(result,'path'),false);
 const files=await readdir(service.youtubeFolder);assert.equal(files.length,1);assert.match(files[0],/An artist - A real title \[BaW_jenozKc\]\.m4a$/);assert.equal((await readFile(path.join(service.youtubeFolder,files[0]))).toString(),'real audio fixture');
 assert.equal(calls.length,2);for(const call of calls){assert.equal(call.executable,path.join(vendorDir,'yt-dlp.exe'));assert.equal(call.options.shell,false);assert.equal(call.options.windowsHide,true);assert.ok(call.args.includes('--ignore-config'));assert.ok(call.args.includes('--no-playlist'));assert.ok(call.args.includes('node:'+path.join(vendorDir,'node.exe')));assert.ok(!call.args.includes('--cookies-from-browser'));assert.ok(!call.args.includes('--extract-audio'));assert.equal(call.args.at(-1),'https://www.youtube.com/watch?v='+VIDEO);}
 assert.ok(events.some(event=>event.status==='downloading'));assert.ok(events.some(event=>event.bytes===18));assert.equal((await readdir(path.join(profileDir,'youtube-staging'))).length,0);
 const loaded=new DownloadService({music:service.music,profileDir,vendorDir});await loaded.init();assert.equal(loaded.metadataForFile(path.join(service.youtubeFolder,files[0])).artist,'An artist');
});

test('existing music is preserved and subsequent downloads receive a unique filename',async t=>{
 const {service}=await serviceFixture(t),first=await service.start({url:'https://youtu.be/'+VIDEO});await service.active.promise;const file=path.join(service.youtubeFolder,(await readdir(service.youtubeFolder))[0]);await writeFile(file,'user music');await service.start({url:'https://youtu.be/'+VIDEO});await service.active.promise;
 assert.equal((await readFile(file)).toString(),'user music');assert.equal((await readdir(service.youtubeFolder)).length,2);assert.equal(service.get(first.id).status,'completed');
});

test('overlong or restricted videos fail before saving and expose a useful non-sensitive error',async t=>{
 for(const options of [{duration:MAX_DURATION+1},{failure:true}]){const {service,calls}=await serviceFixture(t,options),job=await service.start({url:'https://youtu.be/'+VIDEO});await service.active.promise;const result=service.get(job.id);assert.equal(result.status,'error');assert.equal(calls.length,1);assert.equal((await readdir(service.youtubeFolder)).length,0);assert.match(result.message,options.failure?/privée|protégée/:/30 minutes/);assert.doesNotMatch(result.message,/secret|https?:\/\//);}
 assert.equal(MAX_BYTES,250*1024*1024);
});

test('cancellation kills the owned downloader and never publishes a file',async t=>{
 const {service}=await serviceFixture(t);let killed=0,markStarted;const started=new Promise(resolve=>markStarted=resolve);service.spawnProcess=()=>{const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>{killed++;setImmediate(()=>child.emit('close',1));};markStarted();return child;};const job=await service.start({url:'https://youtu.be/'+VIDEO});await started;const pending=service.active.promise;assert.equal((await service.cancel(job.id)).status,'cancelled');await pending;assert.equal(killed,1);assert.equal(service.get(job.id).status,'cancelled');assert.equal((await readdir(service.youtubeFolder)).length,0);
});

test('download destination rejects an existing directory junction outside Music',async t=>{
 const root=await sandbox(t),music=path.join(root,'Music'),outside=path.join(root,'outside');await mkdir(path.join(music,'Gaerisson DJ Studio'),{recursive:true});await mkdir(outside);await writeFile(path.join(outside,'sentinel.mp3'),'existing user music');await symlink(outside,path.join(music,'Gaerisson DJ Studio','YouTube'),'junction');
 const service=new DownloadService({music,profileDir:path.join(root,'profile')});await assert.rejects(service.init(),/dossier de téléchargement/);assert.equal((await readFile(path.join(outside,'sentinel.mp3'))).toString(),'existing user music');
});

test('artwork search issues opaque candidates and bounds image retrieval to the public artwork service',async t=>{
 const root=await sandbox(t),calls=[];const network={json:async(url,options)=>{calls.push({url,options});return{recordings:[{title:'A song','artist-credit':[{name:'An artist'}],releases:[{id:RELEASE,title:'An album'},{id:'https://localhost/private',title:'Unsafe'}]}]};},read:async(url,options)=>{calls.push({url,options});return{buffer:jpeg};}};
 const library=new MediaLibrary({profileDir:root,nativeImage,network}),query={title:'A song',artist:'An artist',album:''},result=await library.searchArtwork(query);assert.equal(result.candidates.length,1);assert.equal(Object.hasOwn(result.candidates[0],'url'),false);assert.equal(Object.hasOwn(result.candidates[0],'imageURL'),false);const artwork=await library.fetchArtwork(result.candidates[0].id);assert.match(artwork.cover,/^data:image\/jpeg;base64,/);assert.equal(calls[1].options.maxBytes,1024*1024);assert.match(calls[1].url,/coverartarchive\.org\/release\/.+\/front-500$/);
 await assert.rejects(library.fetchArtwork('https://localhost/file'),/expiré/);const found=await library.lookupArtwork(query);assert.equal(found.status,'found');const before=calls.length;assert.equal((await library.lookupArtwork(query)).status,'cached');assert.equal(calls.length,before);assert.equal((await library.searchArtwork(query)).candidates[0].id,result.candidates[0].id);
 const restored=new MediaLibrary({profileDir:root,nativeImage,network:{json(){throw new Error('Network must not run');}}});assert.equal((await restored.lookupArtwork(query)).status,'cached');
});

test('automatic artwork does not apply a mismatched first result and surfaces network failure',async t=>{
 const root=await sandbox(t),library=new MediaLibrary({profileDir:root,nativeImage,network:{json:async()=>({recordings:[{title:'Totally different','artist-credit':[{name:'Another person'}],releases:[{id:RELEASE,title:'Another album'}]}]})}});assert.equal((await library.lookupArtwork({title:'My requested title',artist:'My artist'})).status,'not-found');
 let calls=0;library.network.json=async()=>{calls++;throw new Error('Connection offline');};await assert.rejects(library.searchArtwork({title:'A new query'}),/offline/);await assert.rejects(library.searchArtwork({title:'A new query'}),/offline/);assert.equal(calls,1);assert.throws(()=>artworkURL('http://coverartarchive.org/release/'+RELEASE+'/front-500'));assert.throws(()=>artworkURL('https://coverartarchive.org.evil.test/release/'+RELEASE+'/front-500'));assert.throws(()=>artworkQuery({title:{toString:()=>''}}));
});

test('automatic artwork accepts the exact main artist when a recording credits a featured guest',async t=>{
 const root=await sandbox(t),library=new MediaLibrary({profileDir:root,nativeImage,network:{json:async()=>({recordings:[{title:'Love Letter','artist-credit':[{name:'ODESZA'},{name:'The Knocks'}],releases:[{id:RELEASE,title:'Love Letter'}]}]}),read:async()=>({buffer:jpeg})}});
 const result=await library.lookupArtwork({title:'Love Letter (feat. The Knocks) - Official Audio',artist:'ODESZA'});assert.equal(result.status,'found');assert.equal(result.artist,'ODESZA, The Knocks');assert.match(result.cover,/^data:image\/jpeg;base64,/);
});

test('SoundCloud accepts one public track and rejects secret links, playlists, embeds and premium previews',()=>{
 assert.equal(soundcloudURL('https://www.soundcloud.com/an-artist/a-track?utm_source=clipboard').url,'https://soundcloud.com/an-artist/a-track');assert.equal(mediaURL('https://soundcloud.com/an-artist/a-track').provider,'soundcloud');
 for(const url of ['https://soundcloud.com/an-artist/sets/playlist','https://soundcloud.com/an-artist/a-track/s-private','https://soundcloud.com/an-artist/a-track?secret_token=s-private','https://w.soundcloud.com/player/?url=secret','https://soundcloud.com/discover/sets','https://soundcloud.com/an-artist','https://soundcloud.com.evil.test/artist/track'])assert.throws(()=>soundcloudURL(url));
 const format=(id,note='',extra={})=>({format_id:id,format_note:note,vcodec:'none',protocol:'http',ext:'mp3',abr:128,...extra});
 assert.equal(soundcloudFormat({formats:[format('http_mp3_preview'),format('http_aac_hq','Premium'),format('http_mp3_public')]}),'http_mp3_public');
 for(const formats of [[format('preview_30sec')],[format('hq','Premium')],[format('public','',{has_drm:true})],[]])assert.throws(()=>soundcloudFormat({formats}),/Go\+|preview|protected/);
});

test('bundled media engines exactly match their retained official checksums',async()=>{
 const root=path.resolve(import.meta.dirname,'../desktop/vendor/media'),manifest=JSON.parse(await readFile(path.join(root,'manifest.json'),'utf8'));
 for(const [name,entry]of [['yt-dlp.exe',manifest.ytDlp],['node.exe',manifest.node]])assert.equal(createHash('sha256').update(await readFile(path.join(root,name))).digest('hex'),entry.sha256,name);
 assert.match(await readFile(path.join(root,'node-LICENSE.txt'),'utf8'),/MIT License/);assert.ok((await readFile(path.join(root,'yt-dlp-THIRD_PARTY_LICENSES.txt'))).length>1000);assert.equal(manifest.ffmpeg,false);
});
