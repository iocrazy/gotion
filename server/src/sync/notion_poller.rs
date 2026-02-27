use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{interval, Duration};

use chrono::{DateTime, NaiveDate, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::db;
use crate::sync::conflict;
use crate::sync::notion_client::NotionClient;
use crate::ws::WsBroadcast;
use gotion_shared::models::{Task, TaskStatus, WsMessage};

pub async fn start_polling(pool: PgPool, client: Arc<NotionClient>, broadcast: WsBroadcast) {
    let last_sync: Arc<Mutex<Option<DateTime<Utc>>>> = Arc::new(Mutex::new(None));

    let mut ticker = interval(Duration::from_secs(30));

    loop {
        ticker.tick().await;

        let since = {
            let guard = last_sync.lock().await;
            guard.map(|t| t.to_rfc3339())
        };

        tracing::debug!("Polling Notion for changes...");

        match client.query_database(since.as_deref()).await {
            Ok(pages) => {
                for page in &pages {
                    if page.archived {
                        continue; // Skip archived pages for now
                    }

                    // Extract fields from Notion page
                    let notion_title = page
                        .properties
                        .name
                        .as_ref()
                        .and_then(|n| n.title.first())
                        .map(|t| t.plain_text.as_str())
                        .unwrap_or("");

                    let notion_status = page
                        .properties
                        .status
                        .as_ref()
                        .and_then(|s| s.select.as_ref())
                        .map(|s| s.name.as_str())
                        .unwrap_or("To Do");

                    let notion_due_date: Option<NaiveDate> = page
                        .properties
                        .due_date
                        .as_ref()
                        .and_then(|d| d.date.as_ref())
                        .and_then(|d| d.start.as_ref())
                        .and_then(|s| s.parse().ok());

                    let notion_edited: DateTime<Utc> = page
                        .last_edited_time
                        .parse()
                        .unwrap_or_else(|_| Utc::now());

                    // Check if we already have this task locally
                    let existing = find_task_by_notion_id(&pool, &page.id).await;

                    match existing {
                        Some(local_task) => {
                            // Merge
                            let merge = conflict::merge_task(
                                &local_task,
                                notion_title,
                                notion_status,
                                notion_due_date,
                                notion_edited,
                            );

                            if merge.local_changed {
                                // Update local DB
                                if let Ok(Some(updated)) = db::tasks::update_task(
                                    &pool,
                                    local_task.id,
                                    Some(merge.title.clone()),
                                    Some(merge.status.clone()),
                                    Some(merge.due_date),
                                )
                                .await
                                {
                                    broadcast.send(WsMessage::TaskUpdated(updated));
                                }
                            }

                            // If local has newer fields, push them to Notion
                            if !merge.notify_notion.is_empty() {
                                let status_str = match &merge.status {
                                    TaskStatus::Todo => "To Do",
                                    TaskStatus::Done => "Done",
                                };
                                let due_str = merge.due_date.map(|d| d.to_string());
                                let title_arg = if merge.notify_notion.contains(&"title".to_string())
                                {
                                    Some(merge.title.as_str())
                                } else {
                                    None
                                };
                                let status_arg =
                                    if merge.notify_notion.contains(&"status".to_string()) {
                                        Some(status_str)
                                    } else {
                                        None
                                    };
                                let due_date_arg =
                                    if merge.notify_notion.contains(&"due_date".to_string()) {
                                        Some(due_str.as_deref())
                                    } else {
                                        None
                                    };
                                let _ = client
                                    .update_page(&page.id, title_arg, status_arg, due_date_arg)
                                    .await;
                            }
                        }
                        None => {
                            // New task from Notion - create locally
                            let status = match notion_status {
                                "Done" => TaskStatus::Done,
                                _ => TaskStatus::Todo,
                            };
                            if let Ok(task) = db::tasks::create_task(
                                &pool,
                                notion_title.to_string(),
                                Some(status),
                                notion_due_date,
                            )
                            .await
                            {
                                // Store the notion_id mapping
                                let _ = set_notion_id(&pool, task.id, &page.id).await;
                                broadcast.send(WsMessage::TaskCreated(task));
                            }
                        }
                    }
                }

                // Update last sync time
                *last_sync.lock().await = Some(Utc::now());
                tracing::debug!("Notion sync complete, processed {} pages", pages.len());
            }
            Err(e) => {
                tracing::error!("Failed to poll Notion: {}", e);
            }
        }
    }
}

/// Helper to find a task by its notion_id
async fn find_task_by_notion_id(pool: &PgPool, notion_id: &str) -> Option<Task> {
    let row = sqlx::query_as::<_, FindRow>("SELECT id FROM tasks WHERE notion_id = $1")
        .bind(notion_id)
        .fetch_optional(pool)
        .await
        .ok()?;

    match row {
        Some(r) => db::tasks::get_task(pool, r.id).await.ok().flatten(),
        None => None,
    }
}

/// Set the notion_id on a local task after creating it from a Notion page.
async fn set_notion_id(pool: &PgPool, task_id: Uuid, notion_id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE tasks SET notion_id = $1 WHERE id = $2")
        .bind(notion_id)
        .bind(task_id)
        .execute(pool)
        .await?;
    Ok(())
}

#[derive(sqlx::FromRow)]
struct FindRow {
    id: Uuid,
}
