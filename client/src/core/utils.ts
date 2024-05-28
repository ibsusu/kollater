export const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
import {
  toByteArray as b64ToBytes, 
  // fromByteArray as bytesTob64
} from 'base64-js';

export const slogans = {
  "collect": [
    "Kumulate",
    "Kollekt",
    "Kompile"
  ],
  "organize": [
    "Kategorize",
    "Katolog",
    "Kurate"
  ],
  "communicate": [
    "Kommunikate",
    "Kaskade",
    "Konvey"
  ]
}

export const slogan = () => `${slogans.collect[Math.floor(Math.random() * (slogans.collect.length-1))]}, ${slogans.organize[Math.floor(Math.random() * (slogans.organize.length-1))]}, ${slogans.communicate[Math.floor(Math.random() * (slogans.communicate.length-1))]}`;

export function getMinumTextureSize(arraySize: number){
  return Math.pow(2, Math.ceil(Math.log(Math.ceil(Math.sqrt(arraySize))) / Math.LN2));
}
async function destroyDB() {
  clearDirectory(await navigator.storage.getDirectory());
}

async function clearDirectory(directoryHandle: FileSystemDirectoryHandle) {

  // Check if the handle has permission to read and write
  //@ts-ignore
  if ((await directoryHandle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
      // Request permission
      //@ts-ignore
      if ((await directoryHandle.requestPermission({ mode: 'readwrite' })) !== 'granted') {
          throw new Error('Permission to read and write the directory was not granted');
      }
  }

  // Create an async iterator to iterate over the files in the directory
  //@ts-ignore
  for await (const [name, entry] of directoryHandle.entries()) {
      if (entry.kind === 'file') {
          // Remove file
          await directoryHandle.removeEntry(name);
      } else if (entry.kind === 'directory') {
          // Optionally handle subdirectories
          // Use removeRecursively if available, or you might need to recursively clear the directory first
          if (entry.removeRecursively) {
              await entry.removeRecursively(); // This is non-standard but may be supported in some environments
          } else {
              await clearDirectory(entry); // Recursively clear subdirectory
              await directoryHandle.removeEntry(name, { recursive: true }); // Then remove it
          }
      }
  }
}
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));


import { RTC_MESSAGE_REASON as REASON } from './constants';

const decoder = new TextDecoder(); // bytes -> string
const encoder = new TextEncoder(); // string -> bytes

// export function bmsg(reason: REASON, data?: string|Uint8Array|Buffer){
//   if(!data) return new Uint8Array([reason]);
//   let outputData = data;
//   if(typeof data === 'string'){
//     outputData = encoder.encode(data);
//   }

//   const outputU8Array = new Uint8Array(1+outputData.length);
//   outputU8Array[0] = reason;
//   outputU8Array.set(outputData as Uint8Array|Buffer, 1);
//   return outputU8Array;
// }

export function bmsg(reason: REASON, ...dataArgs: (string | Uint8Array | Buffer | number)[]) {
  // If no additional data is provided, return a Uint8Array with only the reason
  if (dataArgs.length === 0) {
    return new Uint8Array([reason]);
  }

  // Initialize an array to hold all data to be concatenated
  let totalLength = 0;
  const encodedDataList: Uint8Array[] = dataArgs.map(data => {
    let encodedData: Uint8Array;
    if (typeof data === 'string') {
      encodedData = encoder.encode(data);
    } else if (typeof data === 'number') {
      if(data < 256 && data >= 0)
        encodedData = new Uint8Array([data]);
      else
        encodedData = numberToBytes(data);
    } else {
      encodedData = data instanceof Uint8Array ? data : new Uint8Array(data);
    }
    totalLength += encodedData.length;
    return encodedData;
  });

  // Create the output Uint8Array with the correct total length
  const outputU8Array = new Uint8Array(1 + totalLength);
  outputU8Array[0] = reason;

  // Set the data in the output array
  let offset = 1;
  for (const encodedData of encodedDataList) {
    outputU8Array.set(encodedData, offset);
    offset += encodedData.length;
  }

  return outputU8Array;
}

export function bytesToString(bytes: Uint8Array){
  return decoder.decode(bytes);
}

export function numberToBytes(num: number){
  const numBytes = new Uint8Array(8);
  const view = new DataView(numBytes.buffer);
  view.setBigUint64(0, BigInt(num), true); // true for little-endian
  return numBytes;
}

export async function importKeyFromBase64(base64: string): Promise<CryptoKey> {
  const keyBytes = b64ToBytes(base64);
  const importedKey = await crypto.subtle.importKey(
      'raw',
      keyBytes.buffer,
      { name: 'AES-GCM' },
      true,
      ['encrypt', 'decrypt']
  );
  return importedKey;
}

export function incrementIV(iv: Uint8Array): void {
  for (let i = iv.length - 1; i >= 0; i--) {
    if (iv[i] < 255) {
      iv[i]++;
      break;
    } else {
      iv[i] = 0;
    }
  }
}


//@ts-ignore
window.destroyDB = destroyDB;
destroyDB();