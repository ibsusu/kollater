import { useEffect, useState } from 'preact/hooks';
import { Database, MetaData, TorrentMetadata } from './fileTypes';
import {type CoreWorker } from './core';
import { comms } from './comms';
import {
  toByteArray as b64ToBytes, 
  fromByteArray as bytesTob64
} from 'base64-js';
import { importKeyFromBase64, incrementIV } from './utils';
import { simpleFileProcessor } from './simpleFileProcessor';

const eventNames = [
  'stagedFiles',
  'importingFile',
  'importedFile',
  'deletedFile',
  'uploadingFile',
  'uploadedFile',
  'remotelyDeletedFile',
  'reportedFile',
  'filererror'
];

// Rules for using the Filer.
// Filer is a singleton
// filer is read from directly by components outside of the react lifecycle
// in the above case, you should subscribe to changes by addEventListener
// filer is read from the useFiler hook within the react lifecycle
// filer is never modified directly, you can only call its methods for modifications
export class Filer {
  events: Map<string, Event>;
  db!: Database;
  initPromise!: Promise<void>;
  initResolver!: (value: void | PromiseLike<void>) => void;
  worker!: CoreWorker; // singleton
  clock?: number;
  simpleMode: boolean = true; // Enable simple mode by default for testing

  constructor() {
    this.events = new Map<string, Event>();
    this.clock;
    eventNames.forEach(name => this.events.set(name, new Event(name)));
  }
  
  async init(worker: CoreWorker) {
    this.worker = worker; // must initialize here
    this.initPromise = new Promise((res) => {this.initResolver = res});
    let directory = await navigator.storage.getDirectory();

    let dbHandle = await directory.getFileHandle("kollatorDb", {create: true});
    if(!dbHandle) return {handle: dbHandle, files: new Map<string, MetaData>(), name: 'Anon', email: 'anon@kollator.com', password: 'password123lol', provider: 'email'};
    let dbFile = await dbHandle.getFile();
    let dbJSON = await dbFile.text();

    try {
      this.db = JSON.parse(dbJSON);
      let fileEntries = this.db.files as unknown as [string, MetaData][];
      this.db.files = new Map<string, MetaData>();
      fileEntries.forEach(([key, val]) => this.db.files.set(key, val));
    }
    catch{
      this.db = {handle: dbHandle, files: new Map<string, MetaData>(), name: 'Anon', email: 'anon@kollator.com', password: 'password123lol', provider: 'email'};
    }
    if(!this.db) this.db = {handle: dbHandle, files: new Map<string, MetaData>(), name: 'Anon', email: 'anon@kollator.com', password: 'password123lol', provider: 'email'};
    this.db.handle = dbHandle;
    await this.save();

    this.initResolver();
  }

  dispatch(eventName: string){
    window.dispatchEvent(this.events.get(eventName)!);
  }

  async load() {

  }

  async unload() {
  }

  async save() {
    if(!this.db.handle.createWritable) return;
    const dbWriteStream = await this.db.handle.createWritable();
    await dbWriteStream.write(JSON.stringify({...this.db, files: Array.from(this.db.files.entries())}));
    await dbWriteStream.close();
  }

  async importFile(file: File, destinationDirectoryId?: string) {
    if(!this.clock) this.clock = Date.now();

    const rootDirectory = await navigator.storage.getDirectory()
    const destinationDirectory = destinationDirectoryId? await rootDirectory.getDirectoryHandle(destinationDirectoryId) : rootDirectory;
    
    let metaData: MetaData;
    
    if (this.simpleMode) {
      // Use simple file processing without torrent creation
      metaData = await simpleFileProcessor.processFileSimple(file, destinationDirectory);
    } else {
      // Use full torrent-based processing
      //@ts-ignore
      metaData = await this.worker.processFile(file, destinationDirectory);
    }
    
    let totalTime = Date.now() - this.clock!;
    console.log("elapsed time:", totalTime, "bytes:", file.size);
    console.log({metaData});
    this.db.files.set(metaData.hash, metaData);    
    await this.save();
    this.dispatch('importedFile');
    
    // Skip upload in simple mode
    if (!this.simpleMode) {
      await this.uploadFile(metaData.hash);
    }
  }

  async uploadFile(fileHash: string) {
    console.log({fileHash});

    // get the torrent data, do some funny crypto stuff
    // send it to a peer who then sends it to s3
    const rootDirectory = await navigator.storage.getDirectory();
    const metadataHandle = await rootDirectory.getFileHandle(fileHash+'torrent');
    const metadataFile = await metadataHandle.getFile();
    const fileHandle = await rootDirectory.getFileHandle(fileHash);
    const file = await fileHandle.getFile();

    const chunkLength = 5*1024**2;
    let metadataBytes = new Uint8Array(await metadataFile.arrayBuffer());
    let metadataString = await metadataFile.text();
    const metadata = JSON.parse(metadataString) as unknown as TorrentMetadata;
    // metadataFiles are below 5MiB right now
    console.log("filestoreupload", {metadata, metadataBytes});
    let metadataHash = await crypto.subtle.digest('SHA-256', metadataBytes);
    let metadataHashString = bytesTob64(new Uint8Array(metadataHash));
    // AES-GCM requires a key and a nonce.  it's ok if the nonces are sequential, they just can't be reused.
    // the initial nonce is used for the metadata.  
    const key = await importKeyFromBase64(metadata.info.key); 
    const iv = b64ToBytes(metadata.info.iv);
    this.dispatch('uploadingFile');
    // this should only fire once, since the file is always smaller than 5MiB
    // @ts-ignore
    for await (const chunk of await this.worker.encryptFileForUpload(metadataFile, chunkLength, [metadataHashString], key, iv)){
      let chunkHash = await crypto.subtle.digest('SHA-256', chunk);
      console.log("uploading chunkHash:", bytesTob64(new Uint8Array(chunkHash)), chunkHash.byteLength);
      let uploadResponse = await comms.upload(new Uint8Array(chunkHash), chunk);
      let ok = uploadResponse[0];
      if(!ok) {
        this.dispatch('error');
        console.error("couldn't upload the metadata file");
        return;
      }
    }
    
    //---- the metadata file is uploaded so now let's actually upload the file
    let merkleHashStrings = Object.values(metadata.info.layers)[0].hashes;
    let chunkIndex = 0;
    let ivInc = iv.slice();

    incrementIV(ivInc); // must increment, no reuse.
    //@ts-ignore
    for await (const chunk of await this.worker.encryptFileForUpload(file, chunkLength, merkleHashStrings, key, ivInc)){
      // we hash the encrypted file chunk
      let chunkHash = await crypto.subtle.digest('SHA-256', chunk);
      // let hash = new Uint8Array(await crypto.subtle.digest('SHA-256',b64ToBytes(merkleHashStrings[chunkIndex])));
      //@ts-ignore
      let uploadResponse = await comms.upload(new Uint8Array(chunkHash), chunk.length, chunk); // TODO NOT DONE YET
      let ok = uploadResponse[0];
      if(!ok) console.error(`upload of file ${file.name} failed, chunk index: ${chunkIndex}`);
    }

    // ok we're done
    this.dispatch('uploadedFile')
  }

  async exportFile(fileHash: string){
    try{
      let directory = await navigator.storage.getDirectory();
      const hash: string = await this.db.files.get(fileHash)?.hash ?? '';
      let fileHandle = await directory.getFileHandle(hash,{create: false});
      let file = await fileHandle.getFile();
      let metadata = this.db.files.get(fileHash);
      console.log({file})

      const blob = new Blob([await file.arrayBuffer()], { type: file.type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      //@ts-ignore
      a.download = metadata?.name; // Set the default filename for the download
      document.body.appendChild(a); // Append the anchor to the body to ensure it's in the document
      a.click(); // Simulate a click on the anchor
      a.remove(); // Clean up the DOM
  
      // Step 5: Revoke the blob URL to free up resources
      URL.revokeObjectURL(url);
    }
    catch(e){
      console.error(e);
      this.dispatch('error');
    }
  }
}

export const filer = new Filer();
// window.addEventListener('load', filer.init);

export const useFiler = () => {
  const [files, setFiles] = useState<MetaData[]>(Array.from(filer.db.files.values()));

  useEffect(() => {
    const handleimportedFile = () => {
      setFiles(Array.from(filer.db.files.values()));
    };

    window.addEventListener('importedFile', handleimportedFile);
    return () => {
      window.removeEventListener('importedFile', handleimportedFile);
    }
  }, []);
  // console.log("all files", {files});
  return files;
}

//@ts-ignore
window.filer = filer;
