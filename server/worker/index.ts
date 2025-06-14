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
    this.comms = new Communicator(this.uploadHandler, this.downloadHandler, this.filer);
    this.runPromise = new Promise(res => {
      this.runResolver = res;
    });
  }

  async uploadHandler(uploader: KPeer, data: Uint8Array) {
    // peerId: string, hash: string, start: number, end: number, length: number, data: Uint8Array
    console.log("handle upload", uploader.id, "data size:", data.length);
    let hash = data.slice(0,32);
    let hashString = fromByteArray(hash);
    let fileData = data.slice(32); // The actual file content after the hash
    
    // Determine if this is torrent metadata or a file chunk based on size and content
    let isMetadata = false;
    
    try {
      // Try to parse as JSON to detect torrent metadata
      const textContent = new TextDecoder().decode(fileData);
      const parsed = JSON.parse(textContent);
      
      // Check if it has torrent metadata structure
      if (parsed.info && parsed.info['kollator-chunk-size'] && parsed.info['kollator-chunk-hashes']) {
        isMetadata = true;
        console.log("Detected torrent metadata upload");
      }
    } catch (e) {
      // Not JSON, likely a binary chunk
      console.log("Detected file chunk upload");
    }
    
    // Create directories if they don't exist
    const chunksDir = `${dirGeneral}/chunks`;
    const torrentsDir = `${dirGeneral}/torrents`;
    
    try {
      await Bun.write(`${chunksDir}/.keep`, ''); // Ensure chunks directory exists
    } catch (e) {
      // Directory creation handled by Bun.write
    }
    
    try {
      await Bun.write(`${torrentsDir}/.keep`, ''); // Ensure torrents directory exists  
    } catch (e) {
      // Directory creation handled by Bun.write
    }
    
    // Store in appropriate directory
    let filePath: string;
    if (isMetadata) {
      filePath = `${torrentsDir}/${hashString}`;
      console.log("Storing torrent metadata:", filePath);
    } else {
      filePath = `${chunksDir}/${hashString}`;
      console.log("Storing file chunk:", filePath);
    }
    
    await Bun.write(filePath, fileData);
    console.log("Successfully stored upload:", filePath, "size:", fileData.length);
    
    // Also store to S3 for persistence
    try {
      await this.filer.toDisk(hashString, new Blob([fileData]));
      await this.filer.toS3(hashString);
      console.log("Successfully uploaded to S3:", hashString);
    } catch (s3Error) {
      console.error("S3 upload failed:", s3Error);
      // Continue anyway - local storage succeeded
    }
    
    // Send success response with verification data
    const responseData = new Uint8Array(33);
    responseData[0] = 1; // Success indicator
    responseData.set(hash, 1); // Echo back the hash for verification
    uploader.send(b(REASON.UPLOAD_RESPONSE, responseData));
  }

  async downloadHandler(downloader: KPeer, data: Uint8Array){
    console.log("handle download", downloader.id);

    // Extract the hash from the incoming data (first 32 bytes)
    const hash = data.slice(0, 32);
    const hashString = fromByteArray(hash);

    // Try to find the file in chunks or torrents directories
    const chunkPath = `${dirGeneral}/chunks/${hashString}`;
    const torrentPath = `${dirGeneral}/torrents/${hashString}`;
    const legacyPath = `${dirGeneral}/${hashString}`; // Fallback for old files

    let filePath: string | null = null;
    
    try {
      // Check chunks directory first
      const chunkFile = Bun.file(chunkPath);
      if (await chunkFile.exists()) {
        filePath = chunkPath;
        console.log("Found file in chunks:", filePath);
      }
    } catch (e) {
      // File doesn't exist in chunks
    }
    
    if (!filePath) {
      try {
        // Check torrents directory
        const torrentFile = Bun.file(torrentPath);
        if (await torrentFile.exists()) {
          filePath = torrentPath;
          console.log("Found file in torrents:", filePath);
        }
      } catch (e) {
        // File doesn't exist in torrents
      }
    }
    
    if (!filePath) {
      try {
        // Check legacy location
        const legacyFile = Bun.file(legacyPath);
        if (await legacyFile.exists()) {
          filePath = legacyPath;
          console.log("Found file in legacy location:", filePath);
        }
      } catch (e) {
        // File doesn't exist anywhere
      }
    }

    if (filePath) {
      try {
        // Read the file as Uint8Array
        const fileData = await Bun.file(filePath);
        const arrayBuffer = await fileData.arrayBuffer();

        // Send the file data back to the downloader
        downloader.send(b(REASON.DOWNLOAD_RESPONSE, new Uint8Array(arrayBuffer)));
        console.log("Successfully sent file:", filePath, "size:", arrayBuffer.byteLength);
      } catch (error) {
        console.error("Error reading file:", error);
        // Send error response
        downloader.send(b(REASON.DOWNLOAD_RESPONSE, new Uint8Array([0]))); // Error indicator
      }
    } else {
      console.error("File not found:", hashString);
      // Send error response
      downloader.send(b(REASON.DOWNLOAD_RESPONSE, new Uint8Array([0]))); // Error indicator
    }
  }

  run(){
    return this.runPromise;
  }

}

async function main() {
  let mainWorker = new KWorker();

  // Add a simple HTTP server for testing uploads
  const server = Bun.serve({
    port: 3001,
    async fetch(req) {
      if (req.method === 'POST' && req.url.endsWith('/upload')) {
        try {
          const data = new Uint8Array(await req.arrayBuffer());
          console.log("HTTP upload received, data size:", data.length);
          
          // Call the upload handler directly
          const mockPeer = {
            id: 'http-test',
            send: (response: Uint8Array) => {
              console.log("Upload response:", response);
            }
          } as any;
          
          await mainWorker.uploadHandler(mockPeer, data);
          
          return new Response('Upload successful', { status: 200 });
        } catch (error) {
          console.error("HTTP upload error:", error);
          return new Response('Upload failed', { status: 500 });
        }
      }
      
      if (req.method === 'GET' && req.url.endsWith('/status')) {
        return new Response('Worker is running', { status: 200 });
      }
      
      return new Response('Not found', { status: 404 });
    },
  });
  
  console.log(`Worker HTTP server running on port 3001`);

  await mainWorker.run();
}

await main();
