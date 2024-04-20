

export enum FileState {
  NoHandle = 0,
  HasHandle = 1,
  Caching = 2,
  Cached = 3,
  BackedUp = 4,
  Downloading = 5, // downloading the file to this machine
  Spreading = 6, // spreading the file to friends
  Uploading = 7, // uploading the file kollator
  Uploaded = 8,
};

export type MetaData = {
  state: FileState;
  fileType: string;
  name: string;
  size: number;
  key: string; // base64
  hash: string;
};

export type Chunk = {
  hash: string;
  bytes: Uint8Array;
};

export interface Database {
  handle: FileSystemFileHandle;
  files: Map<string, MetaData>;
  name: string;
  email: string;
  password: string;
  provider: string;
}

export interface TorrentMetadata {
  announce: string;
  "announce-list": string[][]; // Array of arrays for tiered trackers
  comment: string;
  "created by": string;
  "creation date": number;
  info: {
    name: string;
    "piece length": number;
    pieces: string; // Concatenated SHA-1 hash data for V1 compatibility
    "meta version": number;
    "file tree": {
      [filename: string]: {
        "": {
          length: number;
          "pieces root": string; // SHA-256 root hash for V2
        }
      };
    };
    layers: {
      [rootHash: string]: {
        hashes: string[]; // Array of SHA-256 hashes for V2
      };
    };
  };
}
