export const {
  AWS_REGION: region,
  AWS_ACCESS_KEY: accessKeyId,
  AWS_SECRET_KEY: secretAccessKey,
  BUCKET_GENERAL: bucketGeneral,
  BUCKET_410: bucket410,
  DIRECTORY_GENERAL: dirGeneral,
  DIRECTORY_410: dir410,
  STORAGE_CAPACITY,
} = process.env as {
  AWS_REGION: string,
  AWS_ACCESS_KEY: string,
  AWS_SECRET_KEY: string,
  BUCKET_GENERAL: string,
  BUCKET_410: string,
  DIRECTORY_GENERAL: string,
  DIRECTORY_410: string,
  SYMMETRIC_ENCRYPTION_KEY: string,
  STORAGE_CAPACITY: string,
};

export const encryptionKey = Buffer.from(await Bun.file(process.env.ENCRYPTION_KEY_PATH!).arrayBuffer());
// export const encryptionKey = await crypto.subtle.importKey('raw', decodedEncryptionKey, {
//   name: 'AES-GCM'
// }, true, ['encrypt', 'decrypt']);


export enum RTC_MESSAGE_REASON {
  // CONNECTION STUFF
  AHOY,
  CONNECTION_INITIATION,
  RELAY_SIGNAL,
  SIGNAL,
  CONNECTION_COUNT_CHECK,

  // DATA STUFF
  HASH_REQUEST,
  HASH_RESPONSE,
  HASH_UPLOAD,
  HASH_UPLOAD_RESPONSE,
  HASH_REDIRECTION
};