import { randomUUID, type UUID } from "crypto";
import { Queue } from '@datastructures-js/queue';
import { MinPriorityQueue } from "@datastructures-js/priority-queue";
import Peer, {type Instance as SimplePeerInstance }from 'simple-peer';
import nodeDatachannelPolyfill from './node-datachannel/polyfill/index.js';
import * as nodeDataChannel from './node-datachannel/lib/index.js';
import { heapStats } from "bun:jsc";
import { RTC_MESSAGE_REASON as REASON } from "./src/constants";
import { bmsg as b } from './src/utils';

import {stringify as uuidStringify, parse as uuidParse, v4 as uuidv4, validate as uuidValidate} from 'uuid';

nodeDataChannel.initLogger('Info');
type KPeer = SimplePeerInstance & {id: UUID, worker: boolean, connectionCount: number};

const clients = new Map();
const queue = new Queue<any>();
const qMap = new Map();
const workers = new Map<UUID, KPeer>(); // {id: uuid}
const workerPriorityQueue = new MinPriorityQueue<KPeer>((peer) => peer.connectionCount);

const hubId = uuidv4();
clients.set(hubId, null);
qMap.set(hubId, null);
const signalingMap = new Map();

const encoder = new TextEncoder(); // string -> bytes
const decoder = new TextDecoder(); // bytes -> string


console.log("running");

setInterval(() => {
  let now = Date.now();
  while(queue.size() && now - queue.front().date > 10000){
    const id = queue.pop();
    let ws = qMap.get(id);
    if(ws){
      ws?.close();
    }
    qMap.delete(id);
  }
}, 10000);

function finishBootstrap(peer: KPeer){
  console.log("finishing bootstrapping", peer.id);
  let ws = qMap.get(peer.id);
  qMap.delete(peer.id);
  if(ws){
    ws?.close();
  }

  if(peer.worker) {
    workers.set(peer.id, peer);
    workerPriorityQueue.enqueue(peer);
    const idList = Array.from(workers.keys());
    console.log({workers: idList});
  }
  else {
    clients.set(peer.id, peer);
    const idList = Array.from(clients.keys());
    console.log({clients: idList});
    enmesh(peer);
  }
}

function enmesh(peer: KPeer) {
  let worker;
  while(!worker && workerPriorityQueue.size()){
    worker = workerPriorityQueue.pop();
    if(worker.destroyed) worker = undefined;
  }
  if(!worker) return;

  console.log("ENMESHING");
  workerPriorityQueue.enqueue(worker);
  // sender, receiver
  // the receiver is the one that initiates the signaling process. when handling the connection_initiation msg
  worker.send(b(REASON.CONNECTION_INITIATION, uuidParse(peer.id), uuidParse(worker.id)));
}


function handleRegister(ws: any, data: any) {
  console.log("handleRegister", {data});
  if(data.id && !qMap.has(data.id) && !clients.has(data.id) && !workers.has(data.id)){
    // console.log("doing the send dance");
    ws.id = data.id;
    ws.worker = data.worker;
    ws.send(JSON.stringify({reason: 'register', id: hubId, success: true}));
    qMap.set(ws.id, ws);
    queue.enqueue({id: ws.id, date: Date.now()});
  }
  // console.log({id: data.id, notInMap: !qMap.has(data.id), notInClients: !clients.has(data.id)});
}


function createPeer(ws: any, signalData:any){
  let peer = signalingMap.get(ws.id);
  if(peer) {
    console.log("peer exists, checking signal data", {signalData});
    peer.signal(signalData.iceData);
    return;
  }

  //@ts-ignore
  peer = new Peer({initiator: false, wrtc: nodeDatachannelPolyfill, trickle: true});


  ({id: peer.id, worker: peer.worker} = ws);

  console.log("SIGNALDATA", {signalData, peer});
  signalingMap.set(ws.id, peer);
  peer.on('signal', (data:any) => {
    console.log("onsignal", {data});
    // pass the signaling data back through the existing websocket connection.
    ws.send(JSON.stringify({reason: 'signal', iceData: data}));
  });

  // not called when we get seg faults.
  peer.on('close', () => {
    clearInterval(peer.pingInterval);
    peer.destroy();
  });

  peer.on('connect', () => {
    console.log("onconnect");
    // at this point we are now bootstrapped into webrtc.
    // we want to remove the websocket connection and rely only webrtc instead for everything.
    // signal the non-signaling server to clean up with an ahoy (arbitrary)

    // console.log("onconnect reason binary message", b(REASON.AHOY));
    peer.send(b(REASON.AHOY));
    // setInterval(() => {
    //   peer.
    //   peer.send(JSON.stringify({reason: "ahoy"}));
    // }, 1000);
    // clean ourselves up
    finishBootstrap(peer);
  });

  peer.on('data', (msg: Buffer) => {
    // let data = JSON.parse(decoder.decode(msg, {stream: false}));
    let data = new Uint8Array(msg);
    let reason = data[0];
    console.log("received data", REASON[reason], data);
      switch(reason) {
        case REASON.AHOY:
          console.log("received ahoy");
          break;
        case REASON.RELAY_SIGNAL:
          handleRelay(peer, data.slice(1));
          break;
        default:
          return;
      }
  });
  peer.signal(signalData.iceData);
  // console.log("after peer signaling");
  return peer;
}

function handleSignal(ws:any, data:any) {
  console.log("handleSignal", data);
  if(qMap.has(ws.id) && !clients.has(ws.id) && !workers.has(ws.id)){
    createPeer(ws, data);
  }
}

function handleRelay(peer: KPeer, data: Uint8Array){
  console.log("handle relay", {data});
  let senderId = uuidStringify(data);
  console.log("handle relay, senderId", {senderId});
  if(!uuidValidate(senderId)){
    console.warn(`relay sender id ${senderId} is not valid for requester ${peer.id}`);
    return;
  }

  if(senderId !== peer.id) {
    console.warn(`relay sender id ${senderId} does not equal ${peer.id}`);
    return;
  }

  let relayRecipientId = uuidStringify(data,16) as UUID;
  if(!uuidValidate(relayRecipientId)){
    console.warn(`relay recipient id ${relayRecipientId} is not valid for requester ${peer.id}`);
    return;
  }
  let relayRecipient = clients.get(relayRecipientId) ?? workers.get(relayRecipientId);
  if(!relayRecipient) {
    console.warn(`relay recipient doesn't exist for id ${relayRecipientId}, requester is ${peer.id}`);
    return;
  }
  if(relayRecipient.destroyed) {
    console.warn("relay recipient was destroyed, cleaning up");
    clients.delete(relayRecipientId);
    workers.delete(relayRecipientId);
    relayRecipient = undefined;
    return;
  }
  console.log(`relaying signal data from ${peer.id} to ${relayRecipientId}`);
  relayRecipient.send(b(REASON.SIGNAL, data));
}

Bun.serve({
  port: 8000,
  tls: {
    key: Bun.file("../../certs/_wildcard.kollator.local+3-key.pem"),
    cert: Bun.file("../../certs/_wildcard.kollator.local+3.pem"),
  },
  hostname: "kollator.local",
  fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === "/join") return new Response("hey!");
    if (url.pathname === "/blog") return new Response("Blog!");
    // return new Response("404!");

    // upgrade the request to a WebSocket
    if (server.upgrade(req)) {
      return; // do not return a Response
    }
    return new Response("Upgrade failed :(", { status: 500 });
  },
  websocket: {
    //@ts-ignore
    tls: {
      key: Bun.file("../../certs/_wildcard.kollator.local+3-key.pem"),
      cert: Bun.file("../../certs/_wildcard.kollator.local+3.pem"),
    },
    message(ws, data) {
      // console.log({data, len: data.length});
      //@ts-ignore
      if (data.length || data.type === 'utf8') {
        //@ts-ignore
        const message = JSON.parse(data);
        console.log({wsmessage: message});
        if(!message.reason) return;
        switch(message.reason){
          case 'register':
            handleRegister(ws, message);
            break;
          case 'signal':
            handleSignal(ws, message);
            break;
          default:
            return;
        }
      }
    }, // a message is received
    open(ws) {
      // console.log("websocket opened?", ws);
    }, // a socket is opened
    close(ws, code, message) {
      //@ts-ignore
      console.warn(`Client ${ws.id ?? ''} disconnected`);
    }, // a socket is closed
    drain(ws) {}, // the socket is ready to receive more data
  },
});

// Bun.serve({
//   port: 8001,
//   hostname: "kollator.local",
//   fetch(req, server) {
//     const url = new URL(req.url);
//     if (url.pathname === "/join") return new Response("hey!");
//     if (url.pathname === "/blog") return new Response("Blog!");
//     // return new Response("404!");

//     // upgrade the request to a WebSocket
//     if (server.upgrade(req)) {
//       return; // do not return a Response
//     }
//     return new Response("Upgrade failed :(", { status: 500 });
//   },
//   websocket: {
//     //@ts-ignore
//     message(ws, data) {
//       // console.log({data, len: data.length});
//       //@ts-ignore
//       if (data.length || data.type === 'utf8') {
//         //@ts-ignore
//         const message = JSON.parse(data);
//         console.log({wsmessage: message});
//         if(!message.reason) return;
//         switch(message.reason){
//           case 'register':
//             handleRegister(ws, message);
//             break;
//           case 'signal':
//             handleSignal(ws, message);
//             break;
//           default:
//             return;
//         }
//       }
//     }, // a message is received
//     open(ws) {
//       // console.log("websocket opened?", ws);
//     }, // a socket is opened
//     close(ws, code, message) {
//       //@ts-ignore
//       console.error(`Client ${ws.id ?? ''} disconnected`);
//     }, // a socket is closed
//     drain(ws) {}, // the socket is ready to receive more data
//   },
// });


setInterval(() => {
  console.log("stats", {count: clients.size + workers.size, heapSize: heapStats().heapSize});
}, 5000);
