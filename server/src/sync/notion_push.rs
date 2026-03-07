use std::sync::Arc;

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
