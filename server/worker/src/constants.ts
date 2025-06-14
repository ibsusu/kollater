export const {
  AWS_REGION: region,
  AWS_ACCESS_KEY: accessKeyId,
  AWS_SECRET_KEY: secretAccessKey,
  AWS_ENDPOINT: endpoint,
  BUCKET_GENERAL: bucketGeneral,
  BUCKET_410: bucket410,
  BUCKET_TORRENTS: bucketTorrents,
  DIRECTORY_GENERAL: dirGeneral,
  DIRECTORY_410: dir410,
  STORAGE_CAPACITY,
} = process.env as {
  AWS_REGION: string,
  AWS_ACCESS_KEY: string,
  AWS_SECRET_KEY: string,
  AWS_ENDPOINT: string,
  BUCKET_GENERAL: string,
  BUCKET_410: string,
  BUCKET_TORRENTS: string,
  DIRECTORY_GENERAL: string,
  DIRECTORY_410: string,
  SYMMETRIC_ENCRYPTION_KEY: string,
  STORAGE_CAPACITY: string,
};

const encryptionKeyHex = await Bun.file(process.env.ENCRYPTION_KEY_PATH!).text();
export const encryptionKey = Buffer.from(encryptionKeyHex.trim(), 'hex');
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
  UPLOAD,
  UPLOAD_RESPONSE,
  DOWNLOAD,
  DOWNLOAD_RESPONSE,
  REDIRECTION,
  REPORT,

  // STREAMING PROTOCOL
  TORRENT_INIT,
  PIECE_CHUNK,
  PIECE_ACK
};
