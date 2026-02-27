use serde::{Deserialize, Serialize};

/// Notion API response for database query
#[derive(Debug, Deserialize)]
pub struct NotionQueryResponse {
    pub results: Vec<NotionPage>,
    pub has_more: bool,
    pub next_cursor: Option<String>,
}

/// A Notion page (represents a task)
#[derive(Debug, Deserialize)]
pub struct NotionPage {
    pub id: String,
    pub last_edited_time: String,
    pub archived: bool,
    pub properties: NotionProperties,
}

/// Task properties as they appear in Notion
#[derive(Debug, Deserialize)]
pub struct NotionProperties {
    #[serde(rename = "Name")]
    pub name: Option<NotionTitle>,
    #[serde(rename = "Status")]
    pub status: Option<NotionSelect>,
    #[serde(rename = "Due Date")]
    pub due_date: Option<NotionDate>,
}

#[derive(Debug, Deserialize)]
pub struct NotionTitle {
    pub title: Vec<NotionRichText>,
}

#[derive(Debug, Deserialize)]
pub struct NotionRichText {
    pub plain_text: String,
}

#[derive(Debug, Deserialize)]
pub struct NotionSelect {
    pub select: Option<NotionSelectOption>,
}

#[derive(Debug, Deserialize)]
pub struct NotionSelectOption {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct NotionDate {
    pub date: Option<NotionDateValue>,
}

#[derive(Debug, Deserialize)]
pub struct NotionDateValue {
    pub start: Option<String>,
}

/// Notion block children response
#[derive(Debug, Deserialize)]
pub struct NotionBlocksResponse {
    pub results: Vec<NotionBlock>,
    pub has_more: bool,
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotionBlock {
    pub id: String,
    #[serde(rename = "type")]
    pub block_type: String,
    #[serde(flatten)]
    pub data: serde_json::Value,
}
