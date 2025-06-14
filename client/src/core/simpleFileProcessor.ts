import { MetaData, FileState } from './fileTypes';
import { fromByteArray as bytesTob64 } from 'base64-js';

export class SimpleFileProcessor {
  async processFileSimple(file: File, directory: FileSystemDirectoryHandle): Promise<MetaData> {
    console.log("Processing file without torrent creation:", file.name);
    
    // Generate a simple hash for the file
    const fileBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
    const hash = bytesTob64(new Uint8Array(hashBuffer));
    
    // Store the file directly in OPFS
    const fileHandle = await directory.getFileHandle(hash, { create: true });
    const writableStream = await fileHandle.createWritable();
    await writableStream.write(file);
    await writableStream.close();
    
    // Create simplified metadata
    const metadata: MetaData = {
      state: FileState.Cached,
      fileType: file.type.length > 0 ? file.type : file.name.slice(Math.min(file.name.lastIndexOf('.') + 1, file.name.length - 1)),
      name: file.name,
      hash: hash,
      size: file.size,
      key: '', // Empty for simple processing
      iv: ''   // Empty for simple processing
    };
    
    console.log("File processed successfully:", metadata);
    return metadata;
  }
}

export const simpleFileProcessor = new SimpleFileProcessor();
