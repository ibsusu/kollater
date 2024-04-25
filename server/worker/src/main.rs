
use async_channel as chan;
use tokio::spawn;
use uuid::Uuid;
use std::sync::{Arc, Mutex};
use async_tungstenite::tungstenite::protocol::Message;
use futures_util::{future, pin_mut, select, FutureExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::time::timeout;
use std::time::Duration;

use std::collections::{HashMap, HashSet};

#[cfg(feature = "log")]
use log as logger;
#[cfg(feature = "tracing")]
use tracing as logger;

use async_tungstenite::tokio::{accept_hdr_async, connect_async};

use datachannel::{
    DataChannelHandler, DataChannelInfo, DataChannelInit, IceCandidate, PeerConnectionHandler,
    Reliability, RtcConfig, RtcDataChannel, RtcPeerConnection, SdpType, SessionDescription,
};


#[derive(Debug, Serialize, Deserialize)]
enum MsgKind {
    Description(SessionDescription),
    Candidate(IceCandidate),
}

#[derive(Debug, Serialize, Deserialize)]
struct ConnectionMsg {
    dest_id: Uuid,
    kind: MsgKind,
}


struct WsConn {
    peer_id: Uuid,
    dest_id: Uuid,
    signaling: chan::Sender<Message>,
    pipe: DataPipe,
    dc: Option<Box<RtcDataChannel<DataPipe>>>,
}

impl WsConn {
    fn new(peer_id: Uuid, dest_id: Uuid, pipe: DataPipe, signaling: chan::Sender<Message>) -> Self {
        WsConn {
            peer_id,
            dest_id,
            signaling,
            pipe,
            dc: None,
        }
    }
}

#[derive(Clone)]
struct DataPipe {
    output: chan::Sender<String>,
    ready: Option<chan::Sender<()>>,
}

impl DataPipe {
    fn new_sender(output: chan::Sender<String>, ready: chan::Sender<()>) -> Self {
        DataPipe {
            output,
            ready: Some(ready),
        }
    }

    fn new_receiver(output: chan::Sender<String>) -> Self {
        DataPipe {
            output,
            ready: None,
        }
    }
}

impl DataChannelHandler for DataPipe {
    fn on_open(&mut self) {
        if let Some(ready) = &mut self.ready {
            ready.try_send(()).ok();
        }
    }

    fn on_message(&mut self, msg: &[u8]) {
        let msg = String::from_utf8_lossy(msg).to_string();
        self.output.try_send(msg).ok();
    }
}

impl PeerConnectionHandler for WsConn {
    type DCH = DataPipe;

    fn data_channel_handler(&mut self, _info: DataChannelInfo) -> Self::DCH {
        self.pipe.clone()
    }

    fn on_description(&mut self, sess_desc: SessionDescription) {
        let peer_msg = ConnectionMsg {
            dest_id: self.dest_id,
            kind: MsgKind::Description(sess_desc),
        };

        self.signaling
            .try_send(Message::binary(serde_json::to_vec(&peer_msg).unwrap()))
            .ok();
    }

    fn on_candidate(&mut self, cand: IceCandidate) {
        let peer_msg = ConnectionMsg {
            dest_id: self.dest_id,
            kind: MsgKind::Candidate(cand),
        };

        self.signaling
            .try_send(Message::binary(serde_json::to_vec(&peer_msg).unwrap()))
            .ok();
    }

    fn on_data_channel(&mut self, mut dc: Box<RtcDataChannel<DataPipe>>) {
        logger::info!(
            "Received Datachannel with: label={}, protocol={:?}, reliability={:?}",
            dc.label(),
            dc.protocol(),
            dc.reliability()
        );

        dc.send(format!("Hello from {}", self.peer_id).as_bytes())
            .ok();
        self.dc.replace(dc);
    }
}


type ConnectionMap = Arc<Mutex<HashMap<Uuid, Box<RtcPeerConnection<WsConn>>>>>;
type ChannelMap = Arc<Mutex<HashMap<Uuid, Box<RtcDataChannel<DataPipe>>>>>;


async fn run_client(peer_id: Uuid, input: chan::Receiver<Uuid>, output: chan::Sender<String>) {
    let conns = ConnectionMap::new(Mutex::new(HashMap::new()));
    let chans = ChannelMap::new(Mutex::new(HashMap::new()));

    let ice_servers = vec!["stun:stun.l.google.com:19302"];
    let conf = RtcConfig::new(&ice_servers);

    let url = format!("ws://localhost:8000/{:?}", peer_id);
    let (ws_stream, _) = connect_async(url).await.expect("Failed to connect");

    let (outgoing, mut incoming) = ws_stream.split();
    let (tx_ws, rx_ws) = chan::unbounded();

    let send = async {
        let dest_id = match input.recv().await {
            Ok(dest_id) if dest_id != peer_id => dest_id,
            Err(_) | Ok(_) => return,
        };
        logger::info!("Peer {:?} sends data", &peer_id);

        let pipe = DataPipe::new_receiver(output.clone());
        let conn = WsConn::new(peer_id, dest_id, pipe, tx_ws.clone());
        let pc = RtcPeerConnection::new(&conf, conn).unwrap();
        conns.lock().unwrap().insert(dest_id, pc);

        let (tx_ready, rx_ready) = chan::bounded(1);
        pin_mut!(rx_ready);
        let pipe = DataPipe::new_sender(output.clone(), tx_ready);

        let opts = DataChannelInit::default()
            .protocol("prototest")
            .reliability(Reliability::default().unordered());
        let mut dc = conns
            .lock()
            .unwrap()
            .get_mut(&dest_id)
            .unwrap()
            .create_data_channel_ex("sender", pipe, &opts)
            .unwrap();

        rx_ready.next().await;
        let data = format!("Hello from {:?}", peer_id);
        dc.send(data.as_bytes()).ok();

        chans.lock().unwrap().insert(dest_id, dc);
    };

    let reply = rx_ws.map(Ok).forward(outgoing);

    let receive = async {
        while let Some(Ok(msg)) = incoming.next().await {
            if !msg.is_binary() {
                continue;
            }

            let peer_msg = match serde_json::from_slice::<ConnectionMsg>(&msg.into_data()) {
                Ok(peer_msg) => peer_msg,
                Err(err) => {
                    logger::error!("Invalid ConnectionMsg: {}", err);
                    continue;
                }
            };
            let dest_id = peer_msg.dest_id;

            let mut locked = conns.lock().unwrap();
            let pc = match locked.get_mut(&dest_id) {
                Some(pc) => pc,
                None => match &peer_msg.kind {
                    MsgKind::Description(SessionDescription { sdp_type, .. })
                        if matches!(sdp_type, SdpType::Offer) =>
                    {
                        logger::info!("Client {:?} answering to {:?}", &peer_id, &dest_id);

                        let pipe = DataPipe::new_receiver(output.clone());
                        let conn = WsConn::new(peer_id, dest_id, pipe, tx_ws.clone());
                        let pc = RtcPeerConnection::new(&conf, conn).unwrap();

                        locked.insert(dest_id, pc);
                        locked.get_mut(&dest_id).unwrap()
                    }
                    _ => {
                        logger::warn!("Peer {} not found in client", &dest_id);
                        continue;
                    }
                },
            };

            match &peer_msg.kind {
                MsgKind::Description(sess_desc) => pc.set_remote_description(sess_desc).ok(),
                MsgKind::Candidate(cand) => pc.add_remote_candidate(cand).ok(),
            };
        }
    };

    let send = send.fuse();
    pin_mut!(receive, reply, send);
    loop {
        select! {
            _ = future::select(&mut receive, &mut reply) => break,
            _ = &mut send => continue,
        }
    }

    conns.lock().unwrap().clear();
    chans.lock().unwrap().clear();
}

async fn bootstrap() -> Result<(), std::io::Error> {

    let id1 = Uuid::new_v4();
    let id2 = Uuid::new_v4();

    // spawn(run_server());

    let (tx_res, rx_res) = chan::unbounded();
    let (tx_id, rx_id) = chan::bounded(2);

    spawn(run_client(id1, rx_id.clone(), tx_res.clone()));
    spawn(run_client(id2, rx_id.clone(), tx_res.clone()));

    let mut expected = HashSet::new();
    expected.insert(format!("Hello from {:?}", id1));
    expected.insert(format!("Hello from {:?}", id2));

    tx_id.try_send(id1).unwrap();
    tx_id.try_send(id1).unwrap();

    // let mut res = HashSet::new();
    let r1 = timeout(Duration::from_secs(10), rx_res.recv()).await;
    let r2 = timeout(Duration::from_secs(10), rx_res.recv()).await;

    logger::error!("message 1: {:?}", r1.unwrap().unwrap());
    logger::error!("message 2: {:?}", r2.unwrap().unwrap());
    // res.insert(r1.unwrap().unwrap());
    // res.insert(r2.unwrap().unwrap());
    return Ok(());
}

#[tokio::main]
async fn main() -> Result<(), std::io::Error>  {
    // println!("Hello, world!");
    #[cfg(feature = "tracing")]
    {
        tracing::subscriber::set_global_default(
            tracing_subscriber::FmtSubscriber::builder()
                .with_max_level(tracing::Level::INFO)
                .finish(),
        )
        .ok();

        datachannel::configure_logging(tracing::Level::INFO);
    }
    #[cfg(feature = "log")]
    {
        // std::env::set_var("RUST_LOG", "info");
        // let _ = env_logger::try_init();
    }

    let _ = bootstrap().await;
    // logger::info!("final result: {:?}", res.unwrap());
    return Ok(())
}
