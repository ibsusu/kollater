import * as Comlink from "comlink";
import { transferHandlers } from 'comlink';

import {type CoreWorker} from './worker';
export {type CoreWorker} from './worker';
import { isSafari } from "./utils";
import CoreWebWorker from './worker?worker';
import {comms} from './comms';
import { filer } from "./fileStore";
import { useEffect, useState } from "preact/hooks";
import { startMainPage, startWorker } from "./glitzUIThread";
import { asyncGeneratorTransferHandler } from "./comlink-async-generator-handler";
import { audioController } from "./audioController";

transferHandlers.set('asyncGenerator', asyncGeneratorTransferHandler);

let workerReady = false;
let initializedEvent = new Event('initialized');
let workManager:  CoreWorker;
const fullWorkerCount = isSafari ? 8 : (window.navigator.hardwareConcurrency > 1)? window.navigator.hardwareConcurrency : 5;
let workers: Comlink.Remote<CoreWorker>[] = [];
let readyPromise!: Promise<void>;
let readyResolver!: (value: void | PromiseLike<void>) => void;
comms.test();

async function initWorkers(){
  for (let i=0;i<fullWorkerCount;++i){
    if(readyPromise) {
      await readyPromise;
    }
    let w = new CoreWebWorker();

    let worker = Comlink.wrap<CoreWorker>(w);
    workers.push(worker);

    if(readyPromise === undefined) {
      readyPromise = new Promise(res => {
        readyResolver = res;
      });
    }

    w.onmessage = (event) => {
      if(event.data === 'ready') {
        if(!workerReady){
          // The reason we're checking if the first worker is ready
          // is to make sure that before we try to create any more workers
          // we've cached the first worker's script imported scripts.  
          // otherwise it will download them in parallel which wastes tons of bandwidth
          workerReady = true;
          readyResolver();
        }

        worker.init(i);
      }
    }
  }
  workManager = new WorkManager(workers) as unknown as CoreWorker;
}

// this is an example of worker initialization outside of the above worker loop.
// webrtc doesn't worker inside of webwoerkers currently so this one is pointless.
// export async function initCommsWorker() {
//   console.log("commsworker init");
//   let w = new CommsWebWorker();
//   let worker = Comlink.wrap<CommsWorker>(w);
//   let resolver: ((value: CommsWorker | PromiseLike<CommsWorker>) => void);
//   let promise = new Promise<CommsWorker>(res => {
//     resolver = res;
//   });

//   console.log("after commsworker promise");
//   w.onmessage = (event) => {
//     console.log("commsworker message");
//     if(event.data === 'ready') {
//       if(!workerReady){
//         workerReady = true;
//         //@ts-ignore
//         resolver<CommsWorker>(worker);
//       }
//     }
//   }
//   console.log("initialized comms worker");
//   return promise; 
// }
//---------

class WorkManager {
  workers: Comlink.Remote<CoreWorker>[];
  rrIndex: number;
  workerCount: number;
  constructor(workers: Comlink.Remote<CoreWorker>[]){
    this.workers = workers;
    this.rrIndex = 0;
    this.workerCount = workers.length;
  }
  async init() {
    let props = await this.workers[0].getProps();
    //@ts-ignore
    props.filter(prop => typeof this.workers[0][prop] === 'function' && prop !== 'constructor' && prop !== 'init' && prop !== 'getProp')
      .forEach(method => {
        //@ts-ignore
        if (!this[method]) {
          //@ts-ignore
          this[method] = (...args) => {
            this.rrIndex %= this.workerCount;

            //@ts-ignore
            return this.workers[this.rrIndex++][method](args);
          }
        }
      });
  }
}

async function initGlitz(messagePort: MessagePort) {
  const canvas: any = document.querySelector('#glitz');
  
  if (canvas.transferControlToOffscreen) {
    startWorker(canvas, messagePort);
  } else {
    startMainPage(canvas, messagePort);
  }
}


export async function init() {
  const channel = new MessageChannel();
  initGlitz(channel.port1);
  await audioController.init(undefined, channel.port2);
  
  await initWorkers();
  // console.log({workManager});
  await (workManager as unknown as WorkManager).init();
  
  // console.log("workmanager properties", Object.getOwnPropertyNames(workManager));
  // await workManager.hashToString(new Uint8Array([0]));
  await filer.init((workManager as CoreWorker));
  comms.test();
  window.dispatchEvent(initializedEvent);
}



export function useCore() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const handleInitialized = () => {
      setInitialized(true);
    };

    window.addEventListener('initialized', handleInitialized);

    return () => {
      window.removeEventListener('initialized', handleInitialized);
    }
  }, []);

  return initialized;
}