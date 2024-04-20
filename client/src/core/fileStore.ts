import { useEffect, useState } from 'preact/hooks';
import { Database, MetaData } from './fileTypes';
import {type CoreWorker } from './core';


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
    const dbWriteStream = await this.db.handle.createWritable();
    await dbWriteStream.write(JSON.stringify({...this.db, files: Array.from(this.db.files.entries())}));
    await dbWriteStream.close();
  }

  async importFile(file: File, destinationDirectoryId?: string) {
    if(!this.clock) this.clock = Date.now();

    const rootDirectory = await navigator.storage.getDirectory()
    const destinationDirectory = destinationDirectoryId? await rootDirectory.getDirectoryHandle(destinationDirectoryId) : rootDirectory;
    //@ts-ignore
    let metaData = await this.worker.processFile(file, destinationDirectory);
    let totalTime = Date.now() - this.clock!;
    console.log("elapsed time:", totalTime, "bytes:", file.size);
    console.log({metaData});
    this.db.files.set(metaData.hash, metaData);    
    await this.save();
    this.dispatch('importedFile');
  }


  async uploadFile(fileHash: string) {
    console.log({fileHash});
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
  console.log("all files", {files});
  return files;
}

//@ts-ignore
window.filer = filer;