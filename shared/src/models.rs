use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Todo,
    Done,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: Uuid,
    pub notion_id: Option<String>,
    pub title: String,
    pub status: TaskStatus,
    pub due_date: Option<NaiveDate>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub title_updated_at: DateTime<Utc>,
    pub status_updated_at: DateTime<Utc>,
    pub due_date_updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Block {
    pub id: Uuid,
    pub task_id: Uuid,
    pub notion_block_id: Option<String>,
    #[serde(rename = "type")]
    pub block_type: String,
    pub content: serde_json::Value,
    pub sort_order: i32,
    pub updated_at: DateTime<Utc>,
}

// API request/response types

#[derive(Debug, Deserialize)]
pub struct CreateTaskRequest {
    pub title: String,
    pub status: Option<TaskStatus>,
    pub due_date: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTaskRequest {
    pub title: Option<String>,
    pub status: Option<TaskStatus>,
    pub due_date: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct TaskListQuery {
    pub status: Option<TaskStatus>,
}

// WebSocket message types

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "snake_case")]
pub enum WsMessage {
    TaskCreated(Task),
    TaskUpdated(Task),
    TaskDeleted { id: Uuid },
    BlocksUpdated { task_id: Uuid, blocks: Vec<Block> },
    Ping,
    Pong,
}
