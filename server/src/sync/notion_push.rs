use std::sync::Arc;

use crate::sync::notion_client::NotionClient;
use gotion_shared::models::{Task, TaskStatus};

/// Push a newly created task to Notion, return the Notion page ID
pub async fn push_new_task(client: &Arc<NotionClient>, task: &Task) -> Result<String, String> {
    let status_str = match task.status {
        TaskStatus::Todo => "To Do",
        TaskStatus::Done => "Done",
    };
    let due_str = task.due_date.map(|d| d.to_string());

    match client
        .create_page(&task.title, status_str, due_str.as_deref())
        .await
    {
        Ok(page) => Ok(page.id),
        Err(e) => Err(format!("Failed to push to Notion: {}", e)),
    }
}

/// Push task updates to Notion
pub async fn push_task_update(
    client: &Arc<NotionClient>,
    notion_id: &str,
    task: &Task,
) -> Result<(), String> {
    let status_str = match task.status {
        TaskStatus::Todo => "To Do",
        TaskStatus::Done => "Done",
    };
    let due_str = task.due_date.map(|d| d.to_string());

    client
        .update_page(
            notion_id,
            Some(&task.title),
            Some(status_str),
            Some(due_str.as_deref()),
        )
        .await
        .map_err(|e| format!("Failed to update Notion: {}", e))
}

/// Archive a task in Notion
pub async fn push_task_delete(client: &Arc<NotionClient>, notion_id: &str) -> Result<(), String> {
    client
        .archive_page(notion_id)
        .await
        .map_err(|e| format!("Failed to archive in Notion: {}", e))
}
