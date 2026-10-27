const valid=value=>typeof value==='string'&&value.length<=400000&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
let database;
async function open(){if(!globalThis.indexedDB)return null;return database??=new Promise((resolve,reject)=>{const request=indexedDB.open('gaerisson-artwork',1);request.onupgradeneeded=()=>request.result.createObjectStore('covers');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function access(mode,key,value){try{const db=await open();if(!db||!key)return null;return await new Promise((resolve,reject)=>{const tx=db.transaction('covers',mode),store=tx.objectStore('covers'),request=mode==='readonly'?store.get(key):store.put(value,key);let result;request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);});}catch{return null;}}
export async function readCover(key){const value=await access('readonly',key);return valid(value)?value:null;}
export async function writeCover(key,value){if(valid(value))await access('readwrite',key,value);}
