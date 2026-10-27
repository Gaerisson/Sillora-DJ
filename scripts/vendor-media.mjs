import {mkdir,readFile,writeFile,copyFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

// Pinned official releases. Re-running verifies the local binaries before reuse.
const YTDLP='2026.10.21',NODE='v24.22.1';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'desktop','vendor','media');
const sha256=buffer=>createHash('sha256').update(buffer).digest('hex');
async function download(url,maxBytes=40*1024*1024){
 const response=await fetch(url,{signal:AbortSignal.timeout(120000),headers:{'User-Agent':'Gaerisson-DJ-Studio-media-vendor/0.14'}});
 if(!response.ok)throw new Error('HTTP '+response.status+': '+url);
 if(Number(response.headers.get('content-length'))>maxBytes)throw new Error('Asset is too large: '+url);
 const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>maxBytes)throw new Error('Asset is too large: '+url);chunks.push(chunk);}return Buffer.concat(chunks);
}
function checksum(text,name){for(const line of text.split(/\r?\n/)){const match=line.match(/^([a-f0-9]{64})\s+\*?(.+)$/i);if(match&&match[2]===name)return match[1].toLowerCase();}throw new Error('Official checksum not found: '+name);}
async function verified(file,expected,url,maxBytes){try{const current=await readFile(file);if(sha256(current)===expected)return current;}catch{}const buffer=await download(url,maxBytes);if(sha256(buffer)!==expected)throw new Error('SHA-256 mismatch: '+url);await writeFile(file,buffer);return buffer;}
await mkdir(output,{recursive:true});
const ytBase='https://github.com/yt-dlp/yt-dlp/releases/download/'+YTDLP;
const ytSums=(await download(ytBase+'/SHA2-256SUMS',256*1024)).toString('utf8'),ytHash=checksum(ytSums,'yt-dlp.exe');
await verified(path.join(output,'yt-dlp.exe'),ytHash,ytBase+'/yt-dlp.exe');
await writeFile(path.join(output,'yt-dlp-SHA2-256SUMS.txt'),ytSums);
for(const name of ['LICENSE','THIRD_PARTY_LICENSES.txt'])await writeFile(path.join(output,'yt-dlp-'+name.replace(/^LICENSE$/,'LICENSE.txt')),await download('https://raw.githubusercontent.com/yt-dlp/yt-dlp/'+YTDLP+'/'+name,2*1024*1024));
const nodeBase='https://nodejs.org/dist/'+NODE,nodeSums=(await download(nodeBase+'/SHASUMS256.txt',128*1024)).toString('utf8'),nodeHash=checksum(nodeSums,'win-x64/node.exe');
const nodeOutput=path.join(output,'node.exe');
let reused=false;for(const candidate of [nodeOutput,'D:/Codex/tools/node/node.exe'])try{if(sha256(await readFile(candidate))===nodeHash){if(candidate!==nodeOutput)await copyFile(candidate,nodeOutput);reused=true;break;}}catch{}
if(!reused)await verified(nodeOutput,nodeHash,nodeBase+'/win-x64/node.exe',120*1024*1024);
await writeFile(path.join(output,'node-SHASUMS256.txt'),nodeSums);
await writeFile(path.join(output,'node-LICENSE.txt'),await download('https://raw.githubusercontent.com/nodejs/node/'+NODE+'/LICENSE',1024*1024));
const manifest={schema:1,ytDlp:{version:YTDLP,url:ytBase+'/yt-dlp.exe',sha256:ytHash,license:'Unlicense + bundled third-party licenses'},node:{version:NODE,url:nodeBase+'/win-x64/node.exe',sha256:nodeHash,license:'MIT + bundled third-party licenses'},purpose:'Public YouTube and SoundCloud audio import; bundled Node executes the official yt-dlp EJS solver for YouTube.',ffmpeg:false};
await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
for(const name of ['yt-dlp.exe','node.exe'])if(!(await stat(path.join(output,name))).isFile())throw new Error('Missing binary: '+name);
if(process.platform==='win32')console.log('Verified yt-dlp '+execFileSync(path.join(output,'yt-dlp.exe'),['--version'],{encoding:'utf8',windowsHide:true}).trim()+' and Node '+execFileSync(nodeOutput,['--version'],{encoding:'utf8',windowsHide:true}).trim()+'.');
else console.log('Verified Windows x64 yt-dlp '+YTDLP+' and Node '+NODE+'.');
