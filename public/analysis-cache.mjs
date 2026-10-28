import {ANALYSIS_VERSION} from './audio-analysis.mjs';
let database;
async function open(){
 if(typeof indexedDB==='undefined')return null;
 database??=new Promise((resolve,reject)=>{const request=indexedDB.open('sillage-audio-analysis',1);request.onupgradeneeded=()=>request.result.createObjectStore('tracks',{keyPath:'key'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 return database;
}
export const analysisKey=file=>JSON.stringify([file.name,file.size,file.lastModified,ANALYSIS_VERSION]);
export async function contentAnalysisKey(bytes){
 if(!globalThis.crypto?.subtle)return null;
 const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
 return 'sha256:'+Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('')+':'+ANALYSIS_VERSION+':wave2:region1';
}
export async function cachedAnalysis(key){try{if(globalThis.window?.sillageDesktop?.analysisRead){const native=await window.sillageDesktop.analysisRead(key);if(native)return native;}}catch{}try{const db=await open();if(!db)return null;return await new Promise(resolve=>{const request=db.transaction('tracks').objectStore('tracks').get(key);request.onsuccess=()=>resolve(request.result?.analysis||null);request.onerror=()=>resolve(null);});}catch{return null;}}
export async function cacheAnalysis(key,analysis){if(globalThis.window?.sillageDesktop?.analysisSave)try{if(await window.sillageDesktop.analysisSave(key,analysis))return;}catch{}try{const db=await open();if(!db)return;await new Promise((resolve,reject)=>{const tx=db.transaction('tracks','readwrite'),store=tx.objectStore('tracks');store.put({key,analysis,at:Date.now()});const count=store.count();count.onsuccess=()=>{if(count.result>500){let remaining=count.result-500;const cursor=store.openCursor();cursor.onsuccess=()=>{if(cursor.result&&remaining-->0){cursor.result.delete();cursor.result.continue();}};}};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}catch{/* Cache failures must never prevent playback. */}}
