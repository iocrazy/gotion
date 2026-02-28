use chrono::{DateTime, Utc};
use gotion_shared::models::Category;
use sqlx::PgPool;
use uuid::Uuid;

/// Database row representation for the categories table.
#[derive(Debug, sqlx::FromRow)]
struct CategoryRow {
    id: Uuid,
    name: String,
    icon: Option<String>,
    color: Option<String>,
    sort_order: Option<i32>,
    created_at: Option<DateTime<Utc>>,
}

impl From<CategoryRow> for Category {
    fn from(row: CategoryRow) -> Self {
        Category {
            id: row.id,
            name: row.name,
            icon: row.icon,
            color: row.color,
            sort_order: row.sort_order.unwrap_or(0),
            created_at: row.created_at.unwrap_or_else(Utc::now),
        }
    }
}

/// List all categories, ordered by sort_order ASC then name ASC.
pub async fn list_categories(pool: &PgPool) -> Result<Vec<Category>, sqlx::Error> {
    let rows = sqlx::query_as::<_, CategoryRow>(
        "SELECT id, name, icon, color, sort_order, created_at \
         FROM categories \
         ORDER BY sort_order ASC, name ASC",
    )
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(Category::from).collect())
}

/// Create a new category and return it.
pub async fn create_category(
    pool: &PgPool,
    name: String,
    icon: Option<String>,
    color: Option<String>,
    sort_order: Option<i32>,
) -> Result<Category, sqlx::Error> {
    let sort = sort_order.unwrap_or(0);

    let row = sqlx::query_as::<_, CategoryRow>(
        "INSERT INTO categories (name, icon, color, sort_order) \
         VALUES ($1, $2, $3, $4) \
         RETURNING id, name, icon, color, sort_order, created_at",
    )
    .bind(&name)
    .bind(&icon)
    .bind(&color)
    .bind(sort)
    .fetch_one(pool)
    .await?;

    Ok(Category::from(row))
}

/// Update an existing category with optional partial fields.
/// Uses COALESCE so only provided fields are changed.
pub async fn update_category(
    pool: &PgPool,
    id: Uuid,
    name: Option<String>,
    icon: Option<String>,
    color: Option<String>,
    sort_order: Option<i32>,
) -> Result<Option<Category>, sqlx::Error> {
    let row = sqlx::query_as::<_, CategoryRow>(
        "UPDATE categories SET \
         name = COALESCE($1, name), \
         icon = COALESCE($2, icon), \
         color = COALESCE($3, color), \
         sort_order = COALESCE($4, sort_order) \
         WHERE id = $5 \
         RETURNING id, name, icon, color, sort_order, created_at",
    )
    .bind(&name)
    .bind(&icon)
    .bind(&color)
    .bind(sort_order)
    .bind(id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(Category::from))
}

/// Delete a category by UUID.
/// First nullifies `category_id` on any tasks referencing this category,
/// then deletes the category row.
/// Returns true if the category existed and was deleted.
pub async fn delete_category(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    // Clear references from tasks
    sqlx::query("UPDATE tasks SET category_id = NULL WHERE category_id = $1")
        .bind(id)
        .execute(pool)
        .await?;

    let result = sqlx::query("DELETE FROM categories WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(result.rows_affected() > 0)
}
