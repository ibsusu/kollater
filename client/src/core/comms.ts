//@ts-ignore
import global from 'global';
import * as process from "process";
global.process = process;
import Peer, {Instance as SimplePeerInstance} from 'simple-peer';
import { sleep, bmsg as b, bytesToString } from './utils';
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
type KPeer = SimplePeerInstance & {id: string};


const decoder = new TextDecoder(); // bytes -> string

class CommsWorker {
  hub!: KPeer;
  ws?: WebSocket;
  peers: Map<string, KPeer>;
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
    }, 10000) as unknown as number;
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
      let data = JSON.parse(decoder.decode(msg, {stream: false}));
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
      this.hub = new Peer({initiator: true, trickle: true});
      this.hub.id = data.id;
      
      this.hub.on('signal', (data) => {
        console.log("onsignal");
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
}
console.log("before new commsworker");
let comms = new CommsWorker();

console.log("after new commsworker");

export {comms};
export {CommsWorker};
//@ts-ignore
window.comms = comms;