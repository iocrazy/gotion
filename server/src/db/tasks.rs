use chrono::{DateTime, NaiveDate, Utc};
use gotion_shared::models::{Task, TaskStatus};
use sqlx::PgPool;
use uuid::Uuid;

/// Database row representation for the tasks table.
#[derive(Debug, sqlx::FromRow)]
struct TaskRow {
    id: Uuid,
    notion_id: Option<String>,
    title: String,
    status: String,
    due_date: Option<NaiveDate>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    title_updated_at: DateTime<Utc>,
    status_updated_at: DateTime<Utc>,
    due_date_updated_at: Option<DateTime<Utc>>,
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

impl From<TaskRow> for Task {
    fn from(row: TaskRow) -> Self {
        Task {
            id: row.id,
            notion_id: row.notion_id,
            title: row.title,
            status: parse_status(&row.status),
            due_date: row.due_date,
            created_at: row.created_at,
            updated_at: row.updated_at,
            title_updated_at: row.title_updated_at,
            status_updated_at: row.status_updated_at,
            due_date_updated_at: row.due_date_updated_at,
        }
    }
}

/// List tasks, optionally filtered by status, ordered by due_date ASC NULLS LAST then created_at DESC.
pub async fn list_tasks(
    pool: &PgPool,
    status_filter: Option<&TaskStatus>,
) -> Result<Vec<Task>, sqlx::Error> {
    let rows = match status_filter {
        Some(status) => {
            let status_str = status_to_str(status);
            sqlx::query_as::<_, TaskRow>(
                "SELECT id, notion_id, title, status, due_date, created_at, updated_at, \
                 title_updated_at, status_updated_at, due_date_updated_at \
                 FROM tasks WHERE status = $1 \
                 ORDER BY due_date ASC NULLS LAST, created_at DESC",
            )
            .bind(status_str)
            .fetch_all(pool)
            .await?
        }
        None => {
            sqlx::query_as::<_, TaskRow>(
                "SELECT id, notion_id, title, status, due_date, created_at, updated_at, \
                 title_updated_at, status_updated_at, due_date_updated_at \
                 FROM tasks \
                 ORDER BY due_date ASC NULLS LAST, created_at DESC",
            )
            .fetch_all(pool)
            .await?
        }
    };

    Ok(rows.into_iter().map(Task::from).collect())
}

/// Get a single task by its UUID.
pub async fn get_task(pool: &PgPool, id: Uuid) -> Result<Option<Task>, sqlx::Error> {
    let row = sqlx::query_as::<_, TaskRow>(
        "SELECT id, notion_id, title, status, due_date, created_at, updated_at, \
         title_updated_at, status_updated_at, due_date_updated_at \
         FROM tasks WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(Task::from))
}

/// Create a new task and return it.
pub async fn create_task(
    pool: &PgPool,
    title: String,
    status: Option<TaskStatus>,
    due_date: Option<NaiveDate>,
) -> Result<Task, sqlx::Error> {
    let now = Utc::now();
    let status_str = status_to_str(&status.unwrap_or(TaskStatus::Todo));
    let due_date_updated_at: Option<DateTime<Utc>> = due_date.map(|_| now);

    let row = sqlx::query_as::<_, TaskRow>(
        "INSERT INTO tasks (title, status, due_date, created_at, updated_at, \
         title_updated_at, status_updated_at, due_date_updated_at) \
         VALUES ($1, $2, $3, $4, $4, $4, $4, $5) \
         RETURNING id, notion_id, title, status, due_date, created_at, updated_at, \
         title_updated_at, status_updated_at, due_date_updated_at",
    )
    .bind(&title)
    .bind(status_str)
    .bind(due_date)
    .bind(now)
    .bind(due_date_updated_at)
    .fetch_one(pool)
    .await?;

    Ok(Task::from(row))
}

/// Update an existing task with optional partial fields.
/// Tracks per-field timestamp changes (title_updated_at, status_updated_at, due_date_updated_at).
pub async fn update_task(
    pool: &PgPool,
    id: Uuid,
    title: Option<String>,
    status: Option<TaskStatus>,
    due_date: Option<NaiveDate>,
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
    let new_due_date = if due_date.is_some() {
        due_date
    } else {
        existing.due_date
    };

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

    let row = sqlx::query_as::<_, TaskRow>(
        "UPDATE tasks SET title = $1, status = $2, due_date = $3, updated_at = $4, \
         title_updated_at = $5, status_updated_at = $6, due_date_updated_at = $7 \
         WHERE id = $8 \
         RETURNING id, notion_id, title, status, due_date, created_at, updated_at, \
         title_updated_at, status_updated_at, due_date_updated_at",
    )
    .bind(new_title)
    .bind(new_status_str)
    .bind(new_due_date)
    .bind(now)
    .bind(new_title_updated_at)
    .bind(new_status_updated_at)
    .bind(new_due_date_updated_at)
    .bind(id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(Task::from))
}

/// Delete a task by UUID. Returns true if the task existed and was deleted.
pub async fn delete_task(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM tasks WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(result.rows_affected() > 0)
}
