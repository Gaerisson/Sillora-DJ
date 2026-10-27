const fs=require('node:fs/promises');
const MAX_READ=8*1024*1024;
const clean=(value,max=180)=>typeof value==='string'?value.replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,max):'';
function imageSize(data){
 if(data.length>=24&&data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {width:data.readUInt32BE(16),height:data.readUInt32BE(20)};
 if(data.length>4&&data[0]===255&&data[1]===216){let p=2;while(p+9<data.length&&p<524288){if(data[p++]!==255)continue;let marker=data[p++];while(marker===255)marker=data[p++];if(marker===217||marker===218)break;if(marker===1||marker>=208&&marker<=215)continue;const length=data.readUInt16BE(p);if(length<2||p+length>data.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))return {height:data.readUInt16BE(p+3),width:data.readUInt16BE(p+5)};p+=length;}}
 return null;
}
function coverJPEG(value,nativeImage){
 const buffer=Buffer.from(value||[]);if(!nativeImage||!buffer.length||buffer.length>4*1024*1024)return null;const size=imageSize(buffer);if(!size||size.width<1||size.height<1||size.width>4096||size.height>4096||size.width*size.height>16*1024*1024)return null;
 try{let image=nativeImage.createFromBuffer(buffer);if(image.isEmpty())return null;const ratio=Math.min(1,512/size.width,512/size.height);image=image.resize({width:Math.max(1,Math.round(size.width*ratio)),height:Math.max(1,Math.round(size.height*ratio)),quality:'good'});for(const quality of [82,65,45]){const jpeg=image.toJPEG(quality),url='data:image/jpeg;base64,'+jpeg.toString('base64');if(url.length<=200*1024)return url;}return null;}catch{return null;}
}
class MetadataService{
 constructor({nativeImage,parser}={}){Object.assign(this,{nativeImage,parser});this.cache=new Map();}
 async parse(buffer,mimeType){
  try{const parser=this.parser||await import('music-metadata'),parsed=await parser.parseBuffer(buffer.subarray(0,MAX_READ),{mimeType,size:Math.min(buffer.length,MAX_READ)},{duration:false,skipPostHeaders:true}),common=parsed.common||{};
   return {title:clean(common.title),artist:clean(common.artist||common.artists?.join(', ')),album:clean(common.album),year:Number.isInteger(common.year)&&common.year>=1000&&common.year<=9999?common.year:null,cover:coverJPEG(common.picture?.[0]?.data,this.nativeImage)};
  }catch{return {title:'',artist:'',album:'',year:null,cover:null};}
 }
 async file(file){
  const stat=await fs.stat(file),key=file+'|'+stat.size+'|'+stat.mtimeMs;if(this.cache.has(key))return this.cache.get(key);
  const handle=await fs.open(file,'r');let metadata;try{const buffer=Buffer.alloc(Math.min(stat.size,MAX_READ)),{bytesRead}=await handle.read(buffer,0,buffer.length,0);metadata=await this.parse(buffer.subarray(0,bytesRead));}finally{await handle.close();}
  this.cache.set(key,metadata);while(this.cache.size>100)this.cache.delete(this.cache.keys().next().value);return metadata;
 }
}
module.exports={MetadataService,coverJPEG,imageSize,MAX_READ};
