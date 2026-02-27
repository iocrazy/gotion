use chrono::{DateTime, Utc};
use gotion_shared::models::Block;
use sqlx::PgPool;
use uuid::Uuid;

/// Database row representation for the blocks table.
#[derive(Debug, sqlx::FromRow)]
struct BlockRow {
    id: Uuid,
    task_id: Uuid,
    notion_block_id: Option<String>,
    block_type: String,
    content: serde_json::Value,
    sort_order: i32,
    updated_at: DateTime<Utc>,
}

impl From<BlockRow> for Block {
    fn from(row: BlockRow) -> Self {
        Block {
            id: row.id,
            task_id: row.task_id,
            notion_block_id: row.notion_block_id,
            block_type: row.block_type,
            content: row.content,
            sort_order: row.sort_order,
            updated_at: row.updated_at,
        }
    }
}

/// Get all blocks for a task, ordered by sort_order.
pub async fn get_blocks(pool: &PgPool, task_id: Uuid) -> Result<Vec<Block>, sqlx::Error> {
    let rows = sqlx::query_as::<_, BlockRow>(
        "SELECT id, task_id, notion_block_id, block_type, content, sort_order, updated_at \
         FROM blocks WHERE task_id = $1 \
         ORDER BY sort_order ASC",
    )
    .bind(task_id)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(Block::from).collect())
}

/// Replace all blocks for a task within a transaction:
/// delete existing blocks, insert new ones, return them.
pub async fn replace_blocks(
    pool: &PgPool,
    task_id: Uuid,
    blocks: Vec<Block>,
) -> Result<Vec<Block>, sqlx::Error> {
    let mut tx = pool.begin().await?;

    // Delete all existing blocks for this task
    sqlx::query("DELETE FROM blocks WHERE task_id = $1")
        .bind(task_id)
        .execute(&mut *tx)
        .await?;

    let now = Utc::now();
    let mut result = Vec::with_capacity(blocks.len());

    for (i, block) in blocks.into_iter().enumerate() {
        let row = sqlx::query_as::<_, BlockRow>(
            "INSERT INTO blocks (id, task_id, notion_block_id, block_type, content, sort_order, updated_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7) \
             RETURNING id, task_id, notion_block_id, block_type, content, sort_order, updated_at",
        )
        .bind(block.id)
        .bind(task_id)
        .bind(&block.notion_block_id)
        .bind(&block.block_type)
        .bind(&block.content)
        .bind(i as i32)
        .bind(now)
        .fetch_one(&mut *tx)
        .await?;

        result.push(Block::from(row));
    }

    tx.commit().await?;

    Ok(result)
}
