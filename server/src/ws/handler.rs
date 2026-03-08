use axum::{
    extract::{Query, State, WebSocketUpgrade},
    http::StatusCode,
    response::Response,
};
use axum::extract::ws::{Message, WebSocket};
use futures::{SinkExt, StreamExt};
use serde::Deserialize;
use crate::api::AppState;
use crate::jwt;

#[derive(Deserialize)]
pub struct WsQuery {
    token: Option<String>,
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Query(params): Query<WsQuery>,
) -> Result<Response, StatusCode> {
    let token = params.token.ok_or(StatusCode::UNAUTHORIZED)?;
    let claims = jwt::verify_token(&state.jwt_secret, &token)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    let user_id = claims.sub;
    let broadcast = state.broadcast.clone();

    Ok(ws.on_upgrade(move |socket| handle_socket(socket, broadcast, user_id)))
}

async fn handle_socket(socket: WebSocket, broadcast: super::WsBroadcast, user_id: String) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = broadcast.subscribe();

    let send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            // Only send messages for this user
            if msg.user_id == user_id {
                let text = serde_json::to_string(&msg.message).unwrap();
                if sender.send(Message::Text(text.into())).await.is_err() {
                    break;
                }
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
