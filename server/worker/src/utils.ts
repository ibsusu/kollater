import exp from 'constants';
import { RTC_MESSAGE_REASON as REASON } from './constants';
import {subtle} from 'crypto';
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const decoder = new TextDecoder('utf-8'); // bytes -> string
const encoder = new TextEncoder(); // string -> bytes

// export async function streamToUint8Array(stream: ReadableStream | null): Promise<Uint8Array> {
//   if (!stream) throw new Error("No data found in the S3 object stream");

//   // Create an array to collect the chunks
//   const chunks: Uint8Array[] = [];

//   // Read the stream in Bun.js
//   for await (const chunk of stream) {
//     chunks.push(new Uint8Array(chunk));
//   }

//   // Concatenate all collected chunks into a single Uint8Array
//   const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
//   const uint8Array = new Uint8Array(totalLength);

//   let offset = 0;
//   for (const chunk of chunks) {
//     uint8Array.set(chunk, offset);
//     offset += chunk.length;
//   }

//   return uint8Array;
// }

export function splitOnLastHyphen(input: string) {
  // Find the position of the last occurrence of the hyphen
  const lastHyphenIndex = input.lastIndexOf('-');

  // If the hyphen isn't found, return an array with the whole string as a single element
  if (lastHyphenIndex === -1) {
    return [input];
  }

  // Split the string into two parts
  const part1 = input.slice(0, lastHyphenIndex);
  const part2 = input.slice(lastHyphenIndex + 1);

  return [part1, part2];
}
export function hexToUint8Array(hexString: string) {
  const length = hexString.length;
  const uintArray = new Uint8Array(length / 2);
  for (let i = 0; i < length; i += 2) {
    uintArray[i / 2] = parseInt(hexString.substring(i, i + 2), 16);
  }
  return uintArray;
}

export function uint8ArrayToHex(uintArray: Uint8Array): string {
  return Array.from(uintArray)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashString(input: string): Promise<string> {
  // Create a hash object using SHA-256
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const sha256Hash = await subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(sha256Hash);
  // Update the hash object with the input string

  // Finalize the hash and return it as a hexadecimal string
  return uint8ArrayToHex(hashArray);
}

export async function createExportedEncryptionKey(){
  let key = crypto.getRandomValues(new Uint8Array(16));
  let keyEncoded = await crypto.subtle.importKey('raw', key, {
    name: 'AES-GCM'
  }, true, ['encrypt', 'decrypt']);
  let exportedKey = await crypto.subtle.exportKey('raw', keyEncoded);
  return uint8ArrayToHex(new Uint8Array(exportedKey));
}

// Bun.write(process.env.ENCRYPTION_KEY_PATH ?? './encryptionKey', await createExportedEncryptionKey());

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
      encodedData = new Uint8Array([data]);
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