export const STEM_LIMITS=Object.freeze({duration:480,waveBytes:256*1024*1024,decodedBytes:1024*1024*1024,threads:[1,2,4],memoryMiB:[256,512,1024],timeoutMinutes:[30,90,180]});
export function stemOptions(value={}){return{cpuThreads:STEM_LIMITS.threads.includes(value?.cpuThreads)?value.cpuThreads:2,memoryMiB:STEM_LIMITS.memoryMiB.includes(value?.memoryMiB)?value.memoryMiB:512,timeoutMinutes:STEM_LIMITS.timeoutMinutes.includes(value?.timeoutMinutes)?value.timeoutMinutes:90};}
export function checkedStemOptions(value={}){if(!value||typeof value!=='object'||Array.isArray(value)||'cpuThreads'in value&&!STEM_LIMITS.threads.includes(value.cpuThreads)||'memoryMiB'in value&&!STEM_LIMITS.memoryMiB.includes(value.memoryMiB)||'timeoutMinutes'in value&&!STEM_LIMITS.timeoutMinutes.includes(value.timeoutMinutes))throw Error('Budget stems invalide.');return stemOptions(value);}
export function stemBudget(buffer,outputRate=buffer.sampleRate,options={}){
 const {length,sampleRate,numberOfChannels}=buffer,settings=checkedStemOptions(options);
 if(!Number.isInteger(length)||length<=0||!Number.isInteger(sampleRate)||sampleRate<22050||sampleRate>96000||![1,2].includes(numberOfChannels)||!Number.isInteger(outputRate)||outputRate<22050||outputRate>96000)throw Error('Audio mono ou stéréo entre 22,05 et 96 kHz requis.');
 if(length/sampleRate>STEM_LIMITS.duration)throw Error('La préparation des stems est limitée à 8 minutes par morceau.');
 if(buffer.duration!==undefined&&(!Number.isFinite(buffer.duration)||Math.abs(buffer.duration-length/sampleRate)>1/sampleRate))throw Error('Durée audio incohérente.');
 const waveBytes=44+length*8,frames=Math.round(length*outputRate/sampleRate),decodedBytes=frames*32;
 if(waveBytes>STEM_LIMITS.waveBytes)throw Error('Audio trop volumineux pour la préparation des stems (256 Mio maximum).');
 if(decodedBytes>settings.memoryMiB*1024*1024)throw Error('Ce titre nécessite '+Math.ceil(decodedBytes/1024/1024)+' Mio de stems décodés ; budget '+settings.memoryMiB+' Mio. Augmentez le budget dans les réglages Stems.');
 return{...settings,waveBytes,decodedBytes,frames,sampleRate:outputRate,duration:length/sampleRate};
}
export function effectiveStemThreads(requested=2,parallelism=2){return Math.max(1,Math.min(requested,4,Math.max(1,parallelism-1)));}
export function stemProgressLabel(state={}){const labels={copying:'Copie audio',encoding:'Préparation du WAV',loading:'Ouverture du moteur',model:'Chargement du modèle',separating:'Séparation',writing:'Enregistrement local',verifying:'Vérification du cache',decoding:'Lecture des stems',envelopes:'Analyse des stems',assembling:'Assemblage'};return(labels[state.stage]||'Préparation')+(Number.isFinite(state.percent)?' · '+Math.round(Math.max(0,Math.min(100,state.percent)))+' %':'');}
