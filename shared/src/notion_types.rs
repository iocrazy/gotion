use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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
    /// All properties as a dynamic map (property name -> value)
    pub properties: HashMap<String, serde_json::Value>,
}

impl NotionPage {
    /// Extract a title property value by field name.
    pub fn get_title(&self, field_name: &str) -> Option<String> {
        let prop = self.properties.get(field_name)?;
        let title_arr = prop.get("title")?.as_array()?;
        let first = title_arr.first()?;
        first.get("plain_text")?.as_str().map(|s| s.to_string())
    }

    /// Extract a select or status property value by field name.
    /// Handles both Notion "select" and "status" property types.
    pub fn get_select(&self, field_name: &str) -> Option<String> {
        let prop = self.properties.get(field_name)?;
        // Try "select" type first
        if let Some(select) = prop.get("select") {
            if !select.is_null() {
                return select.get("name")?.as_str().map(|s| s.to_string());
            }
        }
        // Try "status" type
        if let Some(status) = prop.get("status") {
            if !status.is_null() {
                return status.get("name")?.as_str().map(|s| s.to_string());
            }
        }
        None
    }

    /// Extract the first relation ID by field name (e.g., "Parent item").
    pub fn get_relation_first(&self, field_name: &str) -> Option<String> {
        let prop = self.properties.get(field_name)?;
        let arr = prop.get("relation")?.as_array()?;
        let first = arr.first()?;
        first.get("id")?.as_str().map(|s| s.to_string())
    }

    /// Extract a checkbox property value by field name.
    pub fn get_checkbox(&self, field_name: &str) -> Option<bool> {
        let prop = self.properties.get(field_name)?;
        prop.get("checkbox")?.as_bool()
    }

    /// Extract a date property start value by field name.
    pub fn get_date_start(&self, field_name: &str) -> Option<String> {
        let prop = self.properties.get(field_name)?;
        let date = prop.get("date")?;
        if date.is_null() {
            return None;
        }
        date.get("start")?.as_str().map(|s| s.to_string())
    }
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

/// Notion database schema response
#[derive(Debug, Deserialize)]
pub struct NotionDatabase {
    pub id: String,
    pub title: Vec<NotionRichText>,
    pub properties: HashMap<String, NotionPropertySchema>,
}

#[derive(Debug, Deserialize)]
pub struct NotionPropertySchema {
    pub id: String,
    #[serde(rename = "type")]
    pub property_type: String,
    pub name: String,
    /// Select options (present for select/status types)
    #[serde(default)]
    pub select: Option<NotionSelectConfig>,
    /// Status options (present for status type)
    #[serde(default)]
    pub status: Option<NotionStatusConfig>,
}

#[derive(Debug, Deserialize)]
pub struct NotionSelectConfig {
    pub options: Vec<NotionSelectOption>,
}

#[derive(Debug, Deserialize)]
pub struct NotionStatusConfig {
    pub options: Vec<NotionSelectOption>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NotionSelectOption {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct NotionRichText {
    pub plain_text: String,
}
