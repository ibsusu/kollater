//@ts-ignore
import global from 'global';
import * as process from "process";
global.process = process;
import Peer, {Instance as SimplePeerInstance} from 'simple-peer';
import { sleep, bmsg as b, bytesToString } from './utils';
import { RTC_MESSAGE_REASON as REASON } from './constants';
import {stringify as uuidStringify, parse as uuidParse, v4 as uuidv4, validate as uuidValidate} from 'uuid';

import { Queue } from '@datastructures-js/queue';

const WS_URL = "wss://"+ (import.meta.env.DEV ? 'kollator.local:8000' : 'kollator.com');
console.log({WS_URL});
interface RegistrationData {
  success: boolean;
  id: string;
};
interface SignalMessage {
  iceData: Peer.SignalData
}
type KPeer = SimplePeerInstance & {
  id: string,
  uploadPromise?: Promise<Uint8Array>;
  uploadResolver?: (uploadResponse: Uint8Array) => Uint8Array;
  downloadPromise?: Promise<Uint8Array>;
  downloadResolver?: (downloadResponse: Uint8Array) => Uint8Array;
  uploadTimeout: number|undefined;
};


// const decoder = new TextDecoder(); // bytes -> string

class CommsWorker {
  hub!: KPeer;
  ws?: WebSocket;
  peers: Map<string, KPeer>;
  signalingMap: Map<string,KPeer>;
  signalingQueue: Queue<{id: string, date: number}>;
  signalingInterval: number;
  id: string;
  bootstrapAttempts: number;
  uploadGaurdPromise?: Promise<any>; 
  uploadGuardResolver?: (value: any) => void;

  constructor(){
    this.peers = new Map<string, KPeer>();
    this.id = uuidv4();
    this.bootstrapAttempts = 0;
    this.ws = this.bootstrap();
    this.signalingQueue = new Queue();
    this.signalingMap = new Map();
    this.signalingInterval = setInterval(() => {
      let now = Date.now();
      while(this.signalingQueue.size() && now - this.signalingQueue.front().date > 10000){
        const {id} = this.signalingQueue.pop();
        let peer = this.signalingMap.get(id);
        if(peer){
          peer.destroy();
        }
        this.signalingMap.delete(id);
      }
    }, 10000) as unknown as number;
  }

  validateSignalId(relayPeer: KPeer, data: Uint8Array){
    let senderId = uuidStringify(data);
    if(!uuidValidate(senderId)){
      console.warn(`signal initiator id ${senderId} is not valid relayer: ${relayPeer.id}`);
      return false;
    }

    let receiverId = uuidStringify(data, 16);
    if(!uuidValidate(receiverId)){
      console.warn(`signal receiver id ${receiverId} is not valid ${relayPeer.id}`);
      return false;
    }
    return senderId;
  }

  createPeer(relayPeer: KPeer, initiator: boolean, data: Uint8Array){
    console.log("createPeer");
    let signalSenderId = this.validateSignalId(relayPeer, data);
    console.log({signalSenderId});
    if(!signalSenderId) return;
    let peer = this.signalingMap.get(signalSenderId);
    if(peer){
      let signalData = JSON.parse(bytesToString(data.slice(32)));
      //@ts-ignore;
      //window.signalingData.push({incoming: signalData});
      console.log("peer exists, checking signal data", {signalData});
      peer.signal(signalData);
      return;
    }

    if(!initiator){ console.log("initiating the connection with a signal answer");}

    peer = new Peer({ initiator, trickle: true }) as unknown as KPeer;
    peer.id = signalSenderId;
    this.signalingMap.set(peer.id, peer);

    peer.on('signal', (data) => {
      // when peer1 has signaling data, send it to peer 2 through the hub
      // console.log({outgoing: data});
      //window.signalingData.push({outgoing: data});
      console.log(`current peer id is ${this.id}, relaying through ${relayPeer.id} to signal ${signalSenderId}`);
      relayPeer.send(b(REASON.RELAY_SIGNAL, uuidParse(this.id), uuidParse(signalSenderId), JSON.stringify(data)));
    });

    peer.on('error', (err) => {
      console.error("there was an error creating this peer", err);
    });

    peer.on('finish', (ev) => {
      console.log("FINISHED", ev);
    });

    peer.on('connect', () => {
      console.log("peer connect, sending ahoy");
      peer.send(b(REASON.AHOY));
      console.log(`finished peering webrtc connection, greeting ${peer.id}`);
      this.signalingMap.delete(peer.id);
      this.peers.set(peer.id, peer);
    });

    peer.on('data', (msg) => {
      console.log("received data", REASON[msg[0]]);
      const reason = msg[0];
      switch(reason){
        case REASON.AHOY:
          console.log("received ahoy");
          this.finishPeering(peer);
          break;
        case REASON.RELAY_SIGNAL:
          break;
        case REASON.SIGNAL:
          console.log("received signal request");
          this.createPeer(peer, false, msg.slice(1));
          break;
        case REASON.UPLOAD_RESPONSE:
          if(peer.uploadResolver){
            peer.uploadResolver(msg.slice(1));
          }
          break;
        case REASON.DOWNLOAD_RESPONSE:
          if(peer.downloadResolver){
            peer.downloadResolver(msg.slice(1));
          }
          break;
        default:
          return;
      }
    });
    const signalData = JSON.parse(bytesToString(data.slice(32)));
    //window.signalingData.push({incoming: signalData})
    peer.signal(signalData);
    return peer;
  }

  async finishPeering (peer: KPeer){
    this.peers.set(peer.id, peer);
    this.signalingMap.delete(peer.id);
    console.log("finished peering", peer.id);
  }

  async handleRegister(data: RegistrationData) {
    console.log("handleregister");
    if(data.success === true) {
      console.log("success", {data});
      //@ts-ignore
      this.hub = new Peer({initiator: true, trickle: true});
      this.hub.id = data.id;
      
      this.hub.on('signal', (data) => {
        console.log("onsignal", data);
        //window.signalingData.push({outgoing:data});
        //@ts-ignore
        // if (data.renegotiate || data.transceiverRequest) {
        //   console.log("reneg or trans", {data});
        //   return;
        // }
        if(!this.ws || this.ws.readyState > 1) {
          console.log("ws isn't ready from peer onsignal");
          // console.trace("destroying hub", this.ws, this.ws?.readyState);
          // this.hub.destroy();
          return;
        }
        this.ws.send(JSON.stringify({reason:'signal', iceData: data}));
      });
  
      this.hub.on('connect', () => {
        console.log("onconnect");
        if(this.ws?.readyState === WebSocket.OPEN) this.ws?.send(JSON.stringify({reason: "ahoy"}));
      });
  
      this.hub.on('data', (msg) => {
        console.log("data type", typeof msg);
        const reason = msg[0];
        switch(reason){
          case REASON.AHOY:
            console.log("data reason");
            // the server has accepted us, let's wrap up the bootstrap
            this.finishBootstrap();
            break;
          case REASON.RELAY_SIGNAL:
            break;
          case REASON.SIGNAL:
            console.log("received signal request");
            this.createPeer(this.hub, false, msg.slice(1));
            break;
          case REASON.UPLOAD_RESPONSE:
            if(this.hub.uploadResolver){
              this.hub.uploadResolver(msg.slice(1));
            }
            break;
          case REASON.DOWNLOAD_RESPONSE:
            if(this.hub.downloadResolver){
              this.hub.downloadResolver(msg.slice(1));
            }
            break;
          default:
            return;
        }
      });

      console.log("created peer, ")
    }
    else{
      await sleep(1000 + (2000*(this.bootstrapAttempts-1)));
      if(this.bootstrapAttempts < 5){
        this.id = uuidv4();
        this.bootstrapAttempts++;
        if(!this.ws || this.ws.CLOSED || this.ws.CLOSING) {
          this.ws = this.bootstrap();
        }
        this.ws.send(JSON.stringify({reason: "register", id: this.id}));
      }
    }
  }

  bootstrap(): WebSocket {
    console.log("bootstrapping");
    let ws = new WebSocket(WS_URL);
    console.log("after ws instantiation", WS_URL, ws);
    //@ts-ignore
    window.ws = ws;
    ws.onclose = () => {
      console.log("websocket closed");
      // setInterval(() => {
      //   // if we're ever not connected to someone then we need to bootstrap ourselves.
      //   if(this.peers.length === 0 && (!this.hub || this.hub?.closed)) {
      //     console.log("destroying hub", this.peers.length, this.hub, this.hub?.closed);
      //     this.hub?.destroy();
      //     this.ws?.close();
      //     if(this.bootstrapAttempts < 5){
      //       this.bootstrapAttempts++;
      //       this.bootstrap();
      //     }
      //   }
      // }, 5000);
    }
  
    ws.onopen = () => {
        console.log("opened websocket connection");
        ws.send(JSON.stringify({reason: "register", id: this.id}));
        this.bootstrapAttempts++;
    }
  
    //@ts-ignore
    ws.onmessage = ({data} = (ev as MessageEvent)) => {
        console.log({data});
        let msgData = JSON.parse(data);
        switch(msgData.reason){
            case 'register':
              this.handleRegister(msgData as RegistrationData);
              break;
            case 'signal':
              this.handleSignal(msgData as SignalMessage);
              break;
            default:
                return;
        }
    }
    console.log("after creation of websocket in bootstrap");

    return ws;
  }

  async handleSignal(data: SignalMessage) {
    // the client is
    console.log("handleSignal", {data});
    this.hub.signal(data.iceData);
  }

  finishBootstrap(){
    this.ws?.close();
    console.log("finished bootstrapping webrtc connection, greeting");
  }
  test() {
    // console.log("commsworker test");
  }

  setUploading(peer: KPeer) {
    this.uploadGaurdPromise = new Promise(res => {
      this.uploadGuardResolver = res;
    });

    peer.uploadPromise = new Promise<Uint8Array>(res => {
      peer.uploadResolver = res as (uploadResponse: Uint8Array) => Uint8Array;
    }).finally(() => {
      if(this.uploadGuardResolver){
        this.uploadGuardResolver(null);
        this.uploadGuardResolver = undefined;
      }
    });
    return peer.uploadPromise;
  }

  setDownloading(peer: KPeer){
    peer.downloadPromise = new Promise<Uint8Array>(res => {
      peer.downloadResolver = res as (downloadResponse: Uint8Array) => Uint8Array;
    });
  }

  async upload(hash: Uint8Array/*32 bytes*/, data: Uint8Array){
    // First try to find a peer, then fall back to hub (worker connection)
    let peer = this.peers.values().next()?.value;
    console.log("Upload attempt - peers count:", this.peers.size);
    console.log("Hub status:", {
      exists: !!this.hub,
      destroyed: this.hub?.destroyed,
      connected: this.hub?.connected,
      _connected: (this.hub as any)?._connected
    });
    
    if (!peer || peer.destroyed) {
      // Check if hub is connected and can be used for upload
      if (this.hub && !this.hub.destroyed && (this.hub.connected || (this.hub as any)._connected)) {
        peer = this.hub;
        console.log("Using hub connection for upload");
      } else {
        console.error("No peers available for upload. Hub status:", {
          hubExists: !!this.hub,
          hubDestroyed: this.hub?.destroyed,
          hubConnected: this.hub?.connected,
          hubInternalConnected: (this.hub as any)?._connected,
          peersCount: this.peers.size
        });
        throw Error("No peers to upload to");
      }
    }
    
    // let sizeBytes = numberToBytes(data.byteLength); // explicitly setting to 8 bytes.
    let uploadingPromise = this.setUploading(peer);
    console.log("peer sending hash:", hash);
    // console.log("binary encoding of upload data:", b(REASON.UPLOAD, hash, sizeBytes, data));
    console.log("binary encoding of upload data:", b(REASON.UPLOAD, data));
    // console.log("binary encoding of upload data:", b(REASON.UPLOAD, hash.slice(), sizeBytes.slice(), data.slice()));
    // peer.send(b(REASON.UPLOAD, hash.slice(), sizeBytes.slice(), data.slice()));
    peer.send(b(REASON.UPLOAD, hash, data));
    return uploadingPromise;
  }

  /**
   * Stream upload using 16KiB chunks for large files
   * Implements piece-based streaming with BitTorrent piece verification
   */
  async streamUpload(torrentHash: Uint8Array, torrentMetadata: any, file: File): Promise<void> {
    console.log("=== STARTING STREAM UPLOAD ===");
    console.log("File size:", file.size, "bytes");
    console.log("Torrent hash:", Array.from(torrentHash).map(b => b.toString(16).padStart(2, '0')).join(''));
    
    // First try to find a peer, then fall back to hub (worker connection)
    let peer = this.peers.values().next()?.value;
    
    if (!peer || peer.destroyed) {
      if (this.hub && !this.hub.destroyed && (this.hub.connected || (this.hub as any)._connected)) {
        peer = this.hub;
        console.log("Using hub connection for stream upload");
      } else {
        console.error("No peers available for stream upload");
        throw Error("No peers available for stream upload");
      }
    }

    // Add connection monitoring
    peer.on('error', (err: any) => {
      console.error("WebRTC error during stream upload:", err);
    });
    
    peer.on('close', () => {
      console.error("WebRTC connection closed during stream upload");
    });

    const pieceLength = torrentMetadata.info['piece length'];
    const pieceHashes = (Object.values(torrentMetadata.info.layers)[0] as any).hashes as string[];
    const MAX_CHUNK_SIZE = 16 * 1024 - 100; // 16KiB minus headers (~100 bytes)
    
    console.log(`Stream upload config: ${file.size} bytes, ${pieceHashes.length} pieces, ${pieceLength} bytes per piece`);
    console.log("Max chunk size:", MAX_CHUNK_SIZE);

    try {
      // Step 1: Send torrent metadata
      const metadataBytes = new TextEncoder().encode(JSON.stringify(torrentMetadata));
      
      // Send TORRENT_INIT message
      const initMessage = new Uint8Array(1 + 32 + 4 + 4 + metadataBytes.length);
      let offset = 0;
      initMessage[offset++] = REASON.TORRENT_INIT;
      initMessage.set(torrentHash, offset); offset += 32;
      new DataView(initMessage.buffer).setUint32(offset, pieceHashes.length, false); offset += 4;
      new DataView(initMessage.buffer).setUint32(offset, pieceLength, false); offset += 4;
      initMessage.set(metadataBytes, offset);
      
      console.log("Sending TORRENT_INIT message, size:", initMessage.length);
      peer.send(initMessage);
      
      // Wait a bit for the worker to process the init message
      await new Promise(resolve => setTimeout(resolve, 100));

      // Step 2: Stream file pieces in 16KiB chunks
      const reader = file.stream().getReader();
      let pieceIndex = 0;
      let pieceBuffer = new Uint8Array();
      let totalBytesRead = 0;

      console.log("Starting to read file stream...");
      
      while (totalBytesRead < file.size) {
        // Check if connection is still alive
        if (peer.destroyed || !(peer.connected || (peer as any)._connected)) {
          throw new Error("WebRTC connection lost during upload");
        }
        
        const { value, done } = await reader.read();
        if (done) break;

        let dataToProcess = new Uint8Array(pieceBuffer.length + value.length);
        dataToProcess.set(pieceBuffer);
        dataToProcess.set(value, pieceBuffer.length);
        totalBytesRead += value.length;

        console.log(`Read ${value.length} bytes, total: ${totalBytesRead}/${file.size}`);

        // Process complete pieces
        while (dataToProcess.length >= pieceLength && pieceIndex < pieceHashes.length) {
          const piece = dataToProcess.slice(0, pieceLength);
          console.log(`Processing piece ${pieceIndex}, size: ${piece.length}`);
          
          await this.sendPieceInChunks(peer, torrentHash, pieceIndex, piece, MAX_CHUNK_SIZE);
          
          dataToProcess = dataToProcess.slice(pieceLength);
          pieceIndex++;
        }

        pieceBuffer = dataToProcess;
      }

      // Handle final piece if any data remains
      if (pieceBuffer.length > 0 && pieceIndex < pieceHashes.length) {
        console.log(`Processing final piece ${pieceIndex}, size: ${pieceBuffer.length}`);
        await this.sendPieceInChunks(peer, torrentHash, pieceIndex, pieceBuffer, MAX_CHUNK_SIZE);
        pieceIndex++;
      }

      console.log(`=== STREAM UPLOAD COMPLETED ===`);
      console.log(`Total pieces sent: ${pieceIndex}`);
      
    } catch (error) {
      console.error("Stream upload failed:", error);
      throw error;
    }
  }

  /**
   * Send a single piece in 16KiB chunks
   */
  private async sendPieceInChunks(peer: KPeer, torrentHash: Uint8Array, pieceIndex: number, piece: Uint8Array, maxChunkSize: number): Promise<void> {
    let offset = 0;
    
    while (offset < piece.length) {
      const chunkSize = Math.min(maxChunkSize, piece.length - offset);
      const chunk = piece.slice(offset, offset + chunkSize);
      
      // Create PIECE_CHUNK message: [type][torrentHash][pieceIndex][offset][data]
      const message = new Uint8Array(1 + 32 + 4 + 4 + chunk.length);
      let msgOffset = 0;
      
      message[msgOffset++] = REASON.PIECE_CHUNK;
      message.set(torrentHash, msgOffset); msgOffset += 32;
      new DataView(message.buffer).setUint32(msgOffset, pieceIndex, false); msgOffset += 4;
      new DataView(message.buffer).setUint32(msgOffset, offset, false); msgOffset += 4;
      message.set(chunk, msgOffset);
      
      peer.send(message);
      console.log(`Sent piece ${pieceIndex} chunk: offset ${offset}, size ${chunk.length}`);
      
      offset += chunkSize;
      
      // Small delay to prevent overwhelming the connection
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  }
}

//@ts-ignore
window.signalingData = [];
let comms = new CommsWorker();

export {comms};
export {CommsWorker};
//@ts-ignore
window.comms = comms;
