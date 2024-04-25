/**
 * Rust signaling server example for libdatachannel
 * Copyright (c) 2020 Paul-Louis Ageneau
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

extern crate tokio;
extern crate futures_util;
extern crate futures_channel;
extern crate json;
use memory_stats::memory_stats;

use std::env;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use tokio::net::{TcpListener, TcpStream};
use tokio::time::{self, Duration};
use async_channel as chan;
use async_tungstenite::tungstenite::protocol::Message;
use async_tungstenite::tungstenite::http::{Request, Response, StatusCode};
use async_tungstenite::tokio::{accept_hdr_async, connect_async};


use futures_util::{future, pin_mut, StreamExt};
use futures_util::stream::TryStreamExt;
use futures_channel::mpsc;
use serde::{Deserialize, Serialize};

use uuid::Uuid;
#[cfg(feature = "log")]
use log as logger;
#[cfg(feature = "tracing")]
use tracing as logger;

use datachannel::{
    DataChannelHandler, DataChannelInfo, DataChannelInit, IceCandidate, PeerConnectionHandler,
    Reliability, RtcConfig, RtcDataChannel, RtcPeerConnection, SdpType, SessionDescription,
};


#[derive(Debug, Serialize, Deserialize)]
struct ConnectionMsg {
    dest_id: Uuid,
    kind: MsgKind,
}

#[derive(Debug, Serialize, Deserialize)]
enum MsgKind {
    Description(SessionDescription),
    Candidate(IceCandidate),
}

type ClientsMap = Arc<Mutex<HashMap<Uuid, chan::Sender<Message>>>>;


async fn handle(clients: ClientsMap, stream: TcpStream) {
    let mut client_id = None;

    let callback = |req: &Request<()>, mut res: Response<()>| {
        let path: &str = req.uri().path();
        let tokens = path.split('/').collect::<Vec<_>>();
        match Uuid::parse_str(tokens[1]) {
            Ok(uuid) => client_id = Some(uuid),
            Err(err) => {
                logger::error!("Invalid uuid: {}", err);
                *res.status_mut() = StatusCode::BAD_REQUEST;
            }
        }
        return Ok(res);
    };

    // let websocket = tokio_tungstenite::accept_hdr_async(stream, callback)
    //     .await.expect("WebSocket handshake failed");

    let websocket = match accept_hdr_async(stream, callback).await {
        Ok(websocket) => websocket,
        Err(err) => {
            logger::error!("WebSocket handshake failed: {}", err);
            return;
        }
    };

    let client_id = match client_id {
        None => return,
        Some(client_id) => client_id
    };

	logger::info!("Client {} connected", &client_id);

    let (outgoing, mut incoming) = websocket.split();
    let (tx_ws, rx_ws) = chan::unbounded();

    clients.lock().unwrap().insert(client_id, tx_ws);

    let reply = rx_ws.map(Ok).forward(outgoing);
    let dispatch = async {
        while let Some(Ok(msg)) = incoming.next().await {
            if !msg.is_binary() {
                continue;
            }

            let mut client_msg = match serde_json::from_slice::<ConnectionMsg>(&msg.into_data()) {
                Ok(client_msg) => client_msg,
                Err(err) => {
                    logger::error!("Invalid ConnectionMsg: {}", err);
                    continue;
                }
            };
            logger::info!("Client {} << {:?}", &client_id, &client_msg);

            let dest_id = client_msg.dest_id;

            match clients.lock().unwrap().get_mut(&dest_id) {
                Some(dest_client) => {
                    client_msg.dest_id = client_id;
                    logger::info!("Peer {} >> {:?}", &dest_id, &client_msg);
                    let client_msg = serde_json::to_vec(&client_msg).unwrap();
                    dest_client.try_send(Message::binary(client_msg)).ok();
                }
                _ => logger::warn!("Client {} not found in server", &client_id),
            }
        }
    };

    pin_mut!(dispatch, reply);
    future::select(dispatch, reply).await;
    
    logger::info!("Client {} disconnected", &client_id);
    clients.lock().unwrap().remove(&client_id);
    
}

#[tokio::main]
async fn main() -> Result<(), std::io::Error> {
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
        std::env::set_var("RUST_LOG", "warn");
        let _ = env_logger::try_init();
    }


    let service = env::args().nth(1).unwrap_or("8000".to_string());
    let endpoint = if service.contains(':') { service } else { format!("127.0.0.1:{}", service) };

	println!("Listening on {}", endpoint);

    let listener = TcpListener::bind(endpoint)
    	.await.expect("Listener binding failed");

    let clients = ClientsMap::new(Mutex::new(HashMap::new()));

    let mut interval = time::interval(Duration::from_secs(5));

    let _ = tokio::spawn(async move {
        loop {
            interval.tick().await;
            if let Some(usage) = memory_stats() {

                logger::warn!("physical memory usage: {}", usage.physical_mem);
                // println!("Current virtual memory usage: {}", usage.virtual_mem);
            } else {
                // println!("Couldn't get the current memory usage :(");
            }
        }
    });

    while let Ok((stream, _)) = listener.accept().await {
        tokio::spawn(handle(clients.clone(), stream));
    }


    return Ok(())
}

