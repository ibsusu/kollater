import Peer, {type Instance as SimplePeerInstance} from 'simple-peer';
import nodeDatachannelPolyfill from '../node-datachannel/polyfill/index.js';
import * as nodeDataChannel from '../node-datachannel/lib/index.js';
import { sleep, bmsg as b, uint8ArrayToHex, bytesToString } from './utils';
import {stringify as uuidStringify, parse as uuidParse, v4 as uuidv4, validate as uuidValidate} from 'uuid';
import type { UUID } from 'crypto';
import { RTC_MESSAGE_REASON as REASON } from "./constants";
import { create } from 'domain';
import { Queue } from '@datastructures-js/queue';

nodeDataChannel.initLogger('Info');

console.log("commsworker!!", process.env.KOLLATOR_DOMAIN);

const WS_URL = "wss://"+ (process.env.KOLLATOR_DOMAIN);
let bootstrapInterval: Timer|undefined;

console.log({WS_URL});
let testOutput = await ((await fetch('https://'+process.env.KOLLATOR_DOMAIN+'/join', { tls: { rejectUnauthorized: false } })).text());
console.log({testOutput});

interface RegistrationData {
  success: boolean;
  id: string;
};
interface SignalMessage {
  iceData: Peer.SignalData
}
type KPeer = SimplePeerInstance & {id: string, worker: boolean};

// const decoder = new TextDecoder(); // bytes -> string
const encoder = new TextEncoder(); // string -> bytes

export class Communicator {
  hub!: KPeer;
  ws?: WebSocket;
  peers: Map<string, KPeer>;
  hashRequestPeerIds: Map<string, UUID>;
  signalingMap: Map<string,KPeer>;
  signalingQueue: Queue<{id: string, date: number}>;
  signalingInterval: number;
  id: string;
  bootstrapAttempts: number;

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
    }) as unknown as number;
    this.hashRequestPeerIds = new Map(); // this is for when we are searching for the hash of the data and who we're connecting/connected to for that data.
  }

  validateSignalId(relayPeer: KPeer, data: Uint8Array){
    let signalerId = uuidStringify(data.slice(0, 16));
    if(!uuidValidate(signalerId)){
      console.warn(`signal initiator id ${signalerId} is not valid relayer: ${relayPeer.id}`);
      return false;
    }

    let recipientId = uuidStringify(data);
    if(!uuidValidate(recipientId)){
      console.warn(`signal initiator id ${signalerId} is not valid ${relayPeer.id}`);
      return false;
    }
    return signalerId;
  }

  createPeer(relayPeer: KPeer, initiator: boolean, data: Uint8Array){
    let signalId = this.validateSignalId(relayPeer, data);
    if(!signalId) return;
    let peer = this.signalingMap.get(signalId);
    if(peer){
      let signalData = JSON.parse(bytesToString(data.slice(32)));
      console.log("peer exists, checking signal data", {signalData});
      peer.signal(signalData);
      return;
    }

    peer = new Peer({ initiator }) as unknown as KPeer;
    peer.id = signalId;

    peer.on('signal', (data) => {
      // when peer1 has signaling data, send it to peer 2 through the hub
      relayPeer.send(b(REASON.SIGNAL, JSON.stringify(data)));
    });

    peer.on('connect', () => {
      peer.send(b(REASON.AHOY));
      console.log(`finished peering webrtc connection, greeting ${peer.id}`);
    });

    peer.on('data', (msg) => {
      console.log("received data", data);
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
          this.createPeer(this.hub, false, msg.slice(1));
          break;
        default:
          return;
      }
    });
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
      this.hub = new Peer({initiator: true, wrtc: nodeDatachannelPolyfill, trickle: true});
      this.hub.id = data.id;
      
      this.hub.on('signal', (data) => {
        console.log("onsignal");
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
        console.log("ondata message", msg);
        // let data = JSON.parse(msg);
        // let data = new Uint8Array(msg);
        const reason = msg[0];

        switch(reason){
          case REASON.AHOY:
            this.finishBootstrap();
            break;
          case REASON.CONNECTION_INITIATION:
            this.createPeer(this.hub, true, msg.slice(1));
            break;
          case 2:
          default:
            return;
        }
      });

      console.log("created peer");
    }
    else{
      await sleep(1000 + (2000*(this.bootstrapAttempts-1)));
      if(this.bootstrapAttempts < 5){
        this.id = uuidv4();
        this.bootstrapAttempts++;
        if(!this.ws || this.ws.CLOSED || this.ws.CLOSING) {
          this.ws = this.bootstrap();
        }
        this.ws!.send(JSON.stringify({reason: "register", id: this.id, worker: true}));
      }
    }
  }

  bootstrap(): WebSocket {
    console.log("bootstrapping");
    //@ts-ignore
    let ws = new WebSocket(WS_URL, { tls: { rejectUnauthorized: false } });
    bootstrapInterval = setInterval(() => {
      console.log("ws and state:", ws, ws.readyState);
      if(bootstrapInterval) {

        clearInterval(bootstrapInterval);

      }
    }, 5000);
    console.log("after ws instantiation", WS_URL, ws);
    ws.addEventListener('error', (e: any) => {
      console.error("websocket error occurred", e);
    });

    ws.addEventListener('close',(ev: any) => {
      console.log("websocket closed", ev.reason, ev.code);
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
    });
  
    ws.addEventListener('open', () => {
      console.log("opened websocket connection");
      ws.send(JSON.stringify({reason: "register", id: this.id, worker: true}));
      this.bootstrapAttempts++;
    });
  
    //@ts-ignore
    ws.addEventListener('message', ({data} = (ev as MessageEvent)) => {
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
    });
    console.log("after creation of websocket in bootstrap");


    return ws;
  }

  async handleSignal(data: SignalMessage) {
    console.log("handleSignal", {data});
    this.hub.signal(data.iceData);
  }

  finishBootstrap(){
    this.ws?.close();
    this.ws = undefined;
    console.log("finished bootstrapping webrtc connection, greeting them as a worker");
    this.hub.send(JSON.stringify({reason: "ahoy"}));
    clearInterval(bootstrapInterval);
  }
  test() {
    console.log("commsworker test");
  }
}