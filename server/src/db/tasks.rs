use chrono::{DateTime, NaiveDate, Utc};
use gotion_shared::models::{Task, TaskStatus};
use sqlx::SqlitePool;
use uuid::Uuid;

/// Database row representation for the tasks table.
#[derive(Debug, sqlx::FromRow)]
struct TaskRow {
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

fn parse_status(s: &str) -> TaskStatus {
    match s {
        "done" => TaskStatus::Done,
        _ => TaskStatus::Todo,
    }
}

fn status_to_str(s: &TaskStatus) -> &'static str {
    match s {
        TaskStatus::Todo => "todo",
        TaskStatus::Done => "done",
    }
}

fn parse_uuid(s: &str) -> Uuid {
    s.parse().unwrap_or_default()
}

fn parse_uuid_opt(s: &Option<String>) -> Option<Uuid> {
    s.as_deref().and_then(|v| v.parse().ok())
}

impl From<TaskRow> for Task {
    fn from(row: TaskRow) -> Self {
        Task {
            id: parse_uuid(&row.id),
            notion_id: row.notion_id,
            title: row.title,
            status: parse_status(&row.status),
            due_date: row.due_date,
            created_at: row.created_at,
            updated_at: row.updated_at,
            title_updated_at: row.title_updated_at,
            status_updated_at: row.status_updated_at,
            due_date_updated_at: row.due_date_updated_at,
            category_id: parse_uuid_opt(&row.category_id),
            parent_id: parse_uuid_opt(&row.parent_id),
            sort_order: row.sort_order,
            starred: row.starred,
            starred_updated_at: row.starred_updated_at,
            notion_status: row.notion_status,
        }
    }
}

/// List tasks, optionally filtered by status and/or search term, ordered by sort_order ASC, due_date ASC NULLS LAST, created_at DESC.
pub async fn list_tasks(
    pool: &SqlitePool,
    status_filter: Option<&TaskStatus>,
    search: Option<&str>,
) -> Result<Vec<Task>, sqlx::Error> {
    let base = "SELECT id, notion_id, title, status, due_date, created_at, updated_at, \
                title_updated_at, status_updated_at, due_date_updated_at, \
                category_id, parent_id, sort_order, starred, starred_updated_at, notion_status \
                FROM tasks";
    let order = "ORDER BY sort_order ASC, CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date ASC, created_at DESC";

    let mut conditions: Vec<&str> = Vec::new();
    let status_str = status_filter.map(|s| status_to_str(s).to_string());
    let search_pattern = search.map(|s| format!("%{}%", s));

    if status_str.is_some() {
        conditions.push("status = ?");
    }
    if search_pattern.is_some() {
        conditions.push("title LIKE ?");
    }

    let query_str = if conditions.is_empty() {
        format!("{} {}", base, order)
    } else {
        format!("{} WHERE {} {}", base, conditions.join(" AND "), order)
    };

    let mut query = sqlx::query_as::<_, TaskRow>(&query_str);
    if let Some(ref s) = status_str {
        query = query.bind(s);
    }
    if let Some(ref p) = search_pattern {
        query = query.bind(p);
    }

    let rows = query.fetch_all(pool).await?;
    Ok(rows.into_iter().map(Task::from).collect())
}

/// Get a single task by its UUID.
pub async fn get_task(pool: &SqlitePool, id: Uuid) -> Result<Option<Task>, sqlx::Error> {
    let row = sqlx::query_as::<_, TaskRow>(
        "SELECT id, notion_id, title, status, due_date, created_at, updated_at, \
         title_updated_at, status_updated_at, due_date_updated_at, \
         category_id, parent_id, sort_order, starred, starred_updated_at, notion_status \
         FROM tasks WHERE id = ?",
    )
    .bind(id.to_string())
    .fetch_optional(pool)
    .await?;

    Ok(row.map(Task::from))
}

/// Create a new task and return it.
pub async fn create_task(
    pool: &SqlitePool,
    title: String,
    status: Option<TaskStatus>,
    due_date: Option<NaiveDate>,
    category_id: Option<Uuid>,
    parent_id: Option<Uuid>,
    notion_status: Option<String>,
) -> Result<Task, sqlx::Error> {
    let now = Utc::now();
    let id = Uuid::new_v4();
    let status_enum = status.unwrap_or(TaskStatus::Todo);
    let status_str = status_to_str(&status_enum);
    let due_date_updated_at: Option<DateTime<Utc>> = due_date.map(|_| now);

    let row = sqlx::query_as::<_, TaskRow>(
        "INSERT INTO tasks (id, title, status, due_date, category_id, parent_id, \
         created_at, updated_at, title_updated_at, status_updated_at, due_date_updated_at, \
         starred, starred_updated_at, notion_status) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?) \
         RETURNING id, notion_id, title, status, due_date, created_at, updated_at, \
         title_updated_at, status_updated_at, due_date_updated_at, \
         category_id, parent_id, sort_order, starred, starred_updated_at, notion_status",
    )
    .bind(id.to_string())
    .bind(&title)
    .bind(status_str)
    .bind(due_date)
    .bind(category_id.map(|u| u.to_string()))
    .bind(parent_id.map(|u| u.to_string()))
    .bind(now)
    .bind(now)
    .bind(now)
    .bind(now)
    .bind(due_date_updated_at)
    .bind(&notion_status)
    .fetch_one(pool)
    .await?;

    Ok(Task::from(row))
}

/// Update an existing task with optional partial fields.
/// Tracks per-field timestamp changes (title_updated_at, status_updated_at, due_date_updated_at).
///
/// `due_date` uses `Option<Option<NaiveDate>>`:
/// - `None` means do not touch the due date field
/// - `Some(None)` means clear the due date
/// - `Some(Some(date))` means set the due date to the given value
///
/// `category_id` and `parent_id` use `Option<Option<Uuid>>`:
/// - `None` means do not touch the field
/// - `Some(None)` means clear the field (set to NULL)
/// - `Some(Some(uuid))` means set the field to the given value
pub async fn update_task(
    pool: &SqlitePool,
    id: Uuid,
    title: Option<String>,
    status: Option<TaskStatus>,
    due_date: Option<Option<NaiveDate>>,
    category_id: Option<Option<Uuid>>,
    parent_id: Option<Option<Uuid>>,
    sort_order: Option<i32>,
    starred: Option<bool>,
    notion_status: Option<String>,
) -> Result<Option<Task>, sqlx::Error> {
    // First fetch the current task to merge fields
    let existing = match get_task(pool, id).await? {
        Some(t) => t,
        None => return Ok(None),
    };

    let now = Utc::now();

    let new_title = title.as_deref().unwrap_or(&existing.title);
    let new_status_enum = status.as_ref().unwrap_or(&existing.status);
    let new_status_str = status_to_str(new_status_enum);
    let new_due_date = if let Some(dd) = due_date {
        dd
    } else {
        existing.due_date
    };
    let new_category_id = if let Some(cid) = category_id {
        cid
    } else {
        existing.category_id
    };
    let new_parent_id = if let Some(pid) = parent_id {
        pid
    } else {
        existing.parent_id
    };
    let new_sort_order = sort_order.unwrap_or(existing.sort_order);
    let new_starred = starred.unwrap_or(existing.starred);

    let new_title_updated_at = if title.is_some() {
        now
    } else {
        existing.title_updated_at
    };
    let new_status_updated_at = if status.is_some() {
        now
    } else {
        existing.status_updated_at
    };
    let new_due_date_updated_at = if due_date.is_some() {
        Some(now)
    } else {
        existing.due_date_updated_at
    };
    let new_starred_updated_at = if starred.is_some() {
        Some(now)
    } else {
        existing.starred_updated_at
    };

    let new_notion_status = notion_status.or(existing.notion_status);

    let row = sqlx::query_as::<_, TaskRow>(
        "UPDATE tasks SET title = ?, status = ?, due_date = ?, updated_at = ?, \
         title_updated_at = ?, status_updated_at = ?, due_date_updated_at = ?, \
         category_id = ?, parent_id = ?, sort_order = ?, \
         starred = ?, starred_updated_at = ?, notion_status = ? \
         WHERE id = ? \
         RETURNING id, notion_id, title, status, due_date, created_at, updated_at, \
         title_updated_at, status_updated_at, due_date_updated_at, \
         category_id, parent_id, sort_order, starred, starred_updated_at, notion_status",
    )
    .bind(new_title)
    .bind(new_status_str)
    .bind(new_due_date)
    .bind(now)
    .bind(new_title_updated_at)
    .bind(new_status_updated_at)
    .bind(new_due_date_updated_at)
    .bind(new_category_id.map(|u| u.to_string()))
    .bind(new_parent_id.map(|u| u.to_string()))
    .bind(new_sort_order)
    .bind(new_starred)
    .bind(new_starred_updated_at)
    .bind(&new_notion_status)
    .bind(id.to_string())
    .fetch_optional(pool)
    .await?;

    Ok(row.map(Task::from))
}

/// Delete a task by UUID. Returns true if the task existed and was deleted.
pub async fn delete_task(pool: &SqlitePool, id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM tasks WHERE id = ?")
        .bind(id.to_string())
        .execute(pool)
        .await?;

    Ok(result.rows_affected() > 0)
}
