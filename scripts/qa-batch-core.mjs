export function validateRecipes(value){
 if(!Array.isArray(value)||!value.length)throw Error('La liste recipes est requise.');const names=new Set();
 return value.map(item=>{if(!item||!/^[-a-z0-9]+$/.test(item.name)||names.has(item.name)||!(item.script==='@unit'||/^qa-[-a-z0-9]+\.cjs$/.test(item.script))||!Array.isArray(item.args)||!item.args.every(a=>typeof a==='string')||typeof item.exclusive!=='boolean'||item.resources!==undefined&&(!Array.isArray(item.resources)||!item.resources.every(r=>/^[-a-z0-9]+$/.test(r))))throw Error('Recette invalide ou nom dupliqué.');names.add(item.name);return{...item,resources:item.resources??(item.script==='@unit'?[]:['electron-ui'])};});
}
export async function runScheduled(recipes,run,{jobs=2,phase='all'}={}){
 if(!Number.isInteger(jobs)||jobs<1||jobs>4||!['all','parallel','exclusive'].includes(phase))throw Error('Utiliser jobs 1–4 et phase all/parallel/exclusive.');
 const completed=[];let failed=false;const parallel=recipes.filter(r=>!r.exclusive),exclusive=recipes.filter(r=>r.exclusive);
 async function execute(recipe){let result;try{result=await run(recipe);}catch(error){result={name:recipe.name,passed:false,error:String(error?.message||error)};}completed.push(result);if(!result.passed)failed=true;return result;}
 if(phase!=='exclusive')await new Promise(resolve=>{const pending=[...parallel],held=new Set();let active=0;const pump=()=>{while(!failed&&active<jobs){const index=pending.findIndex(r=>(r.resources||[]).every(key=>!held.has(key)));if(index<0)break;const [recipe]=pending.splice(index,1);for(const key of recipe.resources||[])held.add(key);active++;execute(recipe).finally(()=>{active--;for(const key of recipe.resources||[])held.delete(key);pump();});}if(!active&&(failed||!pending.length))resolve();};pump();});
 if(!failed&&phase!=='parallel')for(const recipe of exclusive){await execute(recipe);if(failed)break;}
 return{passed:!failed,completed};
}
