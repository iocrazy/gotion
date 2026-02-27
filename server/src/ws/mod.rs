pub mod handler;

use gotion_shared::models::WsMessage;
use std::sync::Arc;
use tokio::sync::broadcast;

#[derive(Clone)]
pub struct WsBroadcast {
    tx: Arc<broadcast::Sender<WsMessage>>,
}

impl WsBroadcast {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(256);
        Self { tx: Arc::new(tx) }
    }

    pub fn send(&self, msg: WsMessage) {
        let _ = self.tx.send(msg);
    }

    pub fn subscribe(&self) -> broadcast::Receiver<WsMessage> {
        self.tx.subscribe()
    }
}
