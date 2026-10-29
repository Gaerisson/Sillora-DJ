import {Worker} from 'node:worker_threads';
export class NodeStemWorker{
 constructor(){this.worker=new Worker(new URL('./stem-worker-node.mjs',import.meta.url));this.worker.on('message',data=>this.onmessage?.({data}));this.worker.on('error',error=>this.onerror?.(error));}
 postMessage(value,transfer){this.worker.postMessage(value,transfer);}
 terminate(){this.worker.terminate();}
}
