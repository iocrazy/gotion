use reqwest::Client;
use std::sync::Arc;
use tokio::sync::{RwLock, Semaphore};
use tokio::time::{sleep, Duration};

use gotion_shared::notion_types::*;

pub struct NotionClient {
    client: Client,
    config: RwLock<NotionConfig>,
    /// Rate limiter: 3 requests per second
    rate_limiter: Arc<Semaphore>,
}

#[derive(Clone)]
pub struct NotionConfig {
    pub token: String,
    pub database_id: String,
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
            config: RwLock::new(NotionConfig { token, database_id }),
            rate_limiter,
        }
    }

    /// Update the Notion token and/or database_id at runtime.
    pub async fn update_config(&self, token: Option<String>, database_id: Option<String>) {
        let mut config = self.config.write().await;
        if let Some(t) = token {
            config.token = t;
        }
        if let Some(db) = database_id {
            config.database_id = db;
        }
    }

    /// Get the current config snapshot.
    pub async fn get_config(&self) -> NotionConfig {
        self.config.read().await.clone()
    }

    /// Test connectivity by calling Notion /v1/users/me.
    pub async fn test_connection(&self) -> Result<String, String> {
        let config = self.config.read().await;
        if config.token.is_empty() {
            return Err("Notion token is not configured".into());
        }

        let resp = self
            .client
            .get("https://api.notion.com/v1/users/me")
            .header("Authorization", format!("Bearer {}", config.token))
            .header("Notion-Version", "2022-06-28")
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        let status = resp.status();
        let body: serde_json::Value = resp.json().await.map_err(|e| format!("Parse failed: {}", e))?;

        if status.is_success() {
            let name = body["name"].as_str().unwrap_or("unknown");
            let bot_type = body["type"].as_str().unwrap_or("bot");
            Ok(format!("Connected as {} ({})", name, bot_type))
        } else {
            let msg = body["message"].as_str().unwrap_or("Unknown error");
            Err(format!("Notion API {} - {}", status.as_u16(), msg))
        }
    }

    /// Acquire a rate-limit permit before making an API call.
    async fn acquire_rate_limit(&self) {
        let permit = self.rate_limiter.acquire().await.unwrap();
        permit.forget(); // Consumed; the background task will replenish it
    }

    /// Query the Notion database for tasks, optionally filtering by last_edited_time.
    pub async fn query_database(
        &self,
        since: Option<&str>,
    ) -> Result<Vec<NotionPage>, reqwest::Error> {
        let mut all_pages = Vec::new();
        let mut cursor: Option<String> = None;
        let config = self.config.read().await;

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

            let resp: NotionQueryResponse = self
                .client
                .post(&url)
                .header("Authorization", format!("Bearer {}", config.token))
                .header("Notion-Version", "2022-06-28")
                .header("Content-Type", "application/json")
                .json(&body)
                .send()
                .await?
                .json()
                .await?;

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
    pub async fn create_page(
        &self,
        title: &str,
        status: &str,
        due_date: Option<&str>,
    ) -> Result<NotionPage, reqwest::Error> {
        self.acquire_rate_limit().await;
        let config = self.config.read().await;

        let mut properties = serde_json::json!({
            "Name": {
                "title": [{ "text": { "content": title } }]
            },
            "Status": {
                "select": { "name": status }
            }
        });

        if let Some(date) = due_date {
            properties["Due Date"] = serde_json::json!({
                "date": { "start": date }
            });
        }

        let body = serde_json::json!({
            "parent": { "database_id": &config.database_id },
            "properties": properties
        });

        let resp = self
            .client
            .post("https://api.notion.com/v1/pages")
            .header("Authorization", format!("Bearer {}", config.token))
            .header("Notion-Version", "2022-06-28")
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?
            .json()
            .await?;

        Ok(resp)
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
    ) -> Result<(), reqwest::Error> {
        self.acquire_rate_limit().await;
        let config = self.config.read().await;

        let mut properties = serde_json::json!({});

        if let Some(t) = title {
            properties["Name"] = serde_json::json!({
                "title": [{ "text": { "content": t } }]
            });
        }

        if let Some(s) = status {
            properties["Status"] = serde_json::json!({
                "select": { "name": s }
            });
        }

        if let Some(d) = due_date {
            match d {
                Some(date) => {
                    properties["Due Date"] =
                        serde_json::json!({ "date": { "start": date } });
                }
                None => {
                    properties["Due Date"] = serde_json::json!({ "date": null });
                }
            }
        }

        let body = serde_json::json!({ "properties": properties });

        self.client
            .patch(&format!("https://api.notion.com/v1/pages/{}", page_id))
            .header("Authorization", format!("Bearer {}", config.token))
            .header("Notion-Version", "2022-06-28")
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

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
