const fs=require('node:fs/promises'),path=require('node:path'),{randomUUID}=require('node:crypto');
class LibraryIndex{
 constructor({file,resolveToken,describe}){Object.assign(this,{file,resolveToken,describe});this.writing=Promise.resolve();}
 async paths(){try{const data=JSON.parse(await fs.readFile(this.file,'utf8'));return Array.isArray(data)?data.filter(p=>typeof p==='string').slice(-20000):[];}catch{return [];}}
 async loadCatalog(){try{const target=this.file+'.catalog.json';if((await fs.stat(target)).size>20*1024*1024)return null;const bytes=await fs.readFile(target,'utf8');const value=JSON.parse(bytes);return value?.version===1&&Array.isArray(value.records)?value:null;}catch{return null;}}
 saveCatalog(value){
  if(value?.version!==1||!Array.isArray(value.records)||value.records.length>20000)return Promise.reject(new Error('Catalogue invalide.'));
  const fields=['title','artist','album','bpm','key','keyRoot','keyMode','keyConfidence','confidence','favorite','color','contentKey','analysisStatus','analysisVersion','regionAnalysisVersion','manualGrid','manualRegions','manualKey','downbeat','beatOffset','mixIn','mixOut','hotCues'],text=v=>typeof v==='string'?v.slice(0,2048):null;
  const records=value.records.filter(v=>v&&typeof v.id==='string'&&typeof v.key==='string').map(v=>({id:text(v.id),key:text(v.key),name:text(v.name),title:text(v.title),artist:text(v.artist),fileId:text(v.fileId),size:Number.isFinite(v.size)?v.size:0,lastModified:Number.isFinite(v.lastModified)?v.lastModified:0,duration:Number.isFinite(v.duration)?v.duration:0,processed:v.processed===true,userUpdatedAt:Number.isFinite(v.userUpdatedAt)?v.userUpdatedAt:0,favorite:typeof v.favorite==='boolean'?v.favorite:undefined,meta:Object.fromEntries(fields.filter(k=>v.meta?.[k]!==undefined).map(k=>[k,typeof v.meta[k]==='string'?text(v.meta[k]):Array.isArray(v.meta[k])?v.meta[k].slice(0,4).map(n=>Number.isFinite(n)?n:null):typeof v.meta[k]==='boolean'||Number.isFinite(v.meta[k])?v.meta[k]:null]))}));
  const b=value.batch,batch=b&&Array.isArray(b.keys)?{id:text(b.id),label:text(b.label),keys:b.keys.slice(0,20000).map(text).filter(Boolean),completed:Array.isArray(b.completed)?b.completed.slice(0,20000).map(text).filter(Boolean):[],state:['running','paused','cancelled','done'].includes(b.state)?b.state:'paused'}:null,data=JSON.stringify({version:1,records,batch});if(Buffer.byteLength(data)>20*1024*1024)return Promise.reject(new Error('Catalogue trop volumineux.'));
  const operation=this.writing.catch(()=>{}).then(async()=>{const target=this.file+'.catalog.json',temporary=target+'.'+randomUUID()+'.tmp';await fs.mkdir(path.dirname(target),{recursive:true});try{await fs.writeFile(temporary,data,{flag:'wx'});await fs.rename(temporary,target);}finally{await fs.unlink(temporary).catch(()=>{});}return true;});this.writing=operation;return operation;
 }
 remember(tokens){
  if(!Array.isArray(tokens)||tokens.length>20000)return Promise.reject(new Error('Liste de fichiers invalide.'));
  const paths=[];for(const token of tokens){const selected=typeof token==='string'&&this.resolveToken(token);if(!selected)return Promise.reject(new Error('Fichier non sélectionné.'));paths.push(selected);}
  const operation=this.writing.catch(()=>{}).then(async()=>{const files=[...new Set([...await this.paths(),...paths])].slice(-20000),temporary=this.file+'.'+randomUUID()+'.tmp';await fs.mkdir(path.dirname(this.file),{recursive:true});try{await fs.writeFile(temporary,JSON.stringify(files),{flag:'wx'});await fs.rename(temporary,this.file);}finally{await fs.unlink(temporary).catch(()=>{});}return files.length;});this.writing=operation;return operation;
 }
 async restore(){const result=[];for(const file of await this.paths())try{const real=await fs.realpath(file),fold=p=>process.platform==='win32'?path.resolve(p).toLowerCase():path.resolve(p);if(fold(real)!==fold(file))continue;result.push(await this.describe(real));}catch{}return result;}
}
module.exports={LibraryIndex};
