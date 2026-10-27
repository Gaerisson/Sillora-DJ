function sameOrigin(value,origin){try{return new URL(value).origin===origin;}catch{return false;}}
function allowStudioPermission({webContents,mainWindow,origin,permission,requestingOrigin,details={},request=false}={}){
 details=details||{};
 if(!webContents||webContents!==mainWindow?.webContents||webContents.isDestroyed?.()||details.isMainFrame!==true||!sameOrigin(webContents.mainFrame?.url,origin)||!sameOrigin(details.requestingUrl,origin))return false;
 if(requestingOrigin!==undefined&&!sameOrigin(requestingOrigin,origin)||details.securityOrigin!==undefined&&!sameOrigin(details.securityOrigin,origin)||details.embeddingOrigin!==undefined&&!sameOrigin(details.embeddingOrigin,origin))return false;
 if(permission==='speaker-selection')return true;
 if(permission!=='media')return false;
 return request?Array.isArray(details.mediaTypes)&&details.mediaTypes.length===1&&details.mediaTypes[0]==='audio':details.mediaType==='audio';
}
module.exports={allowStudioPermission};
