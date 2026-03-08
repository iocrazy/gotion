use chrono::{DateTime, Utc};
use gotion_shared::models::Category;
use sqlx::SqlitePool;
use uuid::Uuid;

/// Database row representation for the categories table.
#[derive(Debug, sqlx::FromRow)]
struct CategoryRow {
    id: String,
    name: String,
    icon: Option<String>,
    color: Option<String>,
    sort_order: Option<i32>,
    created_at: Option<DateTime<Utc>>,
}

impl From<CategoryRow> for Category {
    fn from(row: CategoryRow) -> Self {
        Category {
            id: row.id.parse().unwrap_or_default(),
            name: row.name,
            icon: row.icon,
            color: row.color,
            sort_order: row.sort_order.unwrap_or(0),
            created_at: row.created_at.unwrap_or_else(Utc::now),
        }
    }
}

/// Get a single category by UUID.
pub async fn get_category(pool: &SqlitePool, user_id: &str, id: Uuid) -> Result<Option<Category>, sqlx::Error> {
    let row = sqlx::query_as::<_, CategoryRow>(
        "SELECT id, name, icon, color, sort_order, created_at FROM categories WHERE id = ? AND user_id = ?",
    )
    .bind(id.to_string())
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(Category::from))
}

/// List all categories, ordered by sort_order ASC then name ASC.
pub async fn list_categories(pool: &SqlitePool, user_id: &str) -> Result<Vec<Category>, sqlx::Error> {
    let rows = sqlx::query_as::<_, CategoryRow>(
        "SELECT id, name, icon, color, sort_order, created_at \
         FROM categories \
         WHERE user_id = ? \
         ORDER BY sort_order ASC, name ASC",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(Category::from).collect())
}

/// Create a new category and return it.
pub async fn create_category(
    pool: &SqlitePool,
    user_id: &str,
    name: String,
    icon: Option<String>,
    color: Option<String>,
    sort_order: Option<i32>,
) -> Result<Category, sqlx::Error> {
    let id = Uuid::new_v4();
    let sort = sort_order.unwrap_or(0);
    let now = Utc::now();

    let row = sqlx::query_as::<_, CategoryRow>(
        "INSERT INTO categories (id, user_id, name, icon, color, sort_order, created_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?) \
         RETURNING id, name, icon, color, sort_order, created_at",
    )
    .bind(id.to_string())
    .bind(user_id)
    .bind(&name)
    .bind(&icon)
    .bind(&color)
    .bind(sort)
    .bind(now)
    .fetch_one(pool)
    .await?;

    Ok(Category::from(row))
}

/// Update an existing category with optional partial fields.
/// Uses COALESCE so only provided fields are changed.
pub async fn update_category(
    pool: &SqlitePool,
    user_id: &str,
    id: Uuid,
    name: Option<String>,
    icon: Option<String>,
    color: Option<String>,
    sort_order: Option<i32>,
) -> Result<Option<Category>, sqlx::Error> {
    let row = sqlx::query_as::<_, CategoryRow>(
        "UPDATE categories SET \
         name = COALESCE(?, name), \
         icon = COALESCE(?, icon), \
         color = COALESCE(?, color), \
         sort_order = COALESCE(?, sort_order) \
         WHERE id = ? AND user_id = ? \
         RETURNING id, name, icon, color, sort_order, created_at",
    )
    .bind(&name)
    .bind(&icon)
    .bind(&color)
    .bind(sort_order)
    .bind(id.to_string())
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(Category::from))
}

/// Delete a category by UUID.
/// First nullifies `category_id` on any tasks referencing this category,
/// then deletes the category row.
/// Returns true if the category existed and was deleted.
pub async fn delete_category(pool: &SqlitePool, user_id: &str, id: Uuid) -> Result<bool, sqlx::Error> {
    // Clear references from tasks belonging to this user
    sqlx::query("UPDATE tasks SET category_id = NULL WHERE category_id = ? AND user_id = ?")
        .bind(id.to_string())
        .bind(user_id)
        .execute(pool)
        .await?;

    let result = sqlx::query("DELETE FROM categories WHERE id = ? AND user_id = ?")
        .bind(id.to_string())
        .bind(user_id)
        .execute(pool)
        .await?;

    Ok(result.rows_affected() > 0)
}
