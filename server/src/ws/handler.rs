use axum::{
    extract::{State, WebSocketUpgrade},
    response::Response,
};
use axum::extract::ws::{Message, WebSocket};
use futures::{SinkExt, StreamExt};
use super::WsBroadcast;

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(broadcast): State<WsBroadcast>,
) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, broadcast))
}

async fn handle_socket(socket: WebSocket, broadcast: WsBroadcast) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = broadcast.subscribe();

    let send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            let text = serde_json::to_string(&msg).unwrap();
            if sender.send(Message::Text(text.into())).await.is_err() {
                break;
            }
        }
    });

    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }
}
