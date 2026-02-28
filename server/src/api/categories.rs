use axum::{
    extract::{Json, Path, State},
    http::StatusCode,
    routing::get,
    Router,
};
use gotion_shared::models::{Category, CreateCategoryRequest, UpdateCategoryRequest, WsMessage};
use uuid::Uuid;

use crate::api::AppState;
use crate::db;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/categories", get(list_categories).post(create_category))
        .route(
            "/api/categories/{id}",
            axum::routing::put(update_category).delete(delete_category),
        )
}

async fn list_categories(
    State(state): State<AppState>,
) -> Result<Json<Vec<Category>>, StatusCode> {
    let categories = db::categories::list_categories(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(categories))
}

async fn create_category(
    State(state): State<AppState>,
    Json(req): Json<CreateCategoryRequest>,
) -> Result<(StatusCode, Json<Category>), StatusCode> {
    let category = db::categories::create_category(
        &state.pool,
        req.name,
        req.icon,
        req.color,
        req.sort_order,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    state
        .broadcast
        .send(WsMessage::CategoryCreated(category.clone()));

    Ok((StatusCode::CREATED, Json(category)))
}

async fn update_category(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateCategoryRequest>,
) -> Result<Json<Category>, StatusCode> {
    let category = db::categories::update_category(
        &state.pool,
        id,
        req.name,
        req.icon,
        req.color,
        req.sort_order,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match category {
        Some(c) => {
            state
                .broadcast
                .send(WsMessage::CategoryUpdated(c.clone()));
            Ok(Json(c))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

async fn delete_category(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let deleted = db::categories::delete_category(&state.pool, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if deleted {
        state
            .broadcast
            .send(WsMessage::CategoryDeleted { id });
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}
