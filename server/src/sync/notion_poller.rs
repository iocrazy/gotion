use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{interval, Duration};

use chrono::{DateTime, NaiveDate, Utc};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::db;
use crate::sync::block_sync;
use crate::sync::conflict;
use crate::sync::notion_client::NotionClient;
use crate::ws::WsBroadcast;
use gotion_shared::models::{Task, TaskStatus, WsMessage};

pub async fn start_polling(pool: SqlitePool, client: Arc<NotionClient>, broadcast: WsBroadcast) {
    let last_sync: Arc<Mutex<Option<DateTime<Utc>>>> = Arc::new(Mutex::new(None));

    let mut ticker = interval(Duration::from_secs(30));
    let mut poll_count: u64 = 0;

    loop {
        ticker.tick().await;
        poll_count += 1;

        // Format since as ISO 8601 with Z suffix (Notion-compatible)
        let since = {
            let guard = last_sync.lock().await;
            guard.map(|t| t.format("%Y-%m-%dT%H:%M:%SZ").to_string())
        };

        if !client.is_configured().await {
            if poll_count % 10 == 1 {
                tracing::info!("Notion not configured, skipping poll");
            }
            continue;
        }

        tracing::info!("Poll #{}: since={:?}", poll_count, since);

        match do_sync(&pool, &client, &broadcast, since.as_deref()).await {
            Ok(count) => {
                // Only advance last_sync when pages were actually fetched or it's the first sync
                *last_sync.lock().await = Some(Utc::now());
                if count > 0 {
                    tracing::info!("Notion sync complete, processed {} pages", count);
                }
            }
            Err(e) => {
                tracing::error!("Notion sync error: {} (will retry next cycle)", e);
                // Do NOT advance last_sync on error so we retry the same window
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

/// Look up the user_id that owns the Notion config.
/// Falls back to the first admin user if not set.
async fn get_sync_user_id(pool: &SqlitePool) -> Option<String> {
    // Try notion_config user_id first
    let row = sqlx::query_as::<_, FindRow>(
        "SELECT user_id AS id FROM notion_config WHERE user_id IS NOT NULL LIMIT 1",
    )
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();

    if let Some(r) = row {
        return Some(r.id);
    }

    // Fall back to the first admin user
    let admin_row = sqlx::query_as::<_, FindRow>(
        "SELECT id FROM users WHERE is_admin = 1 LIMIT 1",
    )
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();

    admin_row.map(|r| r.id)
}

/// Core sync logic shared by poller and manual trigger.
async fn do_sync(
    pool: &SqlitePool,
    client: &NotionClient,
    broadcast: &WsBroadcast,
    since: Option<&str>,
) -> Result<usize, String> {
    let sync_user_id = get_sync_user_id(pool)
        .await
        .ok_or_else(|| "No user found for Notion sync".to_string())?;

    let pages = client
        .query_database(since)
        .await
        .map_err(|e| format!("Failed to query Notion: {}", e))?;

    let mut synced = 0;

    // Sort pages: parent tasks first, subtasks second.
    // This ensures parent tasks exist in DB before subtasks try to resolve their parent_id.
    let field_map_for_sort = client.get_config().await.field_map;
    let mut sorted_pages: Vec<&_> = pages.iter().filter(|p| !p.archived).collect();
    if !field_map_for_sort.parent_item.is_empty() {
        sorted_pages.sort_by_key(|p| {
            if p.get_relation_first(&field_map_for_sort.parent_item).is_some() {
                1 // subtask — process after parents
            } else {
                0 // parent — process first
            }
        });
    }

    for page in &sorted_pages {
        // Skip pages that were deleted locally (prevents re-creation)
        if is_notion_id_deleted(pool, &page.id).await {
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
            Some(find_or_create_category(pool, &sync_user_id, cat_name, broadcast).await)
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
                let local_parent = find_task_by_notion_id(pool, &parent_notion_id).await;
                if local_parent.is_none() {
                    tracing::warn!(
                        "Subtask '{}' references parent notion_id={} but no local task found",
                        notion_title, parent_notion_id
                    );
                }
                local_parent.map(|t| t.id)
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
                tracing::info!(
                    "Merging page '{}' (notion_edited={}) with local '{}' (title_updated_at={})",
                    notion_title,
                    notion_edited,
                    local_task.title,
                    local_task.title_updated_at,
                );
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

                tracing::info!(
                    "Merge result: local_changed={}, notify_notion={:?}, cat_changed={}, starred_changed={}, parent_changed={}",
                    merge.local_changed, merge.notify_notion, category_changed, starred_changed, parent_changed,
                );

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
                        &sync_user_id,
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
                        broadcast.send(sync_user_id.clone(), WsMessage::TaskUpdated(updated));
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
                    &sync_user_id,
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
                                pool, &sync_user_id, task.id, None, None, None, None, None, None, Some(true), None,
                            )
                            .await;
                        }
                    }
                    // Re-fetch to get full task with category and starred
                    if let Ok(Some(full_task)) = db::tasks::get_task(pool, &sync_user_id, task.id).await {
                        broadcast.send(sync_user_id.clone(), WsMessage::TaskCreated(full_task));
                    } else {
                        broadcast.send(sync_user_id.clone(), WsMessage::TaskCreated(task));
                    }
                }
            }
        }

        // Sync blocks for in-progress (Todo) tasks that have a notion_id
        let final_status = if notion_status == "Done" { TaskStatus::Done } else { TaskStatus::Todo };
        if final_status == TaskStatus::Todo {
            // Find the local task (it might have just been created above)
            if let Some(local) = find_task_by_notion_id(pool, &page.id).await {
                let result = block_sync::sync_blocks_for_task(
                    pool,
                    client,
                    broadcast,
                    &sync_user_id,
                    local.id,
                    &page.id,
                    notion_edited,
                )
                .await;
                if result.direction != "unchanged" {
                    tracing::info!(
                        "Block sync for '{}': direction={}, blocks={}",
                        notion_title, result.direction, result.block_count
                    );
                }
            }
        }

        synced += 1;
    }

    Ok(synced)
}

/// Find a category by name for a specific user, or create it if it doesn't exist.
async fn find_or_create_category(pool: &SqlitePool, user_id: &str, name: &str, broadcast: &WsBroadcast) -> Uuid {
    // Try to find existing category for this user
    let row = sqlx::query_as::<_, FindRow>("SELECT id FROM categories WHERE name = ? AND user_id = ?")
        .bind(name)
        .bind(user_id)
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
    match db::categories::create_category(pool, user_id, name.to_string(), None, None, None).await {
        Ok(cat) => {
            let id = cat.id;
            broadcast.send(user_id.to_string(), WsMessage::CategoryCreated(cat));
            id
        }
        Err(_) => Uuid::nil(),
    }
}

async fn find_task_by_notion_id(pool: &SqlitePool, notion_id: &str) -> Option<Task> {
    // Query the full task row directly by notion_id (no user_id filter needed
    // since notion_id is unique and this is a system-level sync operation)
    let row = sqlx::query_as::<_, TaskByNotionIdRow>(
        "SELECT id, notion_id, title, status, due_date, created_at, updated_at, \
         title_updated_at, status_updated_at, due_date_updated_at, \
         category_id, parent_id, sort_order, starred, starred_updated_at, notion_status \
         FROM tasks WHERE notion_id = ?",
    )
    .bind(notion_id)
    .fetch_optional(pool)
    .await
    .ok()?;

    row.map(|r| Task {
        id: r.id.parse().unwrap_or_default(),
        notion_id: r.notion_id,
        title: r.title,
        status: match r.status.as_str() {
            "done" => TaskStatus::Done,
            _ => TaskStatus::Todo,
        },
        due_date: r.due_date,
        created_at: r.created_at,
        updated_at: r.updated_at,
        title_updated_at: r.title_updated_at,
        status_updated_at: r.status_updated_at,
        due_date_updated_at: r.due_date_updated_at,
        category_id: r.category_id.as_deref().and_then(|v| v.parse().ok()),
        parent_id: r.parent_id.as_deref().and_then(|v| v.parse().ok()),
        sort_order: r.sort_order,
        starred: r.starred,
        starred_updated_at: r.starred_updated_at,
        notion_status: r.notion_status,
    })
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

#[derive(Debug, sqlx::FromRow)]
struct TaskByNotionIdRow {
    id: String,
    notion_id: Option<String>,
    title: String,
    status: String,
    due_date: Option<NaiveDate>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    title_updated_at: DateTime<Utc>,
    status_updated_at: DateTime<Utc>,
    due_date_updated_at: Option<DateTime<Utc>>,
    category_id: Option<String>,
    parent_id: Option<String>,
    sort_order: i32,
    starred: bool,
    starred_updated_at: Option<DateTime<Utc>>,
    notion_status: Option<String>,
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

/// Check if a notion page ID was locally deleted (should not be re-created).
async fn is_notion_id_deleted(pool: &SqlitePool, notion_id: &str) -> bool {
    sqlx::query_scalar::<_, i32>(
        "SELECT COUNT(*) FROM deleted_notion_ids WHERE notion_id = ?"
    )
    .bind(notion_id)
    .fetch_one(pool)
    .await
    .unwrap_or(0) > 0
}
