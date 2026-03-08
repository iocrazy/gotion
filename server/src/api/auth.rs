use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::Response,
};

#[derive(Clone)]
pub struct ApiKey(pub Option<String>);

pub async fn api_key_auth(
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let api_key = request.extensions().get::<ApiKey>().cloned();

    let expected = match api_key {
        Some(ApiKey(Some(ref key))) if !key.is_empty() => key.clone(),
        _ => return Ok(next.run(request).await), // No API key configured, skip auth
    };

    // Skip auth for webhook endpoint (Notion can't send custom headers)
    let path = request.uri().path();
    if path == "/api/notion/webhook" || path == "/ws" {
        return Ok(next.run(request).await);
    }

    // Check X-API-Key header
    if let Some(header_val) = request.headers().get("x-api-key") {
        if let Ok(val) = header_val.to_str() {
            if val == expected {
                return Ok(next.run(request).await);
            }
        }
    }

    // Check ?api_key= query parameter
    if let Some(query) = request.uri().query() {
        for pair in query.split('&') {
            if let Some(val) = pair.strip_prefix("api_key=") {
                if val == expected {
                    return Ok(next.run(request).await);
                }
            }
        }
    }

    Err(StatusCode::UNAUTHORIZED)
}
