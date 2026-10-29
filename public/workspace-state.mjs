export const workspaceNames=['studio','automix','preparation','regie'];
export const moduleNames=['vinyl','sampler','session'];
export function workspacePreferences(value={}){
 return{version:1,workspace:workspaceNames.includes(value?.workspace)?value.workspace:'studio',studioLive:value?.studioLive===true,density:value?.density==='compact'?'compact':'comfortable',libraryHeight:Number.isFinite(value?.libraryHeight)?Math.round(Math.max(160,Math.min(900,value.libraryHeight))):320,modules:Object.fromEntries(moduleNames.map(key=>[key,value?.modules?.[key]!==false]))};
}
export function libraryHeight(requested,viewportHeight){return Math.round(Math.max(160,Math.min(900,Math.max(160,viewportHeight*.7),requested)));}
export function resizeLibrary(initial,start,current,viewportHeight){return libraryHeight(initial+current-start,viewportHeight);}
