// there can be multiple workers, we need to make sure they don't pull the same import down repeatedly.

import { TorrentMetadata, MetaData, FileState } from './fileTypes';
// import { blobHashToString } from './salt';
import {
  // toByteArray as b64ToBytes, 
  fromByteArray as bytesTob64
} from 'base64-js';

// we import in parallel dynamically so we hit cache for future instantiations of the worker.
// let saltPromise = import('./salt').then(mod => mod);
let comlinkPromise = import('comlink').then(mod => mod);

// await all of the imports here
// const { createKeyPair, decryptStringWithKey, decryptWithPassword, encryptStringWithKey, encryptWithPassword, getFingerprint, getFingerprintRaw, getPublicKeyName, hashToBytes, hashToString, randomNumber, randomString, signCombined, signDetached, verifyCombined, verifyDetached } = await saltPromise;
let Comlink = await comlinkPromise;


// may need these later
// const encoder = new TextEncoder(); // string -> bytes
// const decoder = new TextDecoder(); // bytes -> string, use utf-8

class CoreWorker {
  // getFingerprint = getFingerprint;
  // getFingerprintRaw = getFingerprintRaw;
  // getPublicKeyName = getPublicKeyName;
  // verifyDetached = verifyDetached;
  // encryptStringWithKey = encryptStringWithKey;
  // decryptStringWithKey = decryptStringWithKey;
  // hashToString = hashToString;
  // hashToString(message: Uint8Array){
  //   return hashToString(message);
  // }
  // blobHashToString = blobHashToString;
  id: number;

  constructor() {
    this.id = -1;
  }
  // async randomNumber (count=1){
  //   let rb = randomNumber(count);
  //   return Comlink.transfer(rb.buffer, [rb.buffer]);
  // }

  base58_map = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  //@ts-ignore
  to_base58 (B,A){var d=[],s="",i,j,c,n;for(i in B){j=0,c=B[i];s+=c||s.length^i?"":1;while(j in d||c){n=d[j];n=n?n*256+c:c;c=n/58|0;d[j]=n%58;j++}}while(j--)s+=A[d[j]];return s}
  //@ts-ignore
  from_b58 (S,A){var d=[],b=[],i,j,c,n;for(i in S){j=0,c=A.indexOf(S[i]);if(c<0)return undefined;c||b.length^i?i:b.push(0);while(j in d||c){n=d[j];n=n?n*58+c:c;c=n>>8;d[j]=n%256;j++}}while(j--)b.push(d[j]);return new Uint8Array(b)}
  
  // async randomString (size: number, count=1){
  //   let rb = randomString(size, count);
  //   return Comlink.transfer(rb, [rb.buffer]);
  // }

  concatByteArray(a: Uint8Array, b: Uint8Array) {
    let c = new Uint8Array(a.length + b.length);
    c.set(a);
    c.set(b, a.length);
    return c;
  }
  concatByteArray3(a: Uint8Array, b: Uint8Array, c: Uint8Array){
    let d = new Uint8Array(a.length + b.length + c.length);
    d.set(a);
    d.set(b, a.length);
    d.set(c, a.length+b.length);
    return d;
  }

  // async createKeyPair(name="", getFingerprint=false){
  //   if(getFingerprint){
  //     let {publicKey, privateKey} = createKeyPair(name, getFingerprint);
  //     let fingerprint = getFingerprintRaw(publicKey);
  //     return Comlink.transfer({publicKey, privateKey, fingerprint},
  //                           [publicKey.buffer, privateKey.buffer, fingerprint.buffer]);
  //   }
  //   let {publicKey, privateKey} = createKeyPair(name, getFingerprint);
  //   return Comlink.transfer({publicKey, privateKey},
  //                           [publicKey.buffer, privateKey.buffer]);
  // }

  // signCombined (message: Uint8Array, privateKey64: string) {
  //   let signedMessage = signCombined(message, privateKey64);
  //   return Comlink.transfer(signedMessage, [signedMessage.buffer]);
  // }

  // verifyCombined(signedMessage: Uint8Array, publicKey64: string) {
  //   let message = verifyCombined(signedMessage, publicKey64);
  //   if(message === null) return message;
  //   return Comlink.transfer(message, [message.buffer]);
  // }

  // signDetached (message: Uint8Array, privateKey64: string) {
  //   const signature = signDetached(message, privateKey64);
  //   return Comlink.transfer(signature, [signature.buffer]);
  // }

  // async encryptWithPassword (inBytes: Uint8Array, password: string){    
  //   const encryptedBytes = encryptWithPassword(inBytes, password);
  //   return Comlink.transfer([inBytes, encryptedBytes], [inBytes.buffer, encryptedBytes.buffer]);
  // };

  // async decryptWithPassword (inBytes: Uint8Array, password: string){
  //   const decryptedBytes = decryptWithPassword(inBytes, password);
  //   return Comlink.transfer([inBytes, decryptedBytes], [inBytes.buffer, decryptedBytes.buffer]);
  // };

  // hashToBytes(inBytes: Uint8Array){
  //   console.log({id: this.id});
  //   const hashBytes = hashToBytes(inBytes);
  //   return Comlink.transfer([hashBytes], [hashBytes.buffer]);
  // }

  test(){
    return "test";
  }

  async init(id: number){
    console.log("initializing worker:", id);
    this.id = id;
    return true;
  }

  getProps() {
    return Object.getOwnPropertyNames(Object.getPrototypeOf(this)).concat(Object.getOwnPropertyNames(this));
  }

  async * streamFileInChunks(file: File, chunkSize: number): AsyncGenerator<Uint8Array, void, unknown> {
    console.log({file});
    const reader = file.stream().getReader();
    let position = 0;
    let carryOver = new Uint8Array();

    while (position < file.size) {
      const { value, done } = await reader.read();
      if (done) {
        if (carryOver.byteLength > 0) {
          yield carryOver;
        }
        break;
      }

      let chunk = new Uint8Array(carryOver.byteLength + value.byteLength);
      chunk.set(carryOver);
      chunk.set(value, carryOver.byteLength);

      while (chunk.byteLength >= chunkSize) {
        const piece = chunk.subarray(0, chunkSize);
        yield piece;
        chunk = chunk.subarray(chunkSize);
      }

      console.log("setting carryOver", {chunk});
      carryOver = chunk;
      position += value.byteLength;
    }
    yield carryOver;
  }

  async processFile([file, directory]: [File, FileSystemDirectoryHandle]): Promise<MetaData> {
    const sha1Hashes: Uint8Array[] = [];
    const sha256Hashes: Uint8Array[] = [];
    const chunkLength = 5242880; //5*1024*1024;
    console.log("processing", {file, directory});
    let key = crypto.getRandomValues(new Uint8Array(16));
    // let iv = crypto.getRandomValues(new Uint8Array(16));
    let keyEncoded = await crypto.subtle.importKey('raw', key.buffer, {
        name: 'AES-CTR'
    }, true, ['encrypt', 'decrypt']);
    let exportedKey = await crypto.subtle.exportKey('raw', keyEncoded);

    for await (const chunk of this.streamFileInChunks(file, chunkLength)) {
        // const cipherText = await crypto.subtle.encrypt({name: 'AES-CTR',counter: iv, length: 128}, keyEncoded, chunk);
        // const cipherArray = new Uint8Array(cipherText);
        // Hash the chunk with SHA-1 and SHA-256 using the Web Crypto API
        const sha1Hash = await crypto.subtle.digest('SHA-1', chunk);
        const sha256Hash = await crypto.subtle.digest('SHA-256', chunk);
        sha1Hashes.push(new Uint8Array(sha1Hash));
        sha256Hashes.push(new Uint8Array(sha256Hash));
    }

    let merkleTree = await this.calculateFullMerkleTree(sha256Hashes);

    const sha1String = sha1Hashes.reduce((acc, hash) => acc+bytesTob64(hash), '');    
    const flatMerkleStrings: string[] = [];

    for(let layer of merkleTree){
      for(let hash of layer){
        flatMerkleStrings.push(bytesTob64(hash));
      }
    }

    //@ts-ignore
    let rootHash = flatMerkleStrings.at(-1);

    let metadata = this.createTorrentMetaData(file.name, file.size, sha1String, flatMerkleStrings);
    await this.writeFileAndTorrent(directory, rootHash, file, metadata);
    console.log({rootHash, sha1Hashes, sha256Hashes, merkleTree, flatMerkleStrings});
    let metadataLite: MetaData = {
      state: FileState.Cached,
      fileType: file.type.length > 0? file.type : file.name.slice(Math.min(file.name.lastIndexOf('.')+1, file.name.length-1)),
      name: file.name,
      hash: rootHash,
      size: file.size,
      key: bytesTob64(new Uint8Array(exportedKey))
    }
    return metadataLite;
  }

  async writeFileAndTorrent(directory: FileSystemDirectoryHandle, fileName: string, file: File, metadata: TorrentMetadata){
    const fileHandle = await directory.getFileHandle(fileName, {create: true});
    const writableStream = await fileHandle.createWritable();
    await writableStream.write(file);
    await writableStream.close();

    const metadataHandle = await directory.getFileHandle(fileName+'torrent', {create: true});
    const metastream = await metadataHandle.createWritable();
    await metastream.write(JSON.stringify(metadata));
    await metastream.close();
  }

  createTorrentMetaData(fileName: string, fileSize: number, sha1String: string, merkleTreeStrings: string[]): TorrentMetadata {
    return {
      announce: "http://tracker.kollator.com/announce",
      "announce-list": [
        ["http://tracker.kollator.com/announce"],
        ["udp://tracker.kollator.com:80/announce"],
        ["https://kollater.com/announce"]
      ],
      comment: "(^o^)/",
      "created by": "Kollator",
      "creation date": Date.now(),
      info: {
        name: fileName,
        "piece length": 5*1024*1024,
        pieces: sha1String,
        "meta version": 2,
        "file tree": {
          [fileName]: {
            "": {
              length: fileSize,
              "pieces root": `urn:btmh:${merkleTreeStrings[merkleTreeStrings.length-1]}`
            }
          }
        },
        layers: {
          [`urn:btmh:${merkleTreeStrings[merkleTreeStrings.length-1]}`]: {
            hashes: merkleTreeStrings
          }
        }
      }
    };
  }

  async calculateFullMerkleTree(hashes: Uint8Array[]): Promise<Uint8Array[][]> {
    let tree: Uint8Array[][] = [hashes]; // Initialize the tree with the leaf level.
    while (hashes.length > 1) {
      const newLevel: Uint8Array[] = [];
      for (let i = 0; i < hashes.length; i += 2) {
        const left = hashes[i];
        const right = i + 1 < hashes.length ? hashes[i + 1] : left;
        const combined = new Uint8Array(left.length + right.length);
        combined.set(left);
        combined.set(right, left.length);

        const newHash = await crypto.subtle.digest('SHA-256', combined);
        newLevel.push(new Uint8Array(newHash));
      }
      tree.push(newLevel); // Add the new level to the tree.
      hashes = newLevel; // Move up one level in the tree.
    }
    return tree; // Return the full tree, including all levels.
  }


}

///////////////////////////// worker system setup //////////////////////////////

let worker = new CoreWorker();
export {CoreWorker};
Comlink.expose(worker);
self.postMessage("ready");