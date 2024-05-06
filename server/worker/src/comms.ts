//@ts-ignore
import global from 'global';
import * as process from "process";
global.process = process;
import Peer, {type Instance as SimplePeerInstance} from 'simple-peer';
import { sleep } from './src/utils';
import {v4 as uuidv4} from 'uuid';

console.log("commsworker!!", process.env.KOLLATOR_DOMAIN);
const WS_URL = "wss://"+ (process.env.KOLLATOR_DOMAIN);
console.log({WS_URL});
interface RegistrationData {
  success: boolean;
  id: string;
};
interface SignalMessage {
  iceData: Peer.SignalData
}
type PeerIdInstance = SimplePeerInstance & {id: string};

const decoder = new TextDecoder(); // bytes -> string

class CommsWorker {
  hub!: PeerIdInstance;
  ws?: WebSocket;
  peers: PeerIdInstance[];
  id: string;
  bootstrapAttempts: number;

  constructor(){
    this.peers = [];
    this.id = uuidv4();
    this.bootstrapAttempts = 0;
    this.ws = this.bootstrap();
  }

  createPeer(shouldInitiate=false){
    let peer = new Peer({ initiator: shouldInitiate }) as unknown as PeerIdInstance;

    peer.on('signal', (data) => {
        // when per1 has signaling data, send it to peer 2 through the hub
        this.hub.send(JSON.stringify({reason: 'signal', signalData: data}));
    });

    peer.on('connect', () => {
        peer.send(JSON.stringify({reason: "ahoy"}));
    });

    peer.on('data', (msg) => {
      let data = JSON.parse(decoder.decode(msg, {stream: false}));
      console.log("received data", data);
        switch(data.reason){
          case 'ahoy':
            console.log("received ahoy");
            break;
          default:
            return;
        }
    });
    return peer;
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
        console.log("ondata", msg);
        let data = JSON.parse(msg);
        switch(data.reason){
          case 'ahoy':
            console.log("data reason was ahoy but I surely didn't decode the data");
            // the server has accepted us, let's wrap up the bootstrap
            this.finishBootstrap();
            break;
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
        this.ws.send(JSON.stringify({reason: "register", id: this.id, worker: true}));
      }
    }
  }

  bootstrap(): WebSocket {
    console.log("bootstrapping");
    let ws = new WebSocket(WS_URL);
    console.log("after ws instantiation", WS_URL, ws);

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
    console.log("handleSignal", {data});
    this.hub.signal(data.iceData);
  }

  finishBootstrap(){
    this.ws?.close();
    console.log("finished bootstrapping webrtc connection, greeting them as a worker");
    this.hub.send(JSON.stringify({reason: "ahoy"}));
  }
  test() {
    console.log("commsworker test");
  }
}
console.log("before new commsworker");
let comms = new CommsWorker();

// console.log("after new commsworker");

// export {comms};
// export {CommsWorker};
// //@ts-ignore
// window.comms = comms;

async function main() {
  await comms.start()
}

main();