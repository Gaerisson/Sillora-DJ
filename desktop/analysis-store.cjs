const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),{promisify}=require('node:util');
const gzip=promisify(zlib.gzip),gunzip=promisify(zlib.gunzip),keys=['bpm','beatOffset','tempoConfidence','beatStability','beats','tempoMap','key','keyRoot','keyMode','keyConfidence','analysisVersion','downbeat','audibleStart','audibleEnd','mixIn','mixOut','introEnd','outroEnd','rms','peak','loudnessLUFS','autoGain','envelope','bassEnvelope','structure','arrangement','confidence','peaks','regionAnalysisVersion','waveformVersion','waveBands'];
class AnalysisStore{
 constructor({directory,maxEntries=500,maxBytes=128*1024*1024}){Object.assign(this,{directory,maxEntries,maxBytes});this.pruning=null;}
 file(key){if(typeof key!=='string'||!/^sha256:[a-f0-9]{64}:\d+:wave\d+:region\d+$/.test(key))throw new Error('Identifiant d’analyse invalide.');return path.join(this.directory,crypto.createHash('sha256').update(key).digest('hex')+'.json.gz');}
 valid(key,a){const parts=key.split(':');return a&&a.analysisVersion===Number(parts[2])&&a.waveformVersion===Number(parts[3].slice(4))&&a.regionAnalysisVersion===Number(parts[4].slice(6))&&Array.isArray(a.peaks)&&a.peaks.length<=65536;}
 async get(key){try{const file=this.file(key),compressed=await fs.readFile(file);if(compressed.length>8*1024*1024)return null;const raw=await gunzip(compressed,{maxOutputLength:8*1024*1024}),value=JSON.parse(raw.toString('utf8'));if(value.key!==key||!this.valid(key,value.analysis))return null;await fs.utimes(file,new Date(),new Date()).catch(()=>{});return value.analysis;}catch{return null;}}
 async put(key,analysis){
  const file=this.file(key),data=JSON.stringify({key,analysis:Object.fromEntries(keys.filter(k=>analysis?.[k]!==undefined).map(k=>[k,analysis[k]]))},(_k,v)=>ArrayBuffer.isView(v)?Array.from(v):v);
  if(Buffer.byteLength(data)>8*1024*1024)throw new Error('Analyse trop volumineuse.');const plain=JSON.parse(data);if(!this.valid(key,plain.analysis))throw new Error('Analyse incohérente avec sa version.');await fs.mkdir(this.directory,{recursive:true});const temporary=file+'.'+crypto.randomUUID()+'.tmp';
  try{await fs.writeFile(temporary,await gzip(data,{level:3}),{flag:'wx'});await fs.rename(temporary,file);}finally{await fs.unlink(temporary).catch(()=>{});}await this.prune();return true;
 }
 async prune(){
  if(this.pruning)return this.pruning;this.pruning=(async()=>{const names=(await fs.readdir(this.directory)).filter(n=>/^[a-f0-9]{64}\.json\.gz$/.test(n)),entries=(await Promise.all(names.map(async name=>{try{const file=path.join(this.directory,name),s=await fs.stat(file);return{file,bytes:s.size,at:s.mtimeMs};}catch{return null;}}))).filter(Boolean).sort((a,b)=>a.at-b.at);let bytes=entries.reduce((n,e)=>n+e.bytes,0),count=entries.length;for(const e of entries){if(count<=this.maxEntries&&bytes<=this.maxBytes)break;await fs.unlink(e.file).catch(()=>{});bytes-=e.bytes;count--;}})();try{return await this.pruning;}finally{this.pruning=null;}
 }
}
module.exports={AnalysisStore};
