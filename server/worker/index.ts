import { Communicator } from './src/comms';
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
    this.comms = new Communicator();
    // this.comms.on('upload', this.uploadHandler);
    // this.comms.on('download', this.downloadHandler);
    this.filer = new Filer();
    this.runPromise = new Promise(res => {
      this.runResolver = res;
    });
  }

  async uploadHandler(ip: string, hash: string, start: number, end: number, length: number, data: Uint8Array) {
      
  }

  async downloadHandler(ip: string, hash: string){

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