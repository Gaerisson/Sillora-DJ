const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID,createHash}=require('node:crypto');
const {PublicHttps,publicURL}=require('./public-https.cjs');
const {coverJPEG}=require('./metadata-service.cjs');

const DAY=86400000,MAX_IMAGE=1024*1024;
const clean=(value,max=180)=>typeof value==='string'?value.replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,max):'';
const digest=value=>createHash('sha256').update(value).digest('hex');
const MBID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const words=value=>clean(value).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/\b(?:official|audio|video|lyrics|remaster(?:ed)?|feat|ft)\b/g,' ').replace(/[^\p{L}\p{N}]+/gu,' ').trim().split(/\s+/).filter(Boolean);
function overlap(a,b){const left=new Set(words(a)),right=new Set(words(b));if(!left.size||!right.size)return 0;return [...left].filter(word=>right.has(word)).length/Math.max(left.size,right.size);}
function artworkQuery(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Recherche de pochette invalide.');
 for(const key of ['title','artist','album'])if(value[key]!=null&&(typeof value[key]!=='string'||value[key].length>300))throw new Error('Recherche de pochette invalide.');
 const title=clean(value.title).replace(/[([][^)\]]*\b(?:official|audio|lyrics|video)\b[^)\]]*[)\]]/gi,' ').replace(/\s*[-–—]?\s*\bofficial\s+(?:audio|video|lyric video)\s*$/i,'').replace(/\s*\((?:feat\.?|ft\.?)\s+[^)]*\)\s*/gi,' ').trim();
 const query={title,artist:clean(value.artist),album:clean(value.album)};
 if(query.title.length<2&&query.album.length<2)throw new Error('Indiquez un titre ou un album pour rechercher sa pochette.');
 return query;
}
function artworkURL(value){
 const url=publicURL(value);
 const match=url.pathname.match(/^\/(release|release-group)\/([^/]+)\/front-500$/);
 if(url.hostname!=='coverartarchive.org'||!match||!MBID.test(match[2])||url.search)throw new Error('Adresse de pochette non reconnue.');
 return url.href;
}
const lucene=value=>'"'+clean(value).replace(/[\\"]/g,'\\$&')+'"';

class MediaLibrary{
 constructor({profileDir,nativeImage,network=new PublicHttps(),now=Date.now}={}){
  Object.assign(this,{profileDir,nativeImage,network,now});this.issued=new Map();this.searches=new Map();this.pending=new Map();this.failures=new Map();this.index={};this.queue=Promise.resolve();this.persistQueue=Promise.resolve();this.lastRequest=0;
  this.cacheDir=profileDir?path.join(profileDir,'artwork-cache'):null;this.ready=this.init();
 }
 async init(){
  if(!this.cacheDir)return;
  await fs.mkdir(this.cacheDir,{recursive:true});
  try{const saved=JSON.parse(await fs.readFile(path.join(this.cacheDir,'index.json'),'utf8'));for(const [key,entry]of Object.entries(saved||{}).slice(-400))if(/^[a-f0-9]{64}$/.test(key)&&entry&&/^[a-f0-9]{64}$/.test(entry.file)&&Number.isFinite(entry.at)&&this.now()-entry.at<30*DAY)this.index[key]=entry;}catch{}
 }
 async schedule(action){
  const work=this.queue.catch(()=>{}).then(async()=>{const pause=Math.max(0,1100-(this.now()-this.lastRequest));if(pause)await new Promise(resolve=>setTimeout(resolve,pause));this.lastRequest=this.now();return action();});
  this.queue=work.catch(()=>{});return work;
 }
 async saveIndex(){
  if(!this.cacheDir)return;const json=JSON.stringify(this.index),file=path.join(this.cacheDir,'index.json'),temporary=path.join(this.cacheDir,'index.tmp');
  const work=this.persistQueue.catch(()=>{}).then(async()=>{await fs.writeFile(temporary,json);await fs.rename(temporary,file);});this.persistQueue=work.catch(()=>{});return work;
 }
 async searchArtwork(value){
  await this.ready;const query=artworkQuery(value),key=digest('musicbrainz:'+JSON.stringify(query)),cached=this.searches.get(key);
  if(cached&&this.now()-cached.at<20*60*1000)return cached.value;
  const failure=this.failures.get(key);if(failure&&this.now()-failure.at<60000)throw new Error(failure.message);
  if(this.pending.has('search:'+key))return this.pending.get('search:'+key);
  const promise=this.schedule(async()=>{
   const albumOnly=!query.title,term=[(albumOnly?'releasegroup:':'recording:')+lucene(query.title||query.album),query.artist?'artist:'+lucene(query.artist):'',!albumOnly&&query.album?'release:'+lucene(query.album):'',!albumOnly&&!/\b(?:live|mix)\b/i.test(query.title)?'NOT comment:"DJ-mix"':''].filter(Boolean).join(' AND '),url='https://musicbrainz.org/ws/2/'+(albumOnly?'release-group':'recording')+'/?'+new URLSearchParams({query:term,fmt:'json',limit:'50'});
   const response=await this.network.json(url,{maxBytes:2*1024*1024,timeout:12000,redirects:2});
   const results=albumOnly?response['release-groups']:response.recordings;
   if(!Array.isArray(results))throw new Error('Le catalogue de pochettes ne répond pas correctement.');
   const seen=new Set(),entries=[];
   for(const item of results){
    const title=clean(item.title),artist=clean((item['artist-credit']||[]).map(credit=>credit.name||credit.artist?.name||'').join(', '));
    const releases=albumOnly?[item]:(Array.isArray(item.releases)?item.releases:[]);
    for(const release of releases){const group=release['release-group'],id=group?.id||release.id,type=group||albumOnly?'release-group':'release';if(!MBID.test(id||''))continue;
     const imageURL=artworkURL('https://coverartarchive.org/'+type+'/'+id+'/front-500');if(seen.has(imageURL))continue;seen.add(imageURL);
     // A featured guest must not make the exact main artist look unrelated.
     const credits=(item['artist-credit']||[]).map(credit=>credit.name||credit.artist?.name||'');
     const album=clean(group?.title||release.title),titleScore=query.title?overlap(query.title,title):overlap(query.album,album),artistScore=query.artist?Math.max(overlap(query.artist,artist),...credits.map(name=>overlap(query.artist,name))):titleScore;
     const secondary=group?.['secondary-types']||release['secondary-types']||[],compilation=secondary.includes('Compilation'),mix=secondary.includes('DJ-mix')||/DJ.m(?:ix|ixé)/i.test(item.disambiguation||''),bootleg=release.status==='Bootleg';
     const primary=group?.['primary-type']||release['primary-type'],releaseScore=(['Album','Single','EP'].includes(primary)?.1:0)+(query.title?overlap(query.title,album)*.08:0)+(release.status==='Official'?.02:0);
     const score=titleScore*.7+artistScore*.3+releaseScore+(query.album?overlap(query.album,album)*.3:0)-(compilation?.2:0)-(mix?.3:0)-(bootleg?.2:0);
     entries.push({title,artist,album,imageURL,score,titleScore,artistScore,compilation,mix,source:'MusicBrainz / Cover Art Archive'});
    }
   }
   entries.sort((a,b)=>b.score-a.score);
   const candidates=entries.slice(0,6).map(entry=>{const id=randomUUID();this.issued.set(id,{...entry,at:this.now()});return{id,title:entry.title,artist:entry.artist,album:entry.album,preview:null,source:entry.source};});
   while(this.issued.size>200)this.issued.delete(this.issued.keys().next().value);
   const result={query,candidates};this.searches.set(key,{at:this.now(),value:result});while(this.searches.size>200)this.searches.delete(this.searches.keys().next().value);return result;
  });
  this.pending.set('search:'+key,promise);try{return await promise;}catch(error){this.failures.set(key,{at:this.now(),message:error.message});while(this.failures.size>100)this.failures.delete(this.failures.keys().next().value);throw error;}finally{this.pending.delete('search:'+key);}
 }
 getCandidate(id){const entry=typeof id==='string'?this.issued.get(id):null;if(!entry||this.now()-entry.at>30*60*1000)throw new Error('Cette pochette a expiré. Relancez la recherche.');return entry;}
 async fetchArtwork(id){
  await this.ready;const entry=this.getCandidate(id),key=digest(entry.imageURL);
  if(this.pending.has('image:'+key))return this.pending.get('image:'+key);
  const promise=(async()=>{
   let cover=null;
   if(this.cacheDir)try{const buffer=await fs.readFile(path.join(this.cacheDir,key+'.jpg'));if(buffer.length<=200*1024)cover=coverJPEG(buffer,this.nativeImage);}catch{}
   if(!cover){
    if(!this.nativeImage)throw new Error('Les pochettes nécessitent l’application Windows.');
    const response=await this.schedule(()=>this.network.read(entry.imageURL,{maxBytes:MAX_IMAGE,timeout:10000,redirects:2}));
    cover=coverJPEG(response.buffer,this.nativeImage);if(!cover)throw new Error('Ce résultat ne contient pas une image compatible.');
    if(this.cacheDir)await fs.writeFile(path.join(this.cacheDir,key+'.jpg'),Buffer.from(cover.split(',')[1],'base64'));
   }
   return{id,cover,title:entry.title,artist:entry.artist,album:entry.album,source:entry.source};
  })();
  this.pending.set('image:'+key,promise);try{return await promise;}finally{this.pending.delete('image:'+key);}
 }
 async lookupArtwork(value){
  await this.ready;const query=artworkQuery(value),key=digest('musicbrainz:'+JSON.stringify(query)),saved=this.index[key];
  if(saved&&this.cacheDir&&this.now()-saved.at<30*DAY)try{const buffer=await fs.readFile(path.join(this.cacheDir,saved.file+'.jpg')),cover=coverJPEG(buffer,this.nativeImage);if(cover)return{cover,source:saved.source,status:'cached'};}catch{}
  const result=await this.searchArtwork(query);
  for(const candidate of result.candidates.slice(0,3)){
   const entry=this.getCandidate(candidate.id);if(entry.titleScore<.55||(query.artist&&entry.artistScore<.4))continue;
   let artwork;try{artwork=await this.fetchArtwork(candidate.id);}catch(error){if(/HTTP 404/.test(error.message))continue;throw error;}
   if(this.cacheDir){this.index[key]={file:digest(entry.imageURL),at:this.now(),source:artwork.source};while(Object.keys(this.index).length>400)delete this.index[Object.keys(this.index)[0]];await this.saveIndex();}
   return{...artwork,status:'found'};
  }
  return{cover:null,status:'not-found'};
 }
}
module.exports={MediaLibrary,artworkQuery,artworkURL,overlap,MAX_IMAGE};
