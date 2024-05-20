//@ts-ignore
import global from 'global';
import * as process from "process";
global.process = process;
import Peer, {Instance as SimplePeerInstance} from 'simple-peer';
import { sleep, bmsg as b, bytesToString, numberToBytes } from './utils';
import { RTC_MESSAGE_REASON as REASON } from './constants';
import {stringify as uuidStringify, parse as uuidParse, v4 as uuidv4, validate as uuidValidate} from 'uuid';

import { Queue } from '@datastructures-js/queue';

console.log("commsworker!!", import.meta.env);
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
    // this.ws = this.bootstrap();
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
    console.log("commsworker test");
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
    let peer = this.peers.values().next()?.value;
    if(!peer || peer.destroyed) throw Error("No peers to upload to");
    let sizeBytes = numberToBytes(data.byteLength); // explicitly setting to 8 bytes.
    let uploadingPromise = this.setUploading(peer);
    console.log("peer sending hash:", hash);
    // console.log("binary encoding of upload data:", b(REASON.UPLOAD, hash, sizeBytes, data));
    console.log("binary encoding of upload data:", b(REASON.UPLOAD, data));
    // console.log("binary encoding of upload data:", b(REASON.UPLOAD, hash.slice(), sizeBytes.slice(), data.slice()));
    // peer.send(b(REASON.UPLOAD, hash.slice(), sizeBytes.slice(), data.slice()));
    peer.send(b(REASON.UPLOAD, hash, data));
    return uploadingPromise;
  }
}
console.log("before new commsworker");
//@ts-ignore
window.signalingData = [];
let comms = new CommsWorker();

console.log("after new commsworker");

export {comms};
export {CommsWorker};
//@ts-ignore
window.comms = comms;