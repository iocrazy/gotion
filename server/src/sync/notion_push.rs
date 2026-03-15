use std::sync::Arc;

use sqlx::SqlitePool;

use crate::db;
use crate::sync::notion_client::NotionClient;
use gotion_shared::models::{Task, TaskStatus};

/// Push a newly created task to Notion, return the Notion page ID.
/// If parent_notion_id is provided, sets the parent relation for sub-tasks.
pub async fn push_new_task(
    client: &Arc<NotionClient>,
    task: &Task,
    parent_notion_id: Option<&str>,
    category_name: Option<&str>,
) -> Result<String, String> {
    if !client.is_configured().await {
        return Err("Notion not configured".into());
    }

    let config = client.get_config().await;
    let fm = &config.field_map;

    let status_str = match task.status {
        TaskStatus::Todo => fm.status_todo.as_str(),
        TaskStatus::Done => fm.status_done.as_str(),
    };
    let due_str = task.due_date.map(|d| d.to_string());

    let page = client
        .create_page(
            &task.title,
            status_str,
            due_str.as_deref(),
            parent_notion_id,
            category_name,
            Some(task.starred),
        )
        .await?;
    Ok(page.id)
}

/// Push task updates to Notion.
pub async fn push_task_update(
    client: &Arc<NotionClient>,
    notion_id: &str,
    task: &Task,
    category_name: Option<Option<&str>>,
) -> Result<(), String> {
    if !client.is_configured().await {
        return Err("Notion not configured".into());
    }

    let config = client.get_config().await;
    let fm = &config.field_map;

    let status_str = match task.status {
        TaskStatus::Todo => fm.status_todo.as_str(),
        TaskStatus::Done => fm.status_done.as_str(),
    };
    let due_str = task.due_date.map(|d| d.to_string());

    client
        .update_page(
            notion_id,
            Some(&task.title),
            Some(status_str),
            Some(due_str.as_deref()),
            category_name,
            Some(task.starred),
        )
        .await
        .map_err(|e| format!("Failed to update Notion: {}", e))
}

/// Background helper: push a newly created task to Notion, resolving parent and category from DB.
/// Sets the notion_id on the task after successful push.
pub async fn push_new_task_background(
    client: &Arc<NotionClient>,
    pool: &SqlitePool,
    user_id: &str,
    task: &Task,
) {
    // Resolve parent's notion_id if this is a subtask
    let parent_notion_id: Option<String> = if let Some(pid) = task.parent_id {
        if let Ok(Some(parent)) = db::tasks::get_task(pool, user_id, pid).await {
            parent.notion_id
        } else {
            None
        }
    } else {
        None
    };

    // Resolve category name
    let category_name: Option<String> = if let Some(cat_id) = task.category_id {
        db::categories::get_category(pool, user_id, cat_id)
            .await
            .ok()
            .flatten()
            .map(|c| c.name)
    } else {
        None
    };

    match push_new_task(
        client,
        task,
        parent_notion_id.as_deref(),
        category_name.as_deref(),
    )
    .await
    {
        Ok(notion_id) => {
            // Store the notion_id on the task
            let _ = sqlx::query("UPDATE tasks SET notion_id = ? WHERE id = ?")
                .bind(&notion_id)
                .bind(task.id.to_string())
                .execute(pool)
                .await;
            tracing::info!("Pushed new task '{}' to Notion: {}", task.title, notion_id);
        }
        Err(e) => {
            tracing::error!("Failed to push new task '{}' to Notion: {}", task.title, e);
        }
    }
}

/// Archive a task in Notion
pub async fn push_task_delete(client: &Arc<NotionClient>, notion_id: &str) -> Result<(), String> {
    if !client.is_configured().await {
        return Err("Notion not configured".into());
    }

    client
        .archive_page(notion_id)
        .await
        .map_err(|e| format!("Failed to archive in Notion: {}", e))
}
