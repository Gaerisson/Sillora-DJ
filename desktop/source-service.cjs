const {randomUUID}=require('node:crypto');const {PublicHttps}=require('./public-https.cjs');
const {MetadataService,coverJPEG}=require('./metadata-service.cjs');
const MAX_AUDIO=128*1024*1024,MAX_DURATION=20*60;
const text=(value,max=180)=>String(Array.isArray(value)?value[0]||'':value??'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,max);
const validArchiveId=id=>typeof id==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,180}$/.test(id);
function lengthSeconds(value){if(typeof value==='number')return value;const parts=String(value||'').split(':').map(Number);return parts.every(Number.isFinite)?parts.reduce((sum,part)=>sum*60+part,0):0;}
function archiveLicense(value){const license=text(value,300);try{const url=new URL(license);if(!['http:','https:'].includes(url.protocol)||url.hostname!=='creativecommons.org')return null;if(/^\/publicdomain\/(?:zero|mark)\//.test(url.pathname))return license;if(/^\/licenses\/by(?:-nc)?(?:-sa)?\//.test(url.pathname))return license;}catch{}return null;}
async function mapLimit(values,limit,callback,onError){
 const output=new Array(values.length);let next=0;
 await Promise.all(Array.from({length:Math.min(limit,values.length)},async()=>{while(next<values.length){const index=next++;try{output[index]=await callback(values[index]);}catch(error){output[index]=null;onError?.(error);}}}));
 return output.filter(Boolean);
}
class SourceService{
 constructor({network=new PublicHttps(),metadata,nativeImage,now=Date.now,parseDuration}={}){Object.assign(this,{network,nativeImage,now,parseDuration});this.metadata=metadata||new MetadataService({nativeImage});this.issued=new Map();this.reading=0;}
 issue(entry){const id=randomUUID(),item={id,provider:entry.provider,title:text(entry.title),artist:text(entry.artist),album:text(entry.album),duration:entry.duration||0,license:text(entry.license,300),link:entry.link,cover:null};this.issued.set(id,{...entry,item,at:this.now()});while(this.issued.size>300)this.issued.delete(this.issued.keys().next().value);return item;}
 get(id){const entry=typeof id==='string'?this.issued.get(id):null;if(!entry||this.now()-entry.at>30*60*1000)throw new Error('Ce résultat a expiré. Relancez la recherche.');return entry;}
 async search(provider,query){
  if(!['audius','archive'].includes(provider))throw new Error('Plateforme non prise en charge.');if(typeof query!=='string'||query.length>120)throw new Error('Recherche invalide.');
  const q=text(query,100);let entries=provider==='audius'?await this.audius(q||'house'):await this.archive(q||'electronic');
  return {provider,items:entries.map(entry=>this.issue(entry)),status:entries.length?'ready':'empty'};
 }
 async audius(query){
  const url='https://api.audius.co/v1/tracks/search?'+new URLSearchParams({query,limit:'30',app_name:'SillageStudio'}),response=await this.network.json(url,{maxBytes:4*1024*1024});
  if(!Array.isArray(response.data))throw new Error('Audius ne renvoie pas de catalogue accessible.');
  return response.data.filter(track=>typeof track.id==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(track.id)&&Number.isFinite(track.duration)&&track.duration>0&&track.duration<MAX_DURATION&&track.is_streamable!==false&&track.is_available!==false&&!track.is_stream_gated&&!track.is_unlisted&&!track.is_delete).slice(0,12).map(track=>({provider:'audius',providerId:track.id,title:track.title,artist:track.user?.name||track.user?.handle||'Artiste Audius',duration:track.duration,license:track.license||'Licence indiquée sur Audius',link:'https://audius.co'+(typeof track.permalink==='string'&&track.permalink.startsWith('/')?track.permalink:'/tracks/'+encodeURIComponent(track.id)),url:'https://api.audius.co/v1/tracks/'+encodeURIComponent(track.id)+'/stream?app_name=SillageStudio',coverURL:track.artwork?.['150x150']||null,name:text(track.title).replace(/[^\p{L}\p{N} _.-]/gu,'').slice(0,100)+'.mp3'}));
 }
 async archive(query){
  const terms=query.replace(/[^\p{L}\p{N}\s'-]/gu,' ').trim().split(/\s+/).filter(Boolean).slice(0,8).map(term=>'"'+term+'"').join(' AND ')||'"electronic"';
  const q='mediatype:audio AND licenseurl:* AND format:MP3 AND (title:('+terms+') OR creator:('+terms+') OR subject:('+terms+'))';
  const response=await this.network.json('https://archive.org/advancedsearch.php?'+new URLSearchParams({q,output:'json',rows:'20','fl[]':'identifier,title,creator,licenseurl'}));
  if(!Array.isArray(response.response?.docs))throw new Error('Internet Archive ne renvoie pas de catalogue accessible.');
  const eligible=response.response.docs.filter(item=>validArchiveId(item.identifier)&&archiveLicense(item.licenseurl)).slice(0,8);
  let errors=0;const entries=await mapLimit(eligible,3,async item=>{
   const response=await this.network.json('https://archive.org/metadata/'+encodeURIComponent(item.identifier),{maxBytes:4*1024*1024});
   if(response.is_dark||response.is_restricted||response.metadata?.['access-restricted-item']==='true'||!Array.isArray(response.files))return null;
   const license=archiveLicense(response.metadata?.licenseurl||item.licenseurl);if(!license)return null;
   const files=response.files.filter(file=>typeof file.name==='string'&&/\.(mp3|ogg|flac|wav|m4a|opus)$/i.test(file.name)&&!file.private&&Number(file.size)>0&&Number(file.size)<=MAX_AUDIO&&(lengthSeconds(file.length||file.duration)||0)<MAX_DURATION);
   files.sort((a,b)=>Number(!/\.mp3$/i.test(a.name))-Number(!/\.mp3$/i.test(b.name))||a.name.localeCompare(b.name,'en',{numeric:true}));const file=files[0];if(!file)return null;
   return {provider:'archive',providerId:item.identifier,title:file.title||file.name.replace(/\.[^.]+$/,'')||item.title,artist:file.artist||response.metadata?.creator||item.creator||'Internet Archive',album:item.title,duration:lengthSeconds(file.length||file.duration),license,link:'https://archive.org/details/'+encodeURIComponent(item.identifier),url:'https://archive.org/download/'+encodeURIComponent(item.identifier)+'/'+file.name.split('/').map(encodeURIComponent).join('/'),coverURL:'https://archive.org/services/img/'+encodeURIComponent(item.identifier),name:file.name.split('/').at(-1)};
  },()=>errors++);if(eligible.length&&errors===eligible.length)throw new Error('Internet Archive répond, mais ses fichiers audio sont indisponibles pour le moment.');return entries;
 }
 async read(id){
  const entry=this.get(id);if(this.reading>=2)throw new Error('Deux titres sont déjà en préparation. Patientez un instant.');this.reading++;
  try{
   const audio=await this.network.read(entry.url,{maxBytes:MAX_AUDIO,timeout:90000,redirects:4});
   if(!audio.buffer?.length||/^(?:text\/|application\/(?:json|xml|vnd.apple.mpegurl))/.test(audio.type)||audio.buffer.subarray(0,16).toString().startsWith('#EXTM3U'))throw new Error('Cette source ne fournit pas un fichier audio lisible.');
   let duration;if(this.parseDuration)duration=await this.parseDuration(audio.buffer,audio.type);else{const parser=await import('music-metadata');duration=(await parser.parseBuffer(audio.buffer,{mimeType:audio.type,size:audio.buffer.length},{duration:true,skipCovers:true,skipPostHeaders:true})).format.duration;}
   if(!Number.isFinite(duration)||duration<=0||duration>=MAX_DURATION)throw new Error('Seuls les titres audio de moins de 20 minutes sont pris en charge.');
   const tags=await this.metadata.parse(audio.buffer,audio.type);let cover=tags.cover;
   if(!cover&&entry.coverURL&&this.nativeImage)try{const picture=await this.network.read(entry.coverURL,{maxBytes:4*1024*1024,timeout:6000,redirects:3});cover=coverJPEG(picture.buffer,this.nativeImage);}catch{}
   const metadata={...entry.item,title:tags.title||entry.item.title,artist:tags.artist||entry.item.artist,album:tags.album||entry.item.album,year:tags.year,duration,cover:cover||null};
   const buffer=audio.buffer;return {audio:buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),metadata,name:text(entry.name,140)||'source.mp3',mimeType:audio.type||'audio/mpeg'};
  }catch(error){if(/HTTP|HTTPS|taille|réseau|résolution|téléchargement|minutes|lisible|expiré/.test(error.message))throw error;throw new Error('Impossible de lire ce titre sur '+(entry.provider==='audius'?'Audius':'Internet Archive')+'. Essayez un autre résultat.');}
  finally{this.reading--;}
 }
}
module.exports={SourceService,archiveLicense,lengthSeconds,MAX_AUDIO,MAX_DURATION};
