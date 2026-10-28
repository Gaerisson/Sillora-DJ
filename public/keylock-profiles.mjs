export const keyLockProfiles=Object.freeze([
 Object.freeze({id:'standard',label:'Standard',settings:null}),
 Object.freeze({id:'rhythm',label:'Rythme',settings:Object.freeze({sequenceMs:48,seekWindowMs:12,overlapMs:8,quickSeek:false})})
]);
export const keyLockProfile=value=>keyLockProfiles.find(profile=>profile.id===value)||keyLockProfiles[0];
