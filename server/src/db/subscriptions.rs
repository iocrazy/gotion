use chrono::Utc;
use serde::Serialize;
use sqlx::SqlitePool;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Subscription {
    pub id: String,
    pub user_id: String,
    pub plan: String,
    pub period: Option<String>,
    pub expires_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Payment {
    pub id: String,
    pub user_id: String,
    pub order_no: String,
    pub trade_no: Option<String>,
    pub amount: i64,
    pub channel: String,
    pub status: String,
    pub plan: String,
    pub created_at: String,
    pub paid_at: Option<String>,
}

/// Get a user's subscription, returning a default Free subscription if none exists.
pub async fn get_subscription(
    pool: &SqlitePool,
    user_id: &str,
) -> Result<Subscription, sqlx::Error> {
    let row = sqlx::query_as::<_, Subscription>(
        "SELECT id, user_id, plan, period, expires_at, created_at, updated_at \
         FROM subscriptions WHERE user_id = ?",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    Ok(row.unwrap_or_else(|| {
        let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        Subscription {
            id: String::new(),
            user_id: user_id.to_string(),
            plan: "free".to_string(),
            period: None,
            expires_at: None,
            created_at: now.clone(),
            updated_at: now,
        }
    }))
}

/// Insert or update a subscription for a user (upsert on user_id uniqueness).
pub async fn upsert_subscription(
    pool: &SqlitePool,
    user_id: &str,
    plan: &str,
    period: Option<&str>,
    expires_at: Option<&str>,
) -> Result<Subscription, sqlx::Error> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    sqlx::query(
        "INSERT INTO subscriptions (id, user_id, plan, period, expires_at, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?) \
         ON CONFLICT(user_id) DO UPDATE SET \
           plan = excluded.plan, \
           period = excluded.period, \
           expires_at = excluded.expires_at, \
           updated_at = excluded.updated_at",
    )
    .bind(&id)
    .bind(user_id)
    .bind(plan)
    .bind(period)
    .bind(expires_at)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await?;

    get_subscription(pool, user_id).await
}

/// Create a new payment record.
pub async fn create_payment(
    pool: &SqlitePool,
    user_id: &str,
    order_no: &str,
    amount: i64,
    channel: &str,
    plan: &str,
) -> Result<Payment, sqlx::Error> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    sqlx::query_as::<_, Payment>(
        "INSERT INTO payments (id, user_id, order_no, amount, channel, status, plan, created_at) \
         VALUES (?, ?, ?, ?, ?, 'pending', ?, ?) \
         RETURNING id, user_id, order_no, trade_no, amount, channel, status, plan, created_at, paid_at",
    )
    .bind(&id)
    .bind(user_id)
    .bind(order_no)
    .bind(amount)
    .bind(channel)
    .bind(plan)
    .bind(&now)
    .fetch_one(pool)
    .await
}

/// Look up a payment by its order number.
pub async fn get_payment_by_order(
    pool: &SqlitePool,
    order_no: &str,
) -> Result<Option<Payment>, sqlx::Error> {
    sqlx::query_as::<_, Payment>(
        "SELECT id, user_id, order_no, trade_no, amount, channel, status, plan, created_at, paid_at \
         FROM payments WHERE order_no = ?",
    )
    .bind(order_no)
    .fetch_optional(pool)
    .await
}

/// Mark a payment as paid by setting its status, trade_no, and paid_at timestamp.
pub async fn mark_payment_paid(
    pool: &SqlitePool,
    order_no: &str,
    trade_no: &str,
) -> Result<(), sqlx::Error> {
    let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    sqlx::query(
        "UPDATE payments SET status = 'paid', trade_no = ?, paid_at = ? WHERE order_no = ?",
    )
    .bind(trade_no)
    .bind(&now)
    .bind(order_no)
    .execute(pool)
    .await?;

    Ok(())
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct SubscriptionWithUser {
    pub id: String,
    pub user_id: String,
    pub username: Option<String>,
    pub email: Option<String>,
    pub plan: String,
    pub period: Option<String>,
    pub expires_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// List all subscriptions with user info (admin).
pub async fn list_subscriptions(pool: &SqlitePool) -> Result<Vec<SubscriptionWithUser>, sqlx::Error> {
    sqlx::query_as::<_, SubscriptionWithUser>(
        "SELECT s.id, s.user_id, u.username, u.email, s.plan, s.period, s.expires_at, s.created_at, s.updated_at \
         FROM subscriptions s \
         LEFT JOIN users u ON u.id = s.user_id \
         ORDER BY s.created_at ASC",
    )
    .fetch_all(pool)
    .await
}

/// List all payments (admin).
pub async fn list_payments(pool: &SqlitePool) -> Result<Vec<Payment>, sqlx::Error> {
    sqlx::query_as::<_, Payment>(
        "SELECT id, user_id, order_no, trade_no, amount, channel, status, plan, created_at, paid_at \
         FROM payments ORDER BY created_at DESC",
    )
    .fetch_all(pool)
    .await
}

/// Check whether a user has an active Pro subscription (plan = 'pro' and not expired).
pub async fn is_pro(pool: &SqlitePool, user_id: &str) -> Result<bool, sqlx::Error> {
    let sub = get_subscription(pool, user_id).await?;

    if sub.plan != "pro" {
        return Ok(false);
    }

    // If there is no expiration, treat as perpetual pro
    let Some(expires_at) = &sub.expires_at else {
        return Ok(true);
    };

    // Parse the stored datetime and compare with current UTC time
    let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    Ok(expires_at.as_str() > now.as_str())
}
