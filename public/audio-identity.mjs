// Analysis versions identify derived data; only the byte digest identifies audio.
export function audioContentId(key){
 if(typeof key!=='string'||!key)return null;
 const match=/^sha256:([a-f0-9]{64})(?::\d+:wave\d+:region\d+)?$/i.exec(key);
 return match?'sha256:'+match[1].toLowerCase():key;
}
