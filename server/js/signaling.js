import { randomUUID } from "crypto";
import { Queue } from '@datastructures-js/queue';
import Peer from 'simple-peer';
import nodeDatachannelPolyfill from './polyfill/index.js';
import nodeDataChannel from './lib/index.js';
import { heapStats } from "bun:jsc";

import {v4 as uuidv4} from 'uuid';

nodeDataChannel.initLogger('Info');


const clients = new Map();
const queue = new Queue();
const qMap = new Map();
const workers = new Map(); // {id: uuid}
const hubId = new uuidv4();
clients.set(hubId, null);
qMap.set(hubId, null);
const signalingMap = new Map();

const encoder = new TextEncoder(); // string -> bytes
const decoder = new TextDecoder();

console.log("running");

setInterval(() => {
  let now = Date.now();
  while(queue.length && now - queue.back().date > 10000){
    const id = queue.pop();
    let ws = qMap.get(id);
    if(ws){
      ws?.close();
    }
    qMap.delete(id);
  }
}, 10000);

function finishBootstrap(peer){
  let ws = qMap.get(peer.id);
  qMap.delete(peer.id);
  if(ws){
    ws?.close();
  }
  if(peer.worker) workers.set(peer.id, peer);
  else clients.set(peer.id, peer);
}


function handleRegister(ws, data) {
  console.log("handleRegister", {data});
  if(data.id && !qMap.has(data.id) && !clients.has(data.id) && !workers.has(data.id)){
    // console.log("doing the send dance");
    ws.id = data.id;
    ws.send(JSON.stringify({reason: 'register', success: true}));
    qMap.set(ws.id, ws);
    queue.enqueue({id: ws.id, date: Date.now()});
  }
  // console.log({id: data.id, notInMap: !qMap.has(data.id), notInClients: !clients.has(data.id)});
}

let notset = true;

function createPeer(ws, signalData){
  let peer = signalingMap.get(ws.id);
  if(peer) {
    console.log("peer exists, checking signal data", {signalData});
    peer.signal(signalData.iceData);
    return;
  }
  else peer = new Peer({initiator: false, wrtc: nodeDatachannelPolyfill, trickle: true});

  peer.id = ws.id;
  peer.worker = signalData.worker;
  peer.on('signal', (data) => {
    console.log("onsignal", {data});
    if(notset && peer._wrtc){
      notset = false;
      console.log("_wrtc exists", peer._wrtc);
      peer._wrtc.megaClose = () => {
        peer.close();
        console.log('peer should be closed now')
      }
      // peer._wrtc.addEventListener('connectionstatechange', (e) => {
      //   // console.log("connectionstate change");
      // });
    }
    // if (data.renegotiate || data.transceiverRequest) {
      //   console.log("reneg or trans", {data});
    //   return;
    // }
    // when peer1 has signaling data, send it to peer 2 through the hub
    // console.log("sending signal data for connection");
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
    peer.send(JSON.stringify({reason: "ahoy"}));
    peer.pingInterval = setInterval(() => {
      peer.send(JSON.stringify({reason: "ahoy"})) 
    }, 1000);
    // clean up ourselves
    finishBootstrap(peer);
   
  });

  peer.on('data', (msg) => {
    console.log("ondata");
    let data = JSON.parse(decoder.decode(msg));
    console.log({data});
    // switch(data.reason){
    //   case 'ahoy':
    //     finishBootstrap(peer);
    //   default:
    //     return;
    // }
  });

  peer.signal(signalData.iceData);
  // console.log("after peer signaling");
  return peer;
}

function handleSignal(ws, data) {
  console.log("handleSignal");
  if(qMap.has(ws.id) && !clients.has(ws.id)){
    // createPeerGuard(ws, data);
    createPeer(ws, data);
  }
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
    tls: {
      key: Bun.file("../../certs/_wildcard.kollator.local+3-key.pem"),
      cert: Bun.file("../../certs/_wildcard.kollator.local+3.pem"),
    },
    message(ws, data) {
      // console.log({data, len: data.length});
      if (data.length || data.type === 'utf8') {
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
    }, // a socket is opened
    close(ws, code, message) {
      console.error(`Client ${ws.id ?? ''} disconnected`);
    }, // a socket is closed
    drain(ws) {}, // the socket is ready to receive more data
  },
});


setInterval(() => {
  console.log("stats", {count: clients.size + workers.size, heapSize: heapStats().heapSize});
}, 5000);
