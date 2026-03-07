use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{interval, Duration};

use chrono::{DateTime, NaiveDate, Utc};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::db;
use crate::sync::conflict;
use crate::sync::notion_client::NotionClient;
use crate::ws::WsBroadcast;
use gotion_shared::models::{Category, Task, TaskStatus, WsMessage};

pub async fn start_polling(pool: SqlitePool, client: Arc<NotionClient>, broadcast: WsBroadcast) {
    let last_sync: Arc<Mutex<Option<DateTime<Utc>>>> = Arc::new(Mutex::new(None));

    let mut ticker = interval(Duration::from_secs(30));

    loop {
        ticker.tick().await;

        let since = {
            let guard = last_sync.lock().await;
            guard.map(|t| t.to_rfc3339())
        };

        if !client.is_configured().await {
            tracing::debug!("Notion not configured, skipping poll");
            continue;
        }

        tracing::debug!("Polling Notion for changes...");

        match do_sync(&pool, &client, &broadcast, since.as_deref()).await {
            Ok(count) => {
                *last_sync.lock().await = Some(Utc::now());
                tracing::debug!("Notion sync complete, processed {} pages", count);
            }
            Err(e) => {
                tracing::error!("Notion sync error: {}", e);
            }
        }
    }
}

/// Manual sync trigger (called from API). Always does a full sync (no since filter).
pub async fn sync_once(
    pool: &SqlitePool,
    client: &NotionClient,
    broadcast: &WsBroadcast,
) -> Result<usize, String> {
    do_sync(pool, client, broadcast, None).await
}

/// Core sync logic shared by poller and manual trigger.
async fn do_sync(
    pool: &SqlitePool,
    client: &NotionClient,
    broadcast: &WsBroadcast,
    since: Option<&str>,
) -> Result<usize, String> {
    let pages = client
        .query_database(since)
        .await
        .map_err(|e| format!("Failed to query Notion: {}", e))?;

    let mut synced = 0;

    for page in &pages {
        if page.archived {
            continue;
        }

        let field_map = client.get_config().await.field_map;

        let notion_title = match page.get_title(&field_map.title) {
            Some(t) if !t.trim().is_empty() => t,
            _ => {
                tracing::debug!(
                    "Skipping page {} with empty title (field_map.title={})",
                    page.id,
                    field_map.title
                );
                continue;
            }
        };

        let notion_status_raw = page
            .get_select(&field_map.status)
            .unwrap_or_else(|| field_map.status_todo.clone());
        let notion_status = if notion_status_raw == field_map.status_done {
            "Done"
        } else {
            "To Do"
        };

        let notion_due_date: Option<NaiveDate> = page
            .get_date_start(&field_map.due_date)
            .and_then(|s| s.parse().ok());

        // Extract category from Notion (if mapped)
        let notion_category_name: Option<String> = if !field_map.category.is_empty() {
            page.get_select(&field_map.category)
        } else {
            None
        };

        // Resolve category name -> local category_id (find or create)
        let notion_category_id: Option<Uuid> = if let Some(ref cat_name) = notion_category_name {
            Some(find_or_create_category(pool, cat_name, broadcast).await)
        } else {
            None
        };

        // Extract starred from Notion (if mapped)
        let notion_starred: Option<bool> = if !field_map.starred.is_empty() {
            page.get_checkbox(&field_map.starred)
        } else {
            None
        };

        // Extract parent relation from Notion (if mapped) → resolve to local task UUID
        let notion_parent_id: Option<Uuid> = if !field_map.parent_item.is_empty() {
            if let Some(parent_notion_id) = page.get_relation_first(&field_map.parent_item) {
                // Find local task by parent's notion_id
                find_task_by_notion_id(pool, &parent_notion_id)
                    .await
                    .map(|t| t.id)
            } else {
                None
            }
        } else {
            None
        };

        let notion_edited: DateTime<Utc> = page
            .last_edited_time
            .parse()
            .unwrap_or_else(|_| Utc::now());

        let existing = find_task_by_notion_id(pool, &page.id).await;

        match existing {
            Some(local_task) => {
                let merge = conflict::merge_task(
                    &local_task,
                    &notion_title,
                    notion_status,
                    notion_due_date,
                    notion_edited,
                );

                // Determine if category, starred, or parent changed
                let category_changed = notion_category_id.is_some()
                    && local_task.category_id != notion_category_id;
                let starred_changed = notion_starred.is_some()
                    && Some(local_task.starred) != notion_starred;
                let parent_changed = !field_map.parent_item.is_empty()
                    && local_task.parent_id != notion_parent_id;
                let notion_status_changed =
                    local_task.notion_status.as_deref() != Some(&notion_status_raw);

                if merge.local_changed || category_changed || starred_changed || parent_changed || notion_status_changed {
                    let cat_arg = if category_changed {
                        Some(notion_category_id)
                    } else {
                        None
                    };
                    let parent_arg = if parent_changed {
                        Some(notion_parent_id)
                    } else {
                        None
                    };
                    let starred_arg = if starred_changed {
                        notion_starred
                    } else {
                        None
                    };

                    if let Ok(Some(updated)) = db::tasks::update_task(
                        pool,
                        local_task.id,
                        if merge.local_changed { Some(merge.title.clone()) } else { None },
                        if merge.local_changed { Some(merge.status.clone()) } else { None },
                        if merge.local_changed { Some(merge.due_date) } else { None },
                        cat_arg,
                        parent_arg,
                        None,
                        starred_arg,
                        Some(notion_status_raw.clone()),
                    )
                    .await
                    {
                        broadcast.send(WsMessage::TaskUpdated(updated));
                    }
                }

                if !merge.notify_notion.is_empty() {
                    let status_str = match &merge.status {
                        TaskStatus::Todo => field_map.status_todo.as_str(),
                        TaskStatus::Done => field_map.status_done.as_str(),
                    };
                    let due_str = merge.due_date.map(|d| d.to_string());
                    let title_arg = if merge.notify_notion.contains(&"title".to_string()) {
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
                        .update_page(&page.id, title_arg, status_arg, due_date_arg, None, None)
                        .await;
                }
            }
            None => {
                let status = match notion_status {
                    "Done" => TaskStatus::Done,
                    _ => TaskStatus::Todo,
                };
                if let Ok(task) = db::tasks::create_task(
                    pool,
                    notion_title.clone(),
                    Some(status),
                    notion_due_date,
                    notion_category_id,
                    notion_parent_id,
                    Some(notion_status_raw.clone()),
                )
                .await
                {
                    let _ = set_notion_id(pool, task.id, &page.id).await;
                    // Update starred if mapped
                    if let Some(starred) = notion_starred {
                        if starred {
                            let _ = db::tasks::update_task(
                                pool, task.id, None, None, None, None, None, None, Some(true), None,
                            )
                            .await;
                        }
                    }
                    // Re-fetch to get full task with category and starred
                    if let Ok(Some(full_task)) = db::tasks::get_task(pool, task.id).await {
                        broadcast.send(WsMessage::TaskCreated(full_task));
                    } else {
                        broadcast.send(WsMessage::TaskCreated(task));
                    }
                }
            }
        }

        synced += 1;
    }

    Ok(synced)
}

/// Find a category by name, or create it if it doesn't exist.
async fn find_or_create_category(pool: &SqlitePool, name: &str, broadcast: &WsBroadcast) -> Uuid {
    // Try to find existing
    let row = sqlx::query_as::<_, FindRow>("SELECT id FROM categories WHERE name = ?")
        .bind(name)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten();

    if let Some(r) = row {
        if let Ok(uuid) = r.id.parse::<Uuid>() {
            return uuid;
        }
    }

    // Create new category
    match db::categories::create_category(pool, name.to_string(), None, None, None).await {
        Ok(cat) => {
            let id = cat.id;
            broadcast.send(WsMessage::CategoryCreated(cat));
            id
        }
        Err(_) => Uuid::nil(),
    }
}

async fn find_task_by_notion_id(pool: &SqlitePool, notion_id: &str) -> Option<Task> {
    let row = sqlx::query_as::<_, FindRow>("SELECT id FROM tasks WHERE notion_id = ?")
        .bind(notion_id)
        .fetch_optional(pool)
        .await
        .ok()?;

    match row {
        Some(r) => {
            let uuid: Uuid = r.id.parse().ok()?;
            db::tasks::get_task(pool, uuid).await.ok().flatten()
        }
        None => None,
    }
}

async fn set_notion_id(pool: &SqlitePool, task_id: Uuid, notion_id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE tasks SET notion_id = ? WHERE id = ?")
        .bind(notion_id)
        .bind(task_id.to_string())
        .execute(pool)
        .await?;
    Ok(())
}

#[derive(sqlx::FromRow)]
struct FindRow {
    id: String,
}

/// Download a Notion image URL and cache it locally.
/// Returns the local API path (e.g., "/api/images/{id}") or None on failure.
#[allow(dead_code)]
async fn cache_notion_image(notion_url: &str, pool: &SqlitePool) -> Option<String> {
    let client = reqwest::Client::new();
    let response = client.get(notion_url).send().await.ok()?;
    let bytes = response.bytes().await.ok()?;

    let id = Uuid::new_v4();
    let ext = if notion_url.contains(".png") {
        "png"
    } else if notion_url.contains(".gif") {
        "gif"
    } else if notion_url.contains(".webp") {
        "webp"
    } else {
        "jpg"
    };
    let filename = format!("{}.{}", id, ext);

    let uploads_dir = std::path::Path::new("./uploads");
    tokio::fs::create_dir_all(uploads_dir).await.ok()?;
    tokio::fs::write(uploads_dir.join(&filename), &bytes).await.ok()?;

    let now = Utc::now();
    sqlx::query(
        "INSERT INTO images (id, notion_url, stored_path, uploaded_at) VALUES (?, ?, ?, ?)",
    )
    .bind(id.to_string())
    .bind(notion_url)
    .bind(&filename)
    .bind(now)
    .execute(pool)
    .await
    .ok()?;

    Some(format!("/api/images/{}", id))
}
