use std::collections::BTreeMap;
use std::env;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Extension, Form, Json, Router,
};
use chrono::{Duration, NaiveDateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::api::AppState;
use crate::api::auth::AuthUser;
use crate::db;

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct CreatePaymentInput {
    pub plan: String,
    pub channel: String,
}

#[derive(Serialize)]
pub struct CreatePaymentResponse {
    pub order_no: String,
    pub qr_url: String,
}

#[derive(Serialize)]
pub struct PaymentStatusResponse {
    pub status: String,
    pub plan: String,
}

#[derive(Serialize)]
pub struct SubscriptionResponse {
    pub plan: String,
    pub period: Option<String>,
    pub expires_at: Option<String>,
    pub is_pro: bool,
}

#[derive(Serialize)]
struct ErrorBody {
    message: String,
}

#[derive(Deserialize)]
pub struct XunhuNotifyForm {
    pub trade_order_id: Option<String>,
    pub open_order_id: Option<String>,
    pub status: Option<String>,
    pub hash: Option<String>,
    pub total_fee: Option<String>,
    pub order_title: Option<String>,
    pub plugins: Option<String>,
    pub appid: Option<String>,
    pub time: Option<String>,
    pub nonce_str: Option<String>,
}

#[derive(Deserialize)]
struct XunhuApiResponse {
    errcode: Option<i64>,
    errmsg: Option<String>,
    url_qrcode: Option<String>,
    url: Option<String>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn err_json(status: StatusCode, msg: impl Into<String>) -> (StatusCode, Json<ErrorBody>) {
    (
        status,
        Json(ErrorBody {
            message: msg.into(),
        }),
    )
}

fn plan_amount(plan: &str) -> Option<i64> {
    match plan {
        "pro_monthly" => Some(990),
        "pro_yearly" => Some(9900),
        _ => None,
    }
}

fn plan_period(plan: &str) -> &str {
    match plan {
        "pro_monthly" => "monthly",
        "pro_yearly" => "yearly",
        _ => "unknown",
    }
}

fn plan_days(plan: &str) -> i64 {
    match plan {
        "pro_monthly" => 30,
        "pro_yearly" => 365,
        _ => 0,
    }
}

fn generate_order_no() -> String {
    let ts = Utc::now().timestamp();
    let short_uuid = &Uuid::new_v4().to_string().replace('-', "")[..8];
    format!("GOTION_{ts}_{short_uuid}")
}

/// Build the xunhupay HMAC-MD5 signature.
/// Sort params by key, join as `key=value&key=value`, append app_secret, then MD5.
fn xunhu_sign(params: &BTreeMap<&str, String>, app_secret: &str) -> String {
    let joined: String = params
        .iter()
        .filter(|(_, v)| !v.is_empty())
        .map(|(k, v)| format!("{k}={v}"))
        .collect::<Vec<_>>()
        .join("&");

    let to_hash = format!("{joined}{app_secret}");
    format!("{:x}", md5::compute(to_hash.as_bytes()))
}

// ---------------------------------------------------------------------------
// POST /api/payment/create
// ---------------------------------------------------------------------------

async fn create_payment(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Json(input): Json<CreatePaymentInput>,
) -> Result<(StatusCode, Json<CreatePaymentResponse>), (StatusCode, Json<ErrorBody>)> {
    // Validate plan
    let amount = plan_amount(&input.plan)
        .ok_or_else(|| err_json(StatusCode::BAD_REQUEST, "Invalid plan. Use pro_monthly or pro_yearly"))?;

    // Validate channel
    if input.channel != "wechat" && input.channel != "alipay" {
        return Err(err_json(
            StatusCode::BAD_REQUEST,
            "Invalid channel. Use wechat or alipay",
        ));
    }

    // Read env vars
    let appid = env::var("XUNHU_APPID")
        .map_err(|_| err_json(StatusCode::INTERNAL_SERVER_ERROR, "Payment not configured: missing XUNHU_APPID"))?;
    let app_secret = env::var("XUNHU_APPSECRET")
        .map_err(|_| err_json(StatusCode::INTERNAL_SERVER_ERROR, "Payment not configured: missing XUNHU_APPSECRET"))?;
    let notify_url = env::var("XUNHU_NOTIFY_URL")
        .map_err(|_| err_json(StatusCode::INTERNAL_SERVER_ERROR, "Payment not configured: missing XUNHU_NOTIFY_URL"))?;

    let order_no = generate_order_no();
    let amount_yuan = format!("{:.2}", amount as f64 / 100.0);
    let title = format!("Gotion Pro {}", plan_period(&input.plan));
    let nonce_str = Uuid::new_v4().to_string().replace('-', "");

    let payment_type = match input.channel.as_str() {
        "wechat" => "wechat",
        "alipay" => "alipay",
        _ => "wechat",
    };

    // Build sorted params for signing
    let mut params = BTreeMap::new();
    params.insert("appid", appid.clone());
    params.insert("trade_order_id", order_no.clone());
    params.insert("total_fee", amount_yuan.clone());
    params.insert("title", title.clone());
    params.insert("notify_url", notify_url.clone());
    params.insert("nonce_str", nonce_str.clone());
    params.insert("type", payment_type.to_string());
    params.insert("wap_name", "Gotion".to_string());

    let hash = xunhu_sign(&params, &app_secret);

    // Build form body for the API call
    let form_params = [
        ("appid", appid.as_str()),
        ("trade_order_id", order_no.as_str()),
        ("total_fee", amount_yuan.as_str()),
        ("title", title.as_str()),
        ("notify_url", notify_url.as_str()),
        ("nonce_str", nonce_str.as_str()),
        ("type", payment_type),
        ("wap_name", "Gotion"),
        ("hash", &hash),
    ];

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.xunhupay.com/payment/do.html")
        .form(&form_params)
        .send()
        .await
        .map_err(|e| {
            tracing::error!("xunhupay request failed: {e}");
            err_json(StatusCode::BAD_GATEWAY, "Payment gateway request failed")
        })?;

    let body = resp.json::<XunhuApiResponse>().await.map_err(|e| {
        tracing::error!("xunhupay response parse failed: {e}");
        err_json(StatusCode::BAD_GATEWAY, "Payment gateway returned invalid response")
    })?;

    if body.errcode.unwrap_or(-1) != 0 {
        let msg = body.errmsg.unwrap_or_else(|| "Unknown error".to_string());
        tracing::error!("xunhupay error: {msg}");
        return Err(err_json(StatusCode::BAD_GATEWAY, format!("Payment gateway error: {msg}")));
    }

    let qr_url = body
        .url_qrcode
        .or(body.url)
        .ok_or_else(|| err_json(StatusCode::BAD_GATEWAY, "Payment gateway returned no QR URL"))?;

    // Create payment record in DB
    db::subscriptions::create_payment(
        &state.pool,
        &auth_user.user_id,
        &order_no,
        amount,
        &input.channel,
        &input.plan,
    )
    .await
    .map_err(|e| {
        tracing::error!("create payment DB error: {e}");
        err_json(StatusCode::INTERNAL_SERVER_ERROR, "Failed to create payment record")
    })?;

    Ok((
        StatusCode::OK,
        Json(CreatePaymentResponse { order_no, qr_url }),
    ))
}

// ---------------------------------------------------------------------------
// GET /api/payment/status/:order_no
// ---------------------------------------------------------------------------

async fn payment_status(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(order_no): Path<String>,
) -> Result<(StatusCode, Json<PaymentStatusResponse>), (StatusCode, Json<ErrorBody>)> {
    let payment = db::subscriptions::get_payment_by_order(&state.pool, &order_no)
        .await
        .map_err(|e| {
            tracing::error!("get payment error: {e}");
            err_json(StatusCode::INTERNAL_SERVER_ERROR, "Database error")
        })?
        .ok_or_else(|| err_json(StatusCode::NOT_FOUND, "Payment not found"))?;

    // Verify ownership
    if payment.user_id != auth_user.user_id {
        return Err(err_json(StatusCode::FORBIDDEN, "Not your payment"));
    }

    Ok((
        StatusCode::OK,
        Json(PaymentStatusResponse {
            status: payment.status,
            plan: payment.plan,
        }),
    ))
}

// ---------------------------------------------------------------------------
// POST /api/payment/notify  — PUBLIC (no auth), called by 虎皮椒
// ---------------------------------------------------------------------------

async fn payment_notify(
    State(state): State<AppState>,
    Form(form): Form<XunhuNotifyForm>,
) -> impl IntoResponse {
    let result = handle_notify(&state, form).await;
    match result {
        Ok(_) => (StatusCode::OK, "success".to_string()),
        Err(msg) => {
            tracing::error!("payment notify error: {msg}");
            (StatusCode::BAD_REQUEST, format!("fail: {msg}"))
        }
    }
}

async fn handle_notify(state: &AppState, form: XunhuNotifyForm) -> Result<(), String> {
    let app_secret = env::var("XUNHU_APPSECRET")
        .map_err(|_| "XUNHU_APPSECRET not configured".to_string())?;

    let received_hash = form.hash.as_deref().unwrap_or_default().to_string();

    // Rebuild params for signature verification (exclude hash itself)
    let mut params = BTreeMap::new();
    if let Some(v) = &form.trade_order_id {
        params.insert("trade_order_id", v.clone());
    }
    if let Some(v) = &form.open_order_id {
        params.insert("open_order_id", v.clone());
    }
    if let Some(v) = &form.status {
        params.insert("status", v.clone());
    }
    if let Some(v) = &form.total_fee {
        params.insert("total_fee", v.clone());
    }
    if let Some(v) = &form.order_title {
        params.insert("order_title", v.clone());
    }
    if let Some(v) = &form.plugins {
        params.insert("plugins", v.clone());
    }
    if let Some(v) = &form.appid {
        params.insert("appid", v.clone());
    }
    if let Some(v) = &form.time {
        params.insert("time", v.clone());
    }
    if let Some(v) = &form.nonce_str {
        params.insert("nonce_str", v.clone());
    }

    let expected_hash = xunhu_sign(&params, &app_secret);
    if expected_hash != received_hash {
        return Err("Invalid signature".to_string());
    }

    let status = form.status.as_deref().unwrap_or_default();
    if status != "OD" {
        // Not a successful payment; acknowledge but do nothing
        return Ok(());
    }

    let order_no = form
        .trade_order_id
        .as_deref()
        .ok_or_else(|| "Missing trade_order_id".to_string())?;

    let trade_no = form
        .open_order_id
        .as_deref()
        .unwrap_or_default();

    // Look up the payment
    let payment = db::subscriptions::get_payment_by_order(&state.pool, order_no)
        .await
        .map_err(|e| format!("DB error: {e}"))?
        .ok_or_else(|| "Payment not found".to_string())?;

    // Idempotency: skip if already paid
    if payment.status == "paid" {
        return Ok(());
    }

    // Mark payment as paid
    db::subscriptions::mark_payment_paid(&state.pool, order_no, trade_no)
        .await
        .map_err(|e| format!("Failed to mark payment paid: {e}"))?;

    // Calculate new expiry: extend from max(current_expires, now) + days
    let days = plan_days(&payment.plan);
    let period = plan_period(&payment.plan);

    let current_sub = db::subscriptions::get_subscription(&state.pool, &payment.user_id)
        .await
        .map_err(|e| format!("Failed to get subscription: {e}"))?;

    let now = Utc::now().naive_utc();
    let base = current_sub
        .expires_at
        .as_deref()
        .and_then(|s| NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S").ok())
        .map(|exp| if exp > now { exp } else { now })
        .unwrap_or(now);

    let new_expires = base + Duration::days(days);
    let expires_str = new_expires.format("%Y-%m-%d %H:%M:%S").to_string();

    db::subscriptions::upsert_subscription(
        &state.pool,
        &payment.user_id,
        "pro",
        Some(period),
        Some(&expires_str),
    )
    .await
    .map_err(|e| format!("Failed to upsert subscription: {e}"))?;

    tracing::info!(
        "Payment {order_no} completed. User {} upgraded to pro ({period}), expires {expires_str}",
        payment.user_id
    );

    Ok(())
}

// ---------------------------------------------------------------------------
// GET /api/subscription
// ---------------------------------------------------------------------------

async fn get_subscription(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<(StatusCode, Json<SubscriptionResponse>), (StatusCode, Json<ErrorBody>)> {
    let sub = db::subscriptions::get_subscription(&state.pool, &auth_user.user_id)
        .await
        .map_err(|e| {
            tracing::error!("get subscription error: {e}");
            err_json(StatusCode::INTERNAL_SERVER_ERROR, "Database error")
        })?;

    let is_pro = db::subscriptions::is_pro(&state.pool, &auth_user.user_id)
        .await
        .map_err(|e| {
            tracing::error!("is_pro check error: {e}");
            err_json(StatusCode::INTERNAL_SERVER_ERROR, "Database error")
        })?;

    Ok((
        StatusCode::OK,
        Json(SubscriptionResponse {
            plan: sub.plan,
            period: sub.period,
            expires_at: sub.expires_at,
            is_pro,
        }),
    ))
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/payment/create", post(create_payment))
        .route("/api/payment/status/{order_no}", get(payment_status))
        .route("/api/payment/notify", post(payment_notify))
        .route("/api/subscription", get(get_subscription))
}
