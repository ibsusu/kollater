import Peer, {Instance as SimplePeerInstance} from 'simple-peer';
import {sleep} from './utils';
import {v4 as uuidv4} from 'uuid';

const WS_URL = "wss://kollator.com";
interface RegistrationData {
  success: boolean;
  id: string;
};
interface SignalMessage {
  iceData: Peer.SignalData
}
type PeerIdInstance = SimplePeerInstance & {id: string};

// hubSocket.addEventListener('message', event => {
//   console.log({eventData: event.data});
// });

class Communicator {
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
        // when peer1 has signaling data, send it to peer 2 through the hub
        this.hub.send(JSON.stringify({reason: 'signal', signalData: data}));
    });

    peer.on('connect', () => {
        peer.send(JSON.stringify({reason: "ahoy"}));
    });

    peer.on('data', (msg) => {
        let data = JSON.parse(msg);
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
    if(data.success === true) {
      // console.log("success", {data});
      //@ts-ignore
      this.hub = new Peer({initiator: true});
      this.hub.id = data.id;
      
      this.hub.on('signal', (data) => {
        console.log("onsignal");
        if(!this.ws || this.ws.CLOSED || this.ws.CLOSING) {
          this.hub.destroy();
          return;
        }
        this.ws.send(JSON.stringify({ reason:'signal', iceData: data, worker: true}));
      });
  
      this.hub.on('connect', () => {
        console.log("onconnect");
        if(!this.ws || this.ws.CLOSED || this.ws.CLOSING) {
          this.hub.destroy();
          return;
        }
        this.ws.send(JSON.stringify({reason: "ahoy"}));
      });
  
      this.hub.on('data', (msg) => {
        // console.log("ondata");
        let data = JSON.parse(msg);
        switch(data.reason){
          case 'ahoy':
            // the server has accepted us, let's wrap up the bootstrap
            this.finishBootstrap();
          default:
            return;
        }
      });
    }
    else{
      await sleep(1000 + (2000*(this.bootstrapAttempts-1)));
      if(this.bootstrapAttempts < 5){
        this.id = uuidv4();
        if(!this.ws || this.ws.CLOSED || this.ws.CLOSING) {
          this.ws = this.bootstrap();
        }
        this.ws.send(JSON.stringify({reason: "register", id: this.id}));
      }
    }
  }

  bootstrap(): WebSocket {
    let ws = new WebSocket(WS_URL);
  
    ws.onclose = () => {
      // console.log("websocket closed");
      setInterval(() => {
        // if we're ever not connected to someone then we need to bootstrap ourselves.
        if(this.peers.length === 0 && (!this.hub || this.hub.closed)) {
          this.hub?.destroy();
          this.ws?.close();
          this.bootstrap();
        }
      }, 5000);
    }
  
    ws.onopen = () => {
        // console.log("opened websocket connection");
        ws.send(JSON.stringify({reason: "register", id: this.id}));
        this.bootstrapAttempts++;
    }
  
    //@ts-ignore
    ws.onmessage = ({data} = (ev as MessageEvent)) => {
        // console.log({data});
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

    return ws;
  }

  async handleSignal(data: SignalMessage) {
    // console.log("handleSignal", {data});
    this.hub.signal(data.iceData);
  }

  finishBootstrap(){
    // this.peers.push(peer); 
    // this.hub is now being used instead of this.ws
    this.ws?.close();
  }

}

let comm = new Communicator();

export {comm}

