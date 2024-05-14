import { Communicator, type KPeer } from './src/comms';
import { Filer} from './src/filer';

console.log("commsworker!!", process.env.KOLLATOR_DOMAIN);
const WS_URL = "wss://"+ (process.env.KOLLATOR_DOMAIN);


class KWorker {
  comms: Communicator;
  filer: Filer;
  runPromise: Promise<any>;
  runResolver!: (value: any) => void;

  constructor(){
    console.log("new KWorker");
    this.filer = new Filer();
    this.comms = new Communicator(this.uploadHandler, this.downloadHandler);
    this.runPromise = new Promise(res => {
      this.runResolver = res;
    });
  }

  async uploadHandler(uploader: KPeer, data: Uint8Array) {
    // peerId: string, hash: string, start: number, end: number, length: number, data: Uint8Array
    console.log("handle upload", uploader.id);
  }

  async downloadHandler(downloader: KPeer, data: Uint8Array){
    console.log("handle download", downloader.id);
  }

  run(){
    return this.runPromise;
  }

}

async function main() {
  let mainWorker = new KWorker();

  await mainWorker.run();
}

await main();