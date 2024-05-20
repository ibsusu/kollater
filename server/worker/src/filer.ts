import {
  S3Client,
  PutObjectCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
  DeleteBucketCommand,
  paginateListObjectsV2,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { subtle } from "crypto";
import {region, accessKeyId, secretAccessKey, STORAGE_CAPACITY, dirGeneral, dir410, bucketGeneral, encryptionKey} from './constants'
import { createCipheriv, createDecipheriv } from 'crypto';
import { createReadStream } from "node:fs";
import { readdir, unlink } from "node:fs/promises";

import {Glob} from 'bun';
import { hexToUint8Array, uint8ArrayToHex, splitOnLastHyphen, hashString } from "./utils";



export class Filer {
  s3: S3Client;
  capacity: number;
  requestCounts: Map<string, number>;

  constructor(){
    this.s3 = new S3Client({region, credentials:{
      accessKeyId,
      secretAccessKey
    }});
    this.capacity = Number(STORAGE_CAPACITY);
    this.requestCounts = new Map();
    setInterval(() => this.updateCache(), 1000*60);
  }

  async retrieve(hash: string) {
    let file = await this.fromDisk(hash);
    if(file) {
      this.recordRequest(hash);
      return file;
    }
    file = await this.fromS3(hash);
    if(file) {
      this.recordRequest(hash);
      return file;
    }    
  }

  recordRequest(hash: string){
    let count = this.requestCounts.get(hash) || 0;
    this.requestCounts.set(hash, count+1);
  }

  async updateCache() {
    const topRequested = Array.from(this.requestCounts.entries())
                              .sort((a, b) => b[1] - a[1])
                              .map(entry => entry[0]);

    // read all the files in the current directory
    const filesInDirectory = (await readdir(dirGeneral));

    const filesToRemove = filesInDirectory.filter(file => !topRequested.includes(splitOnLastHyphen(file)[0]));
    console.log({filesInDirectory, filesToRemove});
    for( let file of filesToRemove){
      await unlink(file);
    }
  }

  async toDisk(hash: string, data: Blob, ivString?: string){
    let iv;
    if(!ivString){
      iv = crypto.getRandomValues(new Uint8Array(16));
      ivString = uint8ArrayToHex(iv);
    }
    else iv = hexToUint8Array(ivString);

    const path = `/tmp/${dirGeneral}/${hash}-${ivString}`;
    await Bun.write(path, data);
    return Bun.file(path);
  }

  async fromDisk(hash: string){
    const path = `/tmp/${dirGeneral}/${hash}`;
    const file = Bun.file(path);
    let exists = await file.exists();
    if(exists){
      return file.stream();
    }
  }

  async toS3(hash: string) {
    const filePathStub = `${hash}*`;
    const glob = new Glob(filePathStub);
    let filePath;
    for await (const fp of glob.scan(`/tmp/${dirGeneral}/`)) {
      console.log(fp);
      filePath = fp;
      break;
    }
    if(!filePath) throw("File doesn't exist, can't upload to s3");
    const readStream = createReadStream(filePath); // await Bun.file(filePath).arrayBuffer(); // maybe someday, probably possible today but i'm not figuring it out now.
    const [_, ivString] = splitOnLastHyphen(filePath);
    const iv = hexToUint8Array(ivString);
    // const iv = crypto.getRandomValues(new Uint8Array(16));  // AES-GCM IV should be unique and 16 bytes long
    const internalHash = await hashString(hash);
    // Set up AES-GCM encryption
    const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
    const encryptStream = readStream.pipe(cipher);

    const uploadParams = {
      Bucket: bucketGeneral,
      Key: internalHash,
      Body: encryptStream,
      Metadata: {
        iv: ivString  // Storing IV in metadata for decryption
      }
    };

    try {
      // Pipe the encrypted stream directly to S3
      const result = await this.s3.send(new PutObjectCommand(uploadParams));
      return result;
    } catch (error) {
      console.error('Error uploading encrypted file to S3:', error);
      throw error;
    }
  }
  
  async fromS3(hash: string){
    const internalHash = await hashString(hash);
    const {Body: body, Metadata: metadata} = await this.s3.send(new GetObjectCommand({Bucket: bucketGeneral, Key: internalHash}));
    if(!body) return; // Handle error or empty body appropriately
    if(!(body instanceof ReadableStream)) return; // Adjust based on actual type in Bun.js environment

    let encryptedBytes = new Uint8Array(await new Response(body).arrayBuffer());
    const iv = hexToUint8Array(metadata!.iv);

    const decipher = createDecipheriv('aes-256-gcm', encryptionKey, iv);
    let decryptedData = Buffer.concat([decipher.update(Buffer.from(encryptedBytes)), decipher.final()]);

    await Bun.write(`${dirGeneral}/${hash}`, decryptedData);
    return Bun.file(`${dirGeneral}/${hash}`).stream();
  }

}


