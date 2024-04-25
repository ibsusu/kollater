import Peer from 'simple-peer';
import nodeDatachannelPolyfill from './polyfill/index.js';
import nodeDataChannel from './lib/index.js';
import { heapStats } from "bun:jsc";
import {v4 as uuidv4} from 'uuid';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

nodeDataChannel.initLogger('Info');
const WS_URL = process.env.WS_URL || 'ws://localhost:8000';
let peers = new Map();


function finishBootstrap(thisPeer, ws, peer){
  peers.set(peer.id, peer);
  // thisPeer.hub.close();
  ws?.close();
  // keep the connection alive
  setInterval(() => {
    peer.send(JSON.stringify({reason: 'ping'}));
  }, 7000);
}

function createPeer(initiating=false){
    let peer = new Peer({ initiating, wrtc: nodeDatachannelPolyfill });

    peer.on('signal', (data) => {
        // when peer1 has signaling data, send it to peer 2 through the hub
        thisPeer.hub.send(JSON.stringify({reason: 'offer', initiator: thisPeer.id, receiver: thisPeer.hub.id, signalData: data}));
    });

    peer.on('connect', () => {
        peer.send(JSON.stringify({reason: "ahoy", peerId: thisPeer.id}));
    });

    peer.on('data', (msg) => {
        let data = JSON.parse(msg);
        switch(data.reason){
            case 'ahoy':

            default:
                return;
        }
    });
    return peer;
}

async function handleRegister(thisPeer, ws, data) {
  if(data.success === true) {
    // console.log("success", {data});
    thisPeer.hub = new Peer({initiator: true, wrtc: nodeDatachannelPolyfill});
    thisPeer.hub.id = data.id;
    
    thisPeer.hub.on('signal', (data) => {
      // console.log("onsignal");
      ws.send(JSON.stringify({ reason:'signal', iceData: data, worker: true}));
    });

    thisPeer.hub.on('connect', () => {
      // console.log("onconnect");
      thisPeer.hub.send(JSON.stringify({reason: "ahoy", peerId: thisPeer.id}));
    });

    thisPeer.hub.on('data', (msg) => {
      // console.log("ondata");
      let data = JSON.parse(msg);
      switch(data.reason){
        case 'ahoy':
          // the server has accepted us, let's wrap up the bootstrap
          finishBootstrap(thisPeer, ws, thisPeer.hub);
        default:
          return;
      }
    });
  }
  else{
    await sleep(1000 + (2000*(bootstrapAttemptCount-1)));
    if(bootStrapAttemptCount < 5){
      thisPeer.id = uuidv4();
      ws.send(JSON.stringify({reason: "register", id: thisPeer.id}));
    }
  }
}

async function handleSignal(thisPeer, ws, data) {
  // console.log("handleSignal", {data});
  thisPeer.hub.signal(data.iceData);
}

function bootstrap(){

  let ws;
  let thisPeer = {
    id: uuidv4(),
    hub: undefined,
    conn: undefined
  };
  let bootstrapAttemptCount = 0;

  let id = '88';

  ws = new WebSocket(WS_URL + '/' + id, {
      perMessageDeflate: false,
  });

  ws.onclose = () => {
    // console.log("websocket closed");
    setInterval(() => {
      // if we're ever not connected to someone then we need to bootstrap ourselves.
      if(peers.size === 0) bootstrap();
    }, 5000);
  }

  ws.onopen = () => {
      // console.log("opened websocket connection");
      ws.send(JSON.stringify({reason: "register", id: thisPeer.id}));
      bootstrapAttemptCount++;
  }

  ws.onmessage = ({data} = ev) => {
      // console.log({data});
      let msgData = JSON.parse(data);
      switch(msgData.reason){
          case 'register':
            handleRegister(thisPeer, ws, msgData);
            break;
          case 'signal':
            handleSignal(thisPeer, ws, msgData);
            break;
          default:
              return;
      }
  }
  // ws.send("ahoy");
}

// function connectToMesh() {
//     let peer1 = new Peer({ initiator: true, wrtc: nodeDatachannelPolyfill });
// }



async function run() {
  let awaiter;
  for (let i=0;i<10000;i++){
    awaiter = bootstrap();
    await sleep(100);
  }
  await awaiter;
  await sleep(3000);    
}

run();
