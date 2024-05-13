import { RTC_MESSAGE_REASON as REASON } from './constants';

// const decoder = new TextDecoder(); // bytes -> string
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
