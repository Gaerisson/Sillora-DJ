import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {EventEmitter} from 'node:events';
const require=createRequire(import.meta.url),{PublicHttps,publicAddress,publicURL}=require('../desktop/public-https.cjs'),{MetadataService,coverJPEG,MAX_READ}=require('../desktop/metadata-service.cjs'),{SourceService,archiveLicense}=require('../desktop/source-service.cjs');
function requester(responses,seen=[]){return(url,options,callback)=>{const request=new EventEmitter();request.destroy=()=>request.emit('error',new Error('closed'));request.end=()=>queueMicrotask(()=>{options.lookup(url.hostname,{all:true},(_error,records)=>seen.push(records[0].address));const next=responses.shift(),response=new EventEmitter();Object.assign(response,{statusCode:next.status||200,headers:next.headers||{},resume(){},destroy(){}});callback(response);if(response.statusCode===200){for(const value of next.chunks||[Buffer.from(next.body||'')])response.emit('data',value);response.emit('end');}});return request;};}
const publicDNS=async()=>[{address:'8.8.8.8',family:4}];
test('public HTTPS rejects private/special IPs, credentials, raw-IP URLs and downgraded transport',()=>{
 for(const address of ['127.0.0.1','10.0.0.1','172.16.0.1','192.168.1.1','169.254.1.1','100.64.0.1','198.18.0.1','192.0.2.1','224.0.0.1','::1','::ffff:127.0.0.1','fc00::1','fe80::1','fec0::1','2001:db8::1','2002:a00:1::'])assert.equal(publicAddress(address),false,address);
 for(const address of ['8.8.8.8','1.1.1.1','2606:4700::1111','2001:4860:4860::8888'])assert.equal(publicAddress(address),true,address);
 for(const url of ['http://archive.org/x','https://127.0.0.1/x','https://[::1]/x','https://user:pass@archive.org/x','https://archive.org:444/x','https://localhost/x'])assert.throws(()=>publicURL(url));
 assert.equal(publicURL('https://archive.org/metadata/item').hostname,'archive.org');
});
test('HTTPS connections pin validated DNS and bound redirects and downloaded bytes',async()=>{
 const seen=[],network=new PublicHttps({lookup:publicDNS,request:requester([{status:302,headers:{location:'https://cdn.example/audio'}},{body:'audio'}],seen)});assert.equal((await network.read('https://api.example/stream')).buffer.toString(),'audio');assert.deepEqual(seen,['8.8.8.8','8.8.8.8']);
 const local=new PublicHttps({lookup:async()=>[{address:'8.8.8.8',family:4},{address:'127.0.0.1',family:4}],request:()=>{throw new Error('Must not connect');}});await assert.rejects(local.read('https://api.example/x'),/privée/);
 const downgrade=new PublicHttps({lookup:publicDNS,request:requester([{status:302,headers:{location:'http://api.example/audio'}}])});await assert.rejects(downgrade.read('https://api.example/x'),/HTTPS/);
 const cap=new PublicHttps({lookup:publicDNS,request:requester([{chunks:[Buffer.alloc(8),Buffer.alloc(8)]}])});await assert.rejects(cap.read('https://api.example/x',{maxBytes:10}),/taille/);
 const redirect=new PublicHttps({lookup:publicDNS,request:requester([{status:302,headers:{location:'/again'}}])});await assert.rejects(redirect.read('https://api.example/x',{redirects:0}),/redirections/);
});
test('metadata parser reads a bounded prefix and cover conversion rejects SVG and oversized dimensions',async()=>{
 let received=0;const metadata=new MetadataService({parser:{parseBuffer:async buffer=>{received=buffer.length;return{common:{title:'A title',artist:'An artist',album:'Album',year:2026}};}}});const result=await metadata.parse(Buffer.alloc(MAX_READ+20));assert.equal(received,MAX_READ);assert.equal(result.title,'A title');assert.equal(result.year,2026);assert.equal(result.cover,null);
 assert.equal(coverJPEG(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),{createFromBuffer(){throw new Error('Must not decode SVG');}}),null);
 const png=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.writeUInt32BE(99999,16);png.writeUInt32BE(99999,20);assert.equal(coverJPEG(png,{createFromBuffer(){throw new Error('Must not decode huge image');}}),null);
 png.writeUInt32BE(1000,16);png.writeUInt32BE(500,20);let resize;const image={isEmpty:()=>false,resize:options=>{resize=options;return image;},toJPEG:()=>Buffer.from('jpeg')};assert.match(coverJPEG(png,{createFromBuffer:()=>image}),/^data:image\/jpeg;base64,/);assert.equal(resize.width,512);assert.equal(resize.height,256);
});
test('Audius only issues opaque IDs for accessible finite tracks and never accepts arbitrary URLs',async()=>{
 const requested=[],network={json:async()=>({data:[{id:'ok1',title:'Music',duration:200,user:{name:'Artist'},permalink:'/artist/music'},{id:'gated',duration:100,is_stream_gated:true},{id:'long',duration:1300}]}),read:async(url,options)=>{requested.push({url,options});return{buffer:Buffer.from('audio'),type:'audio/mpeg'};}};
 let now=1000;const service=new SourceService({network,now:()=>now,parseDuration:async()=>201,metadata:{parse:async()=>({title:'Tagged title',artist:'Tagged artist',cover:null,year:2026})}}),result=await service.search('audius','house');assert.equal(result.items.length,1);assert.equal(result.items[0].title,'Music');assert.equal(Object.hasOwn(result.items[0],'url'),false);assert.equal(Object.hasOwn(result.items[0],'providerId'),false);
 await assert.rejects(service.read('https://localhost/private'),/expiré/);assert.equal(requested.length,0);const read=await service.read(result.items[0].id);assert.equal(read.metadata.title,'Tagged title');assert.equal(read.metadata.duration,201);assert.equal(read.audio.byteLength,5);assert.match(requested[0].url,/api\.audius\.co\/v1\/tracks\/ok1\/stream/);assert.equal(requested[0].options.maxBytes,128*1024*1024);
 now+=31*60*1000;await assert.rejects(service.read(result.items[0].id),/expiré/);
});
test('Archive resolves actual public CC audio and excludes private, long, ZIP-only and no-derivative files',async()=>{
 assert.ok(archiveLicense('https://creativecommons.org/licenses/by-sa/4.0/'));assert.equal(archiveLicense('https://creativecommons.org/licenses/by-nd/4.0/'),null);assert.equal(archiveLicense('https://example.com/licenses/by/4.0/'),null);
 const network={json:async url=>url.includes('advancedsearch')?{response:{docs:[{identifier:'album',title:'Album',creator:'Artist',licenseurl:'https://creativecommons.org/licenses/by/4.0/'}]}}:{metadata:{licenseurl:'https://creativecommons.org/licenses/by/4.0/'},files:[{name:'archive.zip',size:100},{name:'long.mp3',size:200,length:1300},{name:'private.mp3',size:100,private:true},{name:'01.ogg',size:100,length:60},{name:'01.mp3',size:100,length:'03:20',title:'Real track'}]}};
 const service=new SourceService({network}),result=await service.search('archive','house');assert.equal(result.items.length,1);assert.equal(result.items[0].title,'Real track');assert.equal(result.items[0].duration,200);assert.match(service.get(result.items[0].id).url,/archive\.org\/download\/album\/01\.mp3$/);
 network.json=async url=>{if(url.includes('advancedsearch'))return{response:{docs:[{identifier:'album',licenseurl:'https://creativecommons.org/licenses/by/4.0/'}]}};throw new Error('Service unavailable');};await assert.rejects(service.search('archive','house'),/indisponibles/);
});
test('downloaded audio must be finite and shorter than twenty minutes',async()=>{
 const network={json:async()=>({data:[{id:'id1',title:'A',duration:200}]}),read:async()=>({buffer:Buffer.from('audio'),type:'audio/mpeg'})},service=new SourceService({network,parseDuration:async()=>1300,metadata:{parse:async()=>({})}}),result=await service.search('audius','x');await assert.rejects(service.read(result.items[0].id),/20 minutes/);assert.equal(service.reading,0);
 network.read=async()=>({buffer:Buffer.from('<html>blocked</html>'),type:'text/html'});await assert.rejects(service.read(result.items[0].id),/lisible/);
});
