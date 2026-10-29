import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {createRequire} from 'node:module';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if(process.argv.includes('--fast')&&process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL===undefined)process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL='1';
process.env.ELECTRON_BUILDER_CACHE=path.join(root,'.runtime','builder-cache');
const require=createRequire(import.meta.url);
if(process.platform==='win32'){
  // Windows PowerShell can crash before npm starts. Use electron-builder's own
  // filesystem collector so the complete production graph is still checked.
  // This affects this build process only; installed dependencies stay untouched.
  const collectors=require('app-builder-lib/out/node-module-collector/index.js');
  const {PM}=require('app-builder-lib/out/node-module-collector/packageManager.js');
  const original=collectors.getCollectorByPackageManager;
  collectors.getCollectorByPackageManager=(manager,...args)=>original(manager===PM.NPM?PM.TRAVERSAL:manager,...args);
}
await import('./vendor-audio.mjs');
const fs=await import('node:fs');
for(const resource of ['stems/runtime-manifest.json','stems/python/python.exe','stems/models/hub/checkpoints/955717e8-8726e21a.th','media/manifest.json'])if(!fs.existsSync(path.join(root,'desktop/vendor',resource)))throw new Error('Ressource embarquée manquante : '+resource+' ; préparer vendor:stems / vendor:media avant pack.');
await import('./vendor-qr.mjs');
const {build,Platform,Arch}=require('electron-builder');
const targets=process.argv.includes('--installer')?['portable','nsis']:['portable'];
try{await build({projectDir:root,targets:Platform.WINDOWS.createTarget(targets,Arch.x64),...(process.env.SILLORA_BUILD_OUTPUT?{config:{directories:{output:path.resolve(root,process.env.SILLORA_BUILD_OUTPUT)}}}:{})});}
catch(error){console.error(error);process.exitCode=1;}
