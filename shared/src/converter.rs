use serde_json::{json, Value};

/// Convert Notion blocks array to a TipTap document JSON
pub fn notion_blocks_to_tiptap(blocks: &[Value]) -> Value {
    let mut content: Vec<Value> = Vec::new();
    let mut current_list: Option<(&str, Vec<Value>)> = None; // (list_type, items)

    for block in blocks {
        let block_type = block["type"].as_str().unwrap_or("");

        // Check if we need to close an open list
        let is_list_item =
            block_type == "bulleted_list_item" || block_type == "numbered_list_item";
        if !is_list_item {
            if let Some((list_type, items)) = current_list.take() {
                content.push(json!({
                    "type": list_type,
                    "content": items
                }));
            }
        }

        match block_type {
            "paragraph" => {
                let text = extract_rich_text(block, "paragraph");
                content.push(json!({
                    "type": "paragraph",
                    "content": text_to_tiptap_content(&text)
                }));
            }
            "heading_1" | "heading_2" | "heading_3" => {
                let level = match block_type {
                    "heading_1" => 1,
                    "heading_2" => 2,
                    "heading_3" => 3,
                    _ => 1,
                };
                let text = extract_rich_text(block, block_type);
                content.push(json!({
                    "type": "heading",
                    "attrs": { "level": level },
                    "content": text_to_tiptap_content(&text)
                }));
            }
            "bulleted_list_item" => {
                let text = extract_rich_text(block, "bulleted_list_item");
                let item = json!({
                    "type": "listItem",
                    "content": [{
                        "type": "paragraph",
                        "content": text_to_tiptap_content(&text)
                    }]
                });
                match &mut current_list {
                    Some(("bulletList", items)) => items.push(item),
                    _ => {
                        if let Some((lt, items)) = current_list.take() {
                            content.push(json!({ "type": lt, "content": items }));
                        }
                        current_list = Some(("bulletList", vec![item]));
                    }
                }
            }
            "numbered_list_item" => {
                let text = extract_rich_text(block, "numbered_list_item");
                let item = json!({
                    "type": "listItem",
                    "content": [{
                        "type": "paragraph",
                        "content": text_to_tiptap_content(&text)
                    }]
                });
                match &mut current_list {
                    Some(("orderedList", items)) => items.push(item),
                    _ => {
                        if let Some((lt, items)) = current_list.take() {
                            content.push(json!({ "type": lt, "content": items }));
                        }
                        current_list = Some(("orderedList", vec![item]));
                    }
                }
            }
            "image" => {
                let url = block["image"]["file"]["url"]
                    .as_str()
                    .or_else(|| block["image"]["external"]["url"].as_str())
                    .unwrap_or("");
                if !url.is_empty() {
                    content.push(json!({
                        "type": "image",
                        "attrs": { "src": url }
                    }));
                }
            }
            "code" => {
                let text = extract_rich_text(block, "code");
                let language = block["code"]["language"].as_str().unwrap_or("plain text");
                content.push(json!({
                    "type": "codeBlock",
                    "attrs": { "language": language },
                    "content": [{ "type": "text", "text": text }]
                }));
            }
            _ => {
                // Unknown block type - try to extract text, fall back to empty paragraph
                let text = extract_rich_text(block, block_type);
                if !text.is_empty() {
                    content.push(json!({
                        "type": "paragraph",
                        "content": text_to_tiptap_content(&text)
                    }));
                }
            }
        }
    }

    // Close any remaining list
    if let Some((list_type, items)) = current_list {
        content.push(json!({
            "type": list_type,
            "content": items
        }));
    }

    json!({
        "type": "doc",
        "content": content
    })
}

/// Convert TipTap document JSON to Notion blocks array
pub fn tiptap_to_notion_blocks(doc: &Value) -> Vec<Value> {
    let mut blocks = Vec::new();

    let content = match doc["content"].as_array() {
        Some(arr) => arr,
        None => return blocks,
    };

    for node in content {
        let node_type = node["type"].as_str().unwrap_or("");

        match node_type {
            "paragraph" => {
                let text = tiptap_content_to_text(node);
                blocks.push(json!({
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": text_to_notion_rich_text(&text)
                    }
                }));
            }
            "heading" => {
                let level = node["attrs"]["level"].as_u64().unwrap_or(1);
                let text = tiptap_content_to_text(node);
                let heading_type = format!("heading_{}", level);
                let mut block = serde_json::Map::new();
                block.insert("type".to_string(), json!(&heading_type));
                block.insert(
                    heading_type,
                    json!({
                        "rich_text": text_to_notion_rich_text(&text)
                    }),
                );
                blocks.push(Value::Object(block));
            }
            "bulletList" => {
                if let Some(items) = node["content"].as_array() {
                    for item in items {
                        let text = tiptap_list_item_to_text(item);
                        blocks.push(json!({
                            "type": "bulleted_list_item",
                            "bulleted_list_item": {
                                "rich_text": text_to_notion_rich_text(&text)
                            }
                        }));
                    }
                }
            }
            "orderedList" => {
                if let Some(items) = node["content"].as_array() {
                    for item in items {
                        let text = tiptap_list_item_to_text(item);
                        blocks.push(json!({
                            "type": "numbered_list_item",
                            "numbered_list_item": {
                                "rich_text": text_to_notion_rich_text(&text)
                            }
                        }));
                    }
                }
            }
            "image" => {
                let src = node["attrs"]["src"].as_str().unwrap_or("");
                if !src.is_empty() {
                    blocks.push(json!({
                        "type": "image",
                        "image": {
                            "type": "external",
                            "external": { "url": src }
                        }
                    }));
                }
            }
            "codeBlock" => {
                let text = tiptap_content_to_text(node);
                let language = node["attrs"]["language"].as_str().unwrap_or("plain text");
                blocks.push(json!({
                    "type": "code",
                    "code": {
                        "rich_text": text_to_notion_rich_text(&text),
                        "language": language
                    }
                }));
            }
            _ => {}
        }
    }

    blocks
}

// --- Helper functions ---

fn extract_rich_text(block: &Value, block_type: &str) -> String {
    block[block_type]["rich_text"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|rt| rt["plain_text"].as_str())
                .collect::<Vec<_>>()
                .join("")
        })
        .unwrap_or_default()
}

fn text_to_tiptap_content(text: &str) -> Vec<Value> {
    if text.is_empty() {
        return vec![];
    }
    vec![json!({ "type": "text", "text": text })]
}

fn tiptap_content_to_text(node: &Value) -> String {
    node["content"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|n| n["text"].as_str())
                .collect::<Vec<_>>()
                .join("")
        })
        .unwrap_or_default()
}

fn tiptap_list_item_to_text(item: &Value) -> String {
    // listItem > paragraph > text
    item["content"]
        .as_array()
        .and_then(|arr| arr.first())
        .map(|p| tiptap_content_to_text(p))
        .unwrap_or_default()
}

fn text_to_notion_rich_text(text: &str) -> Vec<Value> {
    if text.is_empty() {
        return vec![];
    }
    vec![json!({
        "type": "text",
        "text": { "content": text }
    })]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_paragraph_roundtrip() {
        let notion_blocks = vec![json!({
            "type": "paragraph",
            "paragraph": {
                "rich_text": [{ "plain_text": "Hello world" }]
            }
        })];

        let tiptap = notion_blocks_to_tiptap(&notion_blocks);
        assert_eq!(tiptap["type"], "doc");
        assert_eq!(tiptap["content"][0]["type"], "paragraph");
        assert_eq!(tiptap["content"][0]["content"][0]["text"], "Hello world");

        let back = tiptap_to_notion_blocks(&tiptap);
        assert_eq!(back.len(), 1);
        assert_eq!(back[0]["type"], "paragraph");
        assert_eq!(
            back[0]["paragraph"]["rich_text"][0]["text"]["content"],
            "Hello world"
        );
    }

    #[test]
    fn test_heading_roundtrip() {
        let notion_blocks = vec![json!({
            "type": "heading_2",
            "heading_2": {
                "rich_text": [{ "plain_text": "My Heading" }]
            }
        })];

        let tiptap = notion_blocks_to_tiptap(&notion_blocks);
        assert_eq!(tiptap["content"][0]["type"], "heading");
        assert_eq!(tiptap["content"][0]["attrs"]["level"], 2);
        assert_eq!(tiptap["content"][0]["content"][0]["text"], "My Heading");
    }

    #[test]
    fn test_bullet_list() {
        let notion_blocks = vec![
            json!({
                "type": "bulleted_list_item",
                "bulleted_list_item": {
                    "rich_text": [{ "plain_text": "Item 1" }]
                }
            }),
            json!({
                "type": "bulleted_list_item",
                "bulleted_list_item": {
                    "rich_text": [{ "plain_text": "Item 2" }]
                }
            }),
        ];

        let tiptap = notion_blocks_to_tiptap(&notion_blocks);
        assert_eq!(tiptap["content"][0]["type"], "bulletList");
        assert_eq!(
            tiptap["content"][0]["content"].as_array().unwrap().len(),
            2
        );
    }

    #[test]
    fn test_image() {
        let notion_blocks = vec![json!({
            "type": "image",
            "image": {
                "type": "external",
                "external": { "url": "https://example.com/img.png" }
            }
        })];

        let tiptap = notion_blocks_to_tiptap(&notion_blocks);
        assert_eq!(tiptap["content"][0]["type"], "image");
        assert_eq!(
            tiptap["content"][0]["attrs"]["src"],
            "https://example.com/img.png"
        );
    }
}
