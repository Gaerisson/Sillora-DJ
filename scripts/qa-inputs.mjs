import fs from 'node:fs/promises';import {createReadStream} from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
export async function recipeInputs(recipe,source,environment={}){
 const required=new Set((recipe.inputs||[]).map(p=>path.resolve(source,p))),paths=new Set([...required,...recipe.args.filter(a=>!a.startsWith('--')).map(p=>path.resolve(source,p))]),files=[];
 for(const file of [...paths].sort()){let stat;try{stat=await fs.stat(file);}catch(error){if(!required.has(file)&&error.code==='ENOENT')continue;throw error;}if(!stat.isFile()){if(required.has(file))throw Error('Entrée de recette non régulière.');continue;}const h=createHash('sha256');for await(const bytes of createReadStream(file))h.update(bytes);files.push({file,bytes:stat.size,sha256:h.digest('hex')});}
 const env=Object.fromEntries(Object.entries({...environment,...recipe.env}).filter(([key])=>/^SILLORA_QA_/.test(key)&&key!=='SILLORA_QA_OUT').sort(([a],[b])=>a.localeCompare(b)));return{files,env};
}
