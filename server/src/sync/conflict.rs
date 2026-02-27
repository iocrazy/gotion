use chrono::{DateTime, NaiveDate, Utc};
use gotion_shared::models::{Task, TaskStatus};

/// Result of merging a local task with Notion data
pub struct MergeResult {
    pub title: String,
    pub status: TaskStatus,
    pub due_date: Option<NaiveDate>,
    pub title_updated_at: DateTime<Utc>,
    pub status_updated_at: DateTime<Utc>,
    pub due_date_updated_at: Option<DateTime<Utc>>,
    /// Fields that changed and need to be pushed back to Notion
    pub notify_notion: Vec<String>,
    /// Whether local DB needs updating
    pub local_changed: bool,
}

/// Merge local task with incoming Notion data using field-level timestamps.
/// For each field: whoever has the newer timestamp wins.
pub fn merge_task(
    local: &Task,
    notion_title: &str,
    notion_status: &str,
    notion_due_date: Option<NaiveDate>,
    notion_edited_time: DateTime<Utc>,
) -> MergeResult {
    let mut result = MergeResult {
        title: local.title.clone(),
        status: local.status.clone(),
        due_date: local.due_date,
        title_updated_at: local.title_updated_at,
        status_updated_at: local.status_updated_at,
        due_date_updated_at: local.due_date_updated_at,
        notify_notion: Vec::new(),
        local_changed: false,
    };

    // Title: compare timestamps
    if notion_edited_time > local.title_updated_at {
        if notion_title != local.title {
            result.title = notion_title.to_string();
            result.title_updated_at = notion_edited_time;
            result.local_changed = true;
        }
    } else if notion_title != local.title {
        result.notify_notion.push("title".to_string());
    }

    // Status
    let notion_task_status = match notion_status {
        "Done" => TaskStatus::Done,
        _ => TaskStatus::Todo,
    };
    if notion_edited_time > local.status_updated_at {
        if notion_task_status != local.status {
            result.status = notion_task_status;
            result.status_updated_at = notion_edited_time;
            result.local_changed = true;
        }
    } else if notion_task_status != local.status {
        result.notify_notion.push("status".to_string());
    }

    // Due date
    let local_due_updated = local.due_date_updated_at.unwrap_or(local.created_at);
    if notion_edited_time > local_due_updated {
        if notion_due_date != local.due_date {
            result.due_date = notion_due_date;
            result.due_date_updated_at = Some(notion_edited_time);
            result.local_changed = true;
        }
    } else if notion_due_date != local.due_date {
        result.notify_notion.push("due_date".to_string());
    }

    result
}
