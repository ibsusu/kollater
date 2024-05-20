import { Communicator, type KPeer } from './src/comms';
import { dirGeneral, RTC_MESSAGE_REASON as REASON } from './src/constants';
import { Filer} from './src/filer';
import {
  // toByteArray as b64ToBytes, 
  fromByteArray as bytesTob64,
  fromByteArray
} from 'base64-js';
import { bmsg as b } from './src/utils';


console.log("commsworker!!", process.env.KOLLATOR_DOMAIN);
const WS_URL = "wss://"+ (process.env.KOLLATOR_DOMAIN);

console.log("DIRECTORYGENERAL", {dirGeneral})
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
    console.log("handle upload", uploader.id, data);
    let hash = data.slice(0,32);
    let hashString = fromByteArray(hash);
    // const sizeBytes = data.slice(32, 40);
    // const size = new DataView(sizeBytes.buffer).getBigUint64(0, true); // true for little-endian
    
    await Bun.write(`${dirGeneral}/${hashString}`, data);
    uploader.send(b(REASON.UPLOAD_RESPONSE, 1));
  }

  async downloadHandler(downloader: KPeer, data: Uint8Array){
    console.log("handle download", downloader.id);

    // Extract the hash from the incoming data (first 32 bytes)
    const hash = data.slice(0, 32);
    const hashString = fromByteArray(hash);

    // Construct the file path
    const filePath = `${dirGeneral}/${hashString}`;

    try {
      // Read the file as Uint8Array
      const fileData = await Bun.file(filePath);

      // Send the file data back to the downloader
      downloader.send(b(REASON.DOWNLOAD_RESPONSE, new Uint8Array(await fileData.arrayBuffer())));
    } catch (error) {
      console.error("Error reading file:", error);
      // Handle the error (e.g., send an error message to the downloader)
    }
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