use chrono::{DateTime, Utc};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::db;
use crate::sync::notion_client::NotionClient;
use crate::ws::WsBroadcast;
use gotion_shared::converter;
use gotion_shared::models::{Block, WsMessage};

/// Result of a block sync operation.
#[derive(Debug, Clone, serde::Serialize)]
pub struct BlockSyncResult {
    /// "pulled" (Notion→Gotion), "pushed" (Gotion→Notion), "unchanged", or "error"
    pub direction: String,
    /// Number of blocks after sync
    pub block_count: usize,
}

/// Sync blocks for a single task between Gotion and Notion.
///
/// Logic:
/// - If `content_synced_at` is null → first sync, pull from Notion
/// - If Notion `last_edited_time > content_synced_at` → pull from Notion
/// - If local `blocks.updated_at > content_synced_at` → push to Notion
/// - If both changed → last-write-wins (compare timestamps)
/// - If neither changed → skip
pub async fn sync_blocks_for_task(
    pool: &SqlitePool,
    client: &NotionClient,
    broadcast: &WsBroadcast,
    user_id: &str,
    task_id: Uuid,
    notion_id: &str,
    notion_edited: DateTime<Utc>,
) -> BlockSyncResult {
    // Get content_synced_at for this task
    let content_synced_at = get_content_synced_at(pool, task_id).await;

    // Get local blocks and their max updated_at
    let local_blocks = db::blocks::get_blocks(pool, task_id)
        .await
        .unwrap_or_default();
    let local_max_updated = local_blocks.iter().map(|b| b.updated_at).max();

    let needs_pull = match content_synced_at {
        None => true, // Never synced
        Some(synced_at) => {
            // Also re-pull if local blocks are empty but synced_at exists
            // (e.g., previous sync saved empty due to a bug)
            notion_edited > synced_at || local_blocks.is_empty()
        }
    };

    let needs_push = match (content_synced_at, local_max_updated) {
        (None, Some(_)) => !local_blocks.is_empty(), // Have local content, never synced
        (Some(synced_at), Some(local_at)) => local_at > synced_at,
        _ => false,
    };

    tracing::info!(
        "Block sync decision for task {}: needs_pull={}, needs_push={}, content_synced_at={:?}, notion_edited={}, local_max_updated={:?}, local_blocks={}",
        task_id, needs_pull, needs_push, content_synced_at, notion_edited, local_max_updated, local_blocks.len(),
    );

    if needs_pull && needs_push {
        // Both sides changed — last-write-wins
        let local_at = local_max_updated.unwrap_or(Utc::now());
        tracing::info!("Block sync conflict: notion_edited={} vs local_at={}, winner={}", notion_edited, local_at, if notion_edited >= local_at { "notion" } else { "local" });
        if notion_edited >= local_at {
            pull_from_notion(pool, client, broadcast, user_id, task_id, notion_id).await
        } else {
            push_to_notion(pool, client, task_id, notion_id).await
        }
    } else if needs_pull {
        pull_from_notion(pool, client, broadcast, user_id, task_id, notion_id).await
    } else if needs_push {
        push_to_notion(pool, client, task_id, notion_id).await
    } else {
        BlockSyncResult {
            direction: "unchanged".into(),
            block_count: local_blocks.len(),
        }
    }
}

/// Pull blocks from Notion → convert to TipTap → save locally.
async fn pull_from_notion(
    pool: &SqlitePool,
    client: &NotionClient,
    broadcast: &WsBroadcast,
    user_id: &str,
    task_id: Uuid,
    notion_id: &str,
) -> BlockSyncResult {
    let notion_blocks = match client.get_blocks(notion_id).await {
        Ok(blocks) => blocks,
        Err(e) => {
            tracing::error!("Failed to fetch Notion blocks for {}: {}", notion_id, e);
            return BlockSyncResult {
                direction: "error".into(),
                block_count: 0,
            };
        }
    };

    // Convert Notion blocks to raw JSON values for the converter.
    // NotionBlock uses #[serde(flatten)] on `data`, so `type` is captured separately
    // in `block_type`. We must reconstruct the full object with `type` included,
    // because the converter dispatches on block["type"].
    let block_values: Vec<serde_json::Value> = notion_blocks
        .iter()
        .map(|b| {
            let mut obj = match &b.data {
                serde_json::Value::Object(m) => m.clone(),
                _ => serde_json::Map::new(),
            };
            obj.insert("type".to_string(), serde_json::Value::String(b.block_type.clone()));
            serde_json::Value::Object(obj)
        })
        .collect();

    let tiptap_doc = converter::notion_blocks_to_tiptap(&block_values);

    // Check if content is empty (just an empty doc)
    let is_empty = tiptap_doc["content"]
        .as_array()
        .map(|arr| arr.is_empty())
        .unwrap_or(true);

    let now = Utc::now();

    if is_empty {
        // Clear local blocks
        let _ = db::blocks::replace_blocks(pool, task_id, vec![]).await;
        set_content_synced_at(pool, task_id, now).await;
        return BlockSyncResult {
            direction: "pulled".into(),
            block_count: 0,
        };
    }

    // Create a single tiptap_doc block
    let block = Block {
        id: Uuid::new_v4(),
        task_id,
        notion_block_id: Some(notion_id.to_string()),
        block_type: "tiptap_doc".into(),
        content: tiptap_doc,
        sort_order: 0,
        updated_at: now,
    };

    match db::blocks::replace_blocks(pool, task_id, vec![block]).await {
        Ok(saved) => {
            set_content_synced_at(pool, task_id, now).await;
            broadcast.send(
                user_id.to_string(),
                WsMessage::BlocksUpdated {
                    task_id,
                    blocks: saved.clone(),
                },
            );
            BlockSyncResult {
                direction: "pulled".into(),
                block_count: saved.len(),
            }
        }
        Err(e) => {
            tracing::error!("Failed to save pulled blocks for task {}: {}", task_id, e);
            BlockSyncResult {
                direction: "error".into(),
                block_count: 0,
            }
        }
    }
}

/// Push local blocks → convert to Notion blocks → replace on Notion page.
async fn push_to_notion(
    pool: &SqlitePool,
    client: &NotionClient,
    task_id: Uuid,
    notion_id: &str,
) -> BlockSyncResult {
    let local_blocks = db::blocks::get_blocks(pool, task_id)
        .await
        .unwrap_or_default();

    if local_blocks.is_empty() {
        // Nothing to push, just mark synced
        set_content_synced_at(pool, task_id, Utc::now()).await;
        return BlockSyncResult {
            direction: "pushed".into(),
            block_count: 0,
        };
    }

    // Get the TipTap doc content from the first block
    let tiptap_doc = &local_blocks[0].content;
    let notion_blocks = converter::tiptap_to_notion_blocks(tiptap_doc);

    match client.replace_page_blocks(notion_id, &notion_blocks).await {
        Ok(()) => {
            set_content_synced_at(pool, task_id, Utc::now()).await;
            tracing::info!(
                "Pushed {} blocks to Notion page {} for task {}",
                notion_blocks.len(),
                notion_id,
                task_id
            );
            BlockSyncResult {
                direction: "pushed".into(),
                block_count: local_blocks.len(),
            }
        }
        Err(e) => {
            tracing::error!("Failed to push blocks to Notion for task {}: {}", task_id, e);
            BlockSyncResult {
                direction: "error".into(),
                block_count: local_blocks.len(),
            }
        }
    }
}

/// Get the content_synced_at timestamp for a task.
async fn get_content_synced_at(pool: &SqlitePool, task_id: Uuid) -> Option<DateTime<Utc>> {
    let row: Option<(Option<String>,)> = sqlx::query_as(
        "SELECT content_synced_at FROM tasks WHERE id = ?",
    )
    .bind(task_id.to_string())
    .fetch_optional(pool)
    .await
    .ok()?;

    row.and_then(|(ts,)| ts)
        .and_then(|s| s.parse::<DateTime<Utc>>().ok())
}

/// Update content_synced_at for a task.
async fn set_content_synced_at(pool: &SqlitePool, task_id: Uuid, at: DateTime<Utc>) {
    let _ = sqlx::query("UPDATE tasks SET content_synced_at = ? WHERE id = ?")
        .bind(at.to_rfc3339())
        .bind(task_id.to_string())
        .execute(pool)
        .await;
}
