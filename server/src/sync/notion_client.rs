use reqwest::Client;
use sqlx::SqlitePool;
use std::sync::Arc;
use tokio::sync::{RwLock, Semaphore};
use tokio::time::{sleep, Duration};

use gotion_shared::notion_types::{self, *};

pub struct NotionClient {
    client: Client,
    config: RwLock<NotionConfig>,
    /// Rate limiter: 3 requests per second
    rate_limiter: Arc<Semaphore>,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct NotionConfig {
    pub token: String,
    pub database_id: String,
    /// Field mapping: Notion property name -> Gotion field
    pub field_map: NotionFieldMap,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct NotionFieldMap {
    /// Notion property name for task title (title type)
    pub title: String,
    /// Notion property name for task status (select type)
    pub status: String,
    /// Notion property name for due date (date type)
    pub due_date: String,
    /// Notion select option name for "Todo" status
    pub status_todo: String,
    /// Notion select option name for "Done" status
    pub status_done: String,
    /// Notion property name for category (select type), empty = not mapped
    #[serde(default)]
    pub category: String,
    /// Notion property name for starred (checkbox type), empty = not mapped
    #[serde(default)]
    pub starred: String,
    /// Notion property name for parent item relation (relation type), empty = not mapped
    #[serde(default)]
    pub parent_item: String,
    /// Notion property type for status ("select" or "status"), used for correct API format
    #[serde(default = "default_status_type")]
    pub status_type: String,
}

fn default_status_type() -> String {
    "select".into()
}

impl Default for NotionFieldMap {
    fn default() -> Self {
        Self {
            title: "Name".into(),
            status: "Status".into(),
            due_date: "Due Date".into(),
            status_todo: "To Do".into(),
            status_done: "Done".into(),
            category: String::new(),
            starred: String::new(),
            parent_item: String::new(),
            status_type: "select".into(),
        }
    }
}

/// A database property with its type and select options (if applicable).
pub struct SchemaProperty {
    pub name: String,
    pub property_type: String,
    pub options: Vec<String>,
}

impl NotionClient {
    pub fn new(token: String, database_id: String) -> Self {
        let rate_limiter = Arc::new(Semaphore::new(3));

        // Spawn a background task that replenishes permits every second
        let rl = rate_limiter.clone();
        tokio::spawn(async move {
            loop {
                sleep(Duration::from_secs(1)).await;
                let available = rl.available_permits();
                if available < 3 {
                    rl.add_permits(3 - available);
                }
            }
        });

        Self {
            client: Client::new(),
            config: RwLock::new(NotionConfig {
                token,
                database_id,
                field_map: NotionFieldMap::default(),
            }),
            rate_limiter,
        }
    }

    /// Load persisted config from the database (call once at startup).
    pub async fn load_config_from_db(&self, pool: &SqlitePool) {
        let rows = sqlx::query_as::<_, ConfigRow>("SELECT key, value FROM notion_config")
            .fetch_all(pool)
            .await
            .unwrap_or_default();

        let mut config = self.config.write().await;
        for row in rows {
            match row.key.as_str() {
                "token" => config.token = row.value,
                "database_id" => config.database_id = row.value,
                "field_map" => {
                    if let Ok(fm) = serde_json::from_str::<NotionFieldMap>(&row.value) {
                        config.field_map = fm;
                    }
                }
                _ => {}
            }
        }
        let has_token = !config.token.is_empty();
        let has_db = !config.database_id.is_empty();
        tracing::info!(
            "Loaded Notion config from DB: token={}, database_id={}",
            if has_token { "yes" } else { "no" },
            if has_db { "yes" } else { "no" }
        );
    }

    /// Update the Notion token, database_id, and/or field_map at runtime,
    /// and persist to the database.
    pub async fn update_config(
        &self,
        token: Option<String>,
        database_id: Option<String>,
        field_map: Option<NotionFieldMap>,
        pool: &SqlitePool,
    ) {
        let mut config = self.config.write().await;
        if let Some(t) = token {
            config.token = t.clone();
            Self::upsert_config(pool, "token", &t).await;
        }
        if let Some(db) = database_id {
            config.database_id = db.clone();
            Self::upsert_config(pool, "database_id", &db).await;
        }
        if let Some(fm) = field_map {
            config.field_map = fm.clone();
            if let Ok(json) = serde_json::to_string(&fm) {
                Self::upsert_config(pool, "field_map", &json).await;
            }
        }
    }

    async fn upsert_config(pool: &SqlitePool, key: &str, value: &str) {
        let _ = sqlx::query(
            "INSERT INTO notion_config (key, value) VALUES (?, ?) \
             ON CONFLICT (key) DO UPDATE SET value = excluded.value",
        )
        .bind(key)
        .bind(value)
        .execute(pool)
        .await;
    }

    /// Get the current config snapshot.
    pub async fn get_config(&self) -> NotionConfig {
        self.config.read().await.clone()
    }

    /// Test with explicit token and database_id (used by the API to test form values directly).
    pub async fn test_with(&self, token: &str, database_id: &str) -> Result<String, String> {
        if token.is_empty() {
            return Err("Notion token is not configured".into());
        }

        // Step 1: Verify token
        let resp = self
            .client
            .get("https://api.notion.com/v1/users/me")
            .header("Authorization", format!("Bearer {}", token))
            .header("Notion-Version", "2022-06-28")
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        let status = resp.status();
        let body: serde_json::Value = resp.json().await.map_err(|e| format!("Parse failed: {}", e))?;

        if !status.is_success() {
            let msg = body["message"].as_str().unwrap_or("Unknown error");
            return Err(format!("Token invalid: {} - {}", status.as_u16(), msg));
        }

        let bot_name = body["name"].as_str().unwrap_or("unknown");

        // Step 2: Verify database access
        if database_id.is_empty() {
            return Ok(format!("Token OK ({}), but no Database ID configured", bot_name));
        }

        self.acquire_rate_limit().await;
        let db_resp = self
            .client
            .get(&format!("https://api.notion.com/v1/databases/{}", database_id))
            .header("Authorization", format!("Bearer {}", token))
            .header("Notion-Version", "2022-06-28")
            .send()
            .await
            .map_err(|e| format!("Database request failed: {}", e))?;

        let db_status = db_resp.status();
        if !db_status.is_success() {
            let db_body: serde_json::Value = db_resp.json().await.map_err(|e| format!("Parse failed: {}", e))?;
            let msg = db_body["message"].as_str().unwrap_or("Unknown error");
            return Err(format!("Token OK ({}), but database error: {} - {}", bot_name, db_status.as_u16(), msg));
        }

        let db_body: serde_json::Value = db_resp.json().await.map_err(|e| format!("Parse failed: {}", e))?;
        let db_title = db_body["title"]
            .as_array()
            .and_then(|arr| arr.first())
            .and_then(|t| t["plain_text"].as_str())
            .unwrap_or("Untitled");

        Ok(format!("Connected: {} → {}", bot_name, db_title))
    }

    /// Fetch the database schema (property names, types, and select options) for the configured database.
    pub async fn get_database_schema(
        &self,
    ) -> Result<Vec<SchemaProperty>, String> {
        let config = self.config.read().await;
        if config.database_id.is_empty() {
            return Err("Database ID is not configured".into());
        }

        self.acquire_rate_limit().await;

        let url = format!(
            "https://api.notion.com/v1/databases/{}",
            config.database_id
        );

        let resp = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {}", config.token))
            .header("Notion-Version", "2022-06-28")
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        let status = resp.status();
        if !status.is_success() {
            let body: serde_json::Value =
                resp.json().await.map_err(|e| format!("Parse failed: {}", e))?;
            let msg = body["message"].as_str().unwrap_or("Unknown error");
            return Err(format!("Notion API {} - {}", status.as_u16(), msg));
        }

        let db: notion_types::NotionDatabase =
            resp.json().await.map_err(|e| format!("Parse failed: {}", e))?;

        let props: Vec<SchemaProperty> = db
            .properties
            .into_values()
            .map(|p| {
                let options: Vec<String> = match (&p.select, &p.status) {
                    (Some(sel), _) => sel.options.iter().map(|o| o.name.clone()).collect(),
                    (_, Some(st)) => st.options.iter().map(|o| o.name.clone()).collect(),
                    _ => vec![],
                };
                SchemaProperty {
                    name: p.name,
                    property_type: p.property_type,
                    options,
                }
            })
            .collect();

        Ok(props)
    }

    /// Acquire a rate-limit permit before making an API call.
    async fn acquire_rate_limit(&self) {
        let permit = self.rate_limiter.acquire().await.unwrap();
        permit.forget(); // Consumed; the background task will replenish it
    }

    /// Query the Notion database for tasks, optionally filtering by last_edited_time.
    /// Check whether the client has a token and database_id configured.
    pub async fn is_configured(&self) -> bool {
        let config = self.config.read().await;
        !config.token.is_empty() && !config.database_id.is_empty()
    }

    pub async fn query_database(
        &self,
        since: Option<&str>,
    ) -> Result<Vec<NotionPage>, reqwest::Error> {
        let mut all_pages = Vec::new();
        let mut cursor: Option<String> = None;
        let config = self.config.read().await;

        if config.token.is_empty() || config.database_id.is_empty() {
            return Ok(vec![]);
        }

        loop {
            self.acquire_rate_limit().await;

            let url = format!(
                "https://api.notion.com/v1/databases/{}/query",
                config.database_id
            );

            let mut body = serde_json::json!({});

            if let Some(since_time) = since {
                body["filter"] = serde_json::json!({
                    "timestamp": "last_edited_time",
                    "last_edited_time": {
                        "after": since_time
                    }
                });
            }

            if let Some(ref c) = cursor {
                body["start_cursor"] = serde_json::json!(c);
            }

            let raw_resp = self
                .client
                .post(&url)
                .header("Authorization", format!("Bearer {}", config.token))
                .header("Notion-Version", "2022-06-28")
                .header("Content-Type", "application/json")
                .json(&body)
                .send()
                .await?;

            let resp_text = raw_resp.text().await?;
            let resp: NotionQueryResponse = match serde_json::from_str(&resp_text) {
                Ok(r) => r,
                Err(e) => {
                    tracing::error!("Failed to parse Notion query response: {}", e);
                    tracing::error!("Response snippet: {}", &resp_text[..resp_text.len().min(1000)]);
                    // Return empty to avoid crashing the poller
                    return Ok(vec![]);
                }
            };

            all_pages.extend(resp.results);

            if resp.has_more {
                cursor = resp.next_cursor;
            } else {
                break;
            }
        }

        Ok(all_pages)
    }

    /// Get blocks (content) for a page.
    pub async fn get_blocks(&self, page_id: &str) -> Result<Vec<NotionBlock>, reqwest::Error> {
        let mut all_blocks = Vec::new();
        let mut cursor: Option<String> = None;
        let config = self.config.read().await;

        loop {
            self.acquire_rate_limit().await;

            let mut url = format!(
                "https://api.notion.com/v1/blocks/{}/children",
                page_id
            );
            if let Some(ref c) = cursor {
                url = format!("{}?start_cursor={}", url, c);
            }

            let resp: NotionBlocksResponse = self
                .client
                .get(&url)
                .header("Authorization", format!("Bearer {}", config.token))
                .header("Notion-Version", "2022-06-28")
                .send()
                .await?
                .json()
                .await?;

            all_blocks.extend(resp.results);

            if resp.has_more {
                cursor = resp.next_cursor;
            } else {
                break;
            }
        }

        Ok(all_blocks)
    }

    /// Create a new page in the database.
    /// If `parent_notion_id` is provided and `parent_item` is mapped,
    /// the page is created as a sub-item with the parent relation set.
    pub async fn create_page(
        &self,
        title: &str,
        status: &str,
        due_date: Option<&str>,
        parent_notion_id: Option<&str>,
        category_name: Option<&str>,
        starred: Option<bool>,
    ) -> Result<NotionPage, String> {
        self.acquire_rate_limit().await;
        let config = self.config.read().await;
        let fm = &config.field_map;

        let status_value = if fm.status_type == "status" {
            serde_json::json!({ "status": { "name": status } })
        } else {
            serde_json::json!({ "select": { "name": status } })
        };

        let mut properties = serde_json::json!({
            fm.title.clone(): {
                "title": [{ "text": { "content": title } }]
            },
            fm.status.clone(): status_value
        });

        if let Some(date) = due_date {
            properties[&fm.due_date] = serde_json::json!({
                "date": { "start": date }
            });
        }

        // Set parent relation for sub-tasks
        if let (Some(parent_id), true) = (parent_notion_id, !fm.parent_item.is_empty()) {
            properties[&fm.parent_item] = serde_json::json!({
                "relation": [{ "id": parent_id }]
            });
        }

        // Set category (select type)
        if let (Some(cat), true) = (category_name, !fm.category.is_empty()) {
            properties[&fm.category] = serde_json::json!({
                "select": { "name": cat }
            });
        }

        // Set starred (checkbox type)
        if let (Some(star), true) = (starred, !fm.starred.is_empty()) {
            properties[&fm.starred] = serde_json::json!({
                "checkbox": star
            });
        }

        let body = serde_json::json!({
            "parent": { "database_id": &config.database_id },
            "icon": { "type": "emoji", "emoji": "📌" },
            "properties": properties
        });

        let raw_resp = self
            .client
            .post("https://api.notion.com/v1/pages")
            .header("Authorization", format!("Bearer {}", config.token))
            .header("Notion-Version", "2022-06-28")
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        let http_status = raw_resp.status();
        let resp_text = raw_resp.text().await.map_err(|e| format!("Read body failed: {}", e))?;

        if !http_status.is_success() {
            return Err(format!("Notion API {}: {}", http_status, &resp_text[..resp_text.len().min(500)]));
        }

        serde_json::from_str(&resp_text)
            .map_err(|e| format!("Parse response failed: {} — body: {}", e, &resp_text[..resp_text.len().min(500)]))
    }

    /// Update a page's properties.
    ///
    /// `due_date` uses `Option<Option<&str>>`:
    /// - `None` means do not touch the due date field
    /// - `Some(None)` means clear the due date
    /// - `Some(Some(date))` means set the due date to the given value
    pub async fn update_page(
        &self,
        page_id: &str,
        title: Option<&str>,
        status: Option<&str>,
        due_date: Option<Option<&str>>,
        category_name: Option<Option<&str>>,
        starred: Option<bool>,
    ) -> Result<(), reqwest::Error> {
        self.acquire_rate_limit().await;
        let config = self.config.read().await;
        let fm = &config.field_map;

        let mut properties = serde_json::json!({});

        if let Some(t) = title {
            properties[&fm.title] = serde_json::json!({
                "title": [{ "text": { "content": t } }]
            });
        }

        if let Some(s) = status {
            properties[&fm.status] = if fm.status_type == "status" {
                serde_json::json!({ "status": { "name": s } })
            } else {
                serde_json::json!({ "select": { "name": s } })
            };
        }

        if let Some(d) = due_date {
            match d {
                Some(date) => {
                    properties[&fm.due_date] =
                        serde_json::json!({ "date": { "start": date } });
                }
                None => {
                    properties[&fm.due_date] = serde_json::json!({ "date": null });
                }
            }
        }

        // Update category (select type)
        if !fm.category.is_empty() {
            if let Some(cat_opt) = category_name {
                match cat_opt {
                    Some(cat) => {
                        properties[&fm.category] = serde_json::json!({
                            "select": { "name": cat }
                        });
                    }
                    None => {
                        properties[&fm.category] = serde_json::json!({ "select": null });
                    }
                }
            }
        }

        // Update starred (checkbox type)
        if !fm.starred.is_empty() {
            if let Some(star) = starred {
                properties[&fm.starred] = serde_json::json!({ "checkbox": star });
            }
        }

        let body = serde_json::json!({ "properties": properties });

        let raw_resp = self.client
            .patch(&format!("https://api.notion.com/v1/pages/{}", page_id))
            .header("Authorization", format!("Bearer {}", config.token))
            .header("Notion-Version", "2022-06-28")
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !raw_resp.status().is_success() {
            let status = raw_resp.status();
            let text = raw_resp.text().await.unwrap_or_default();
            tracing::error!("Notion update_page failed ({}): {}", status, &text[..text.len().min(500)]);
        }

        Ok(())
    }

    /// Archive (soft-delete) a page.
    pub async fn archive_page(&self, page_id: &str) -> Result<(), reqwest::Error> {
        self.acquire_rate_limit().await;
        let config = self.config.read().await;

        let body = serde_json::json!({ "archived": true });

        self.client
            .patch(&format!("https://api.notion.com/v1/pages/{}", page_id))
            .header("Authorization", format!("Bearer {}", config.token))
            .header("Notion-Version", "2022-06-28")
            .json(&body)
            .send()
            .await?;

        Ok(())
    }
}

#[derive(sqlx::FromRow)]
struct ConfigRow {
    key: String,
    value: String,
}
