const fs=require('node:fs/promises');const path=require('node:path');const {randomUUID}=require('node:crypto');
const audio=/\.(mp3|wav|flac|ogg|m4a|aac|aiff|opus|webm)$/i;
class FolderLibrary{
 constructor({music,settingsFile,describe}){Object.assign(this,{music,settingsFile,describe});this.roots=[];this.handles=new Map();this.byPath=new Map();}
 handle(folder,root){let token=this.byPath.get(folder);if(!token){token=randomUUID();this.byPath.set(folder,token);this.handles.set(token,{folder,root});}return token;}
 async init(){let saved=[];try{saved=JSON.parse(await fs.readFile(this.settingsFile,'utf8'));}catch{}for(const folder of [this.music,...(Array.isArray(saved)?saved:[])])try{await this.add(folder,false);}catch{}return this.listRoots();}
 listRoots(){return this.roots.map(folder=>({token:this.handle(folder,folder),name:folder===this.music?'Musique':path.basename(folder),path:folder}));}
 async add(folder,persist=true){const real=await fs.realpath(folder);if(!(await fs.stat(real)).isDirectory())throw new Error('Dossier invalide.');if(!this.roots.includes(real))this.roots.push(real);this.handle(real,real);if(persist){await fs.mkdir(path.dirname(this.settingsFile),{recursive:true});await fs.writeFile(this.settingsFile,JSON.stringify(this.roots));}return this.listRoots();}
 async list(token){
  const handle=this.handles.get(token);if(!handle)throw new Error('Dossier non sélectionné.');const folder=await fs.realpath(handle.folder),relative=path.relative(handle.root,folder);
  if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw new Error('Dossier hors de la bibliothèque.');
  const children=await fs.readdir(folder,{withFileTypes:true}),directories=[],files=[];
  for(const item of children){if(item.name.startsWith('.')||item.isSymbolicLink())continue;const full=path.join(folder,item.name);if(item.isDirectory())directories.push({name:item.name,token:this.handle(full,handle.root)});else if(item.isFile()&&audio.test(item.name))try{files.push(await this.describe(full));}catch{}}
  directories.sort((a,b)=>a.name.localeCompare(b.name,'fr'));files.sort((a,b)=>a.name.localeCompare(b.name,'fr'));
  const crumbs=[{name:path.basename(handle.root),token:this.handle(handle.root,handle.root)}];let current=handle.root;for(const name of relative.split(path.sep).filter(Boolean)){current=path.join(current,name);crumbs.push({name,token:this.handle(current,handle.root)});}
  return {token,path:folder,crumbs,directories:directories.slice(0,2000),files:files.slice(0,2000),truncated:directories.length>2000||files.length>2000};
 }
}
module.exports={FolderLibrary};
