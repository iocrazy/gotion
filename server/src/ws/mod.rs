pub mod handler;

use gotion_shared::models::WsMessage;
use std::sync::Arc;
use tokio::sync::broadcast;

#[derive(Clone, Debug)]
pub struct UserWsMessage {
    pub user_id: String,
    pub message: WsMessage,
}

#[derive(Clone)]
pub struct WsBroadcast {
    tx: Arc<broadcast::Sender<UserWsMessage>>,
}

impl WsBroadcast {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(256);
        Self { tx: Arc::new(tx) }
    }

    pub fn send(&self, user_id: String, msg: WsMessage) {
        let _ = self.tx.send(UserWsMessage {
            user_id,
            message: msg,
        });
    }

    pub fn subscribe(&self) -> broadcast::Receiver<UserWsMessage> {
        self.tx.subscribe()
    }
}
