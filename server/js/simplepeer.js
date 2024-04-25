import Peer from 'simple-peer';
import nodeDatachannelPolyfill from './polyfill/index.js';
import nodeDataChannel from './lib/index.js';

nodeDataChannel.initLogger('Info');

var peer1 = new Peer({ initiator: true, wrtc: nodeDatachannelPolyfill });
var peer2 = new Peer({ wrtc: nodeDatachannelPolyfill });

peer1.on('signal', (data) => {
    // when peer1 has signaling data, give it to peer2 somehow
    console.log("signaldata1", {data});
    peer2.signal(data);
});

peer2.on('signal', (data) => {
    console.log("signaldata2", {data});
    // when peer2 has signaling data, give it to peer1 somehow
    peer1.signal(data);
});

peer1.on('connect', () => {
    // wait for 'connect' event before using the data channel
    peer1.send('hey peer2, how is it going?');
});

peer2.on('data', (data) => {
    // got a data channel message
    console.log('got a message from peer1: ' + data);
});

Bun.serve({
  port:8000,
  hostname: "localhost",
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
    message(ws, data) {
      console.log({data, len: data.length});
      if (data.length || data.type === 'utf8') {
        const message = JSON.parse(data);
        // console.log({wsmessage: message});
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

