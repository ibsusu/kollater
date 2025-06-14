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
  simpleMode: boolean = false; // Disable simple mode to test WebRTC upload workflow

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
    
    // Always try to upload (both simple and full mode)
    await this.uploadFile(metaData.hash);
  }

  async uploadFile(fileHash: string) {
    console.log("Starting upload for file hash:", fileHash);

    try {
      const rootDirectory = await navigator.storage.getDirectory();
      
      // Check if we're in simple mode
      if (this.simpleMode) {
        console.log("Simple mode upload - sending file directly");
        
        // In simple mode, just send the file directly
        const fileHandle = await rootDirectory.getFileHandle(fileHash);
        const file = await fileHandle.getFile();
        const fileData = new Uint8Array(await file.arrayBuffer());
        
        // Create hash for the file
        const buffer = new ArrayBuffer(fileData.length);
        const view = new Uint8Array(buffer);
        view.set(fileData);
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hash = new Uint8Array(hashBuffer);
        
        this.dispatch('uploadingFile');
        
        // Upload the file data directly
        const uploadResponse = await comms.upload(hash, fileData as Uint8Array);
        const success = uploadResponse && uploadResponse[0] === 1;
        
        if (success) {
          console.log("Simple mode upload successful");
          this.dispatch('uploadedFile');
        } else {
          console.error("Simple mode upload failed");
          this.dispatch('filererror');
        }
        return;
      }

      // Full mode upload with torrent processing using new streaming protocol
      // Sanitize filename for OPFS compatibility
      const safeFileHash = fileHash
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
        .replace(/[^a-zA-Z0-9\-_]/g, '');
      const metadataHandle = await rootDirectory.getFileHandle(safeFileHash + 'torrent');
      const metadataFile = await metadataHandle.getFile();
      const fileHandle = await rootDirectory.getFileHandle(fileHash);
      const file = await fileHandle.getFile();

      let metadataString = await metadataFile.text();
      const metadata = JSON.parse(metadataString) as unknown as TorrentMetadata;
      
      console.log("Full mode streaming upload", { metadata, fileSize: file.size });
      
      // Create torrent hash from metadata
      const metadataBytes = new TextEncoder().encode(metadataString);
      const torrentHash = new Uint8Array(await crypto.subtle.digest('SHA-256', metadataBytes));
      
      this.dispatch('uploadingFile');
      
      try {
        // Use new streaming upload protocol
        await comms.streamUpload(torrentHash, metadata, file);
        console.log("Streaming upload completed successfully");
        this.dispatch('uploadedFile');
      } catch (error) {
        console.error("Streaming upload failed:", error);
        this.dispatch('filererror');
        return;
      }
      
    } catch (error) {
      console.error("Upload failed with error:", error);
      this.dispatch('filererror');
    }
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
  const [files, setFiles] = useState<MetaData[]>([]);

  useEffect(() => {
    const handleimportedFile = () => {
      if (filer.db && filer.db.files) {
        setFiles(Array.from(filer.db.files.values()));
      }
    };

    // Initialize files if filer is already ready
    if (filer.db && filer.db.files) {
      setFiles(Array.from(filer.db.files.values()));
    }

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
