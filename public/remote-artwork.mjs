export class RemoteArtwork {
 constructor({load,createURL=blob=>URL.createObjectURL(blob),revokeURL=url=>URL.revokeObjectURL(url),now=Date.now,retryMs=2000,limit=160}={}){Object.assign(this,{load,createURL,revokeURL,now,retryMs,limit});this.entries=new Map();this.images=new WeakMap();}
 source(id){
  let entry=this.entries.get(id);if(entry){this.entries.delete(id);this.entries.set(id,entry);if(entry.url)return Promise.resolve(entry.url);if(entry.pending)return entry.pending;if(this.now()<entry.retryAt)return Promise.resolve(null);}
  entry??={};this.entries.set(id,entry);
  entry.pending=Promise.resolve().then(()=>this.load(id)).then(blob=>{if(this.entries.get(id)!==entry)return null;entry.url=this.createURL(blob);return entry.url;},()=>{entry.retryAt=this.now()+this.retryMs;return null;}).finally(()=>{entry.pending=null;});
  while(this.entries.size>this.limit){const key=this.entries.keys().next().value,old=this.entries.get(key);this.entries.delete(key);if(old.url)this.revokeURL(old.url);}
  return entry.pending;
 }
 async attach(img,id){
  let entry=this.images.get(img);
  if(!entry||entry.id!==(id||'')){entry={id:id||'',pending:false};this.images.set(img,entry);img.hidden=true;img.removeAttribute('src');img.dataset.coverId=entry.id;}
  if(!entry.id||entry.pending||!img.hidden)return;
  entry.pending=true;try{const url=await this.source(entry.id);if(url&&this.images.get(img)===entry){img.src=url;img.hidden=false;}}finally{entry.pending=false;}
 }
 dispose(){for(const entry of this.entries.values())if(entry.url)this.revokeURL(entry.url);this.entries.clear();this.images=new WeakMap();}
}
