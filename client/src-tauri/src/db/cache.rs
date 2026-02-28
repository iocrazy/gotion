use rusqlite::{Connection, params};
use std::sync::Mutex;
use std::path::PathBuf;

pub struct CacheDb {
    conn: Mutex<Connection>,
}

impl CacheDb {
    pub fn new(app_dir: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
        let db_path = app_dir.join("gotion_cache.db");
        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

        // Create tables
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'todo',
                due_date TEXT,
                updated_at TEXT NOT NULL,
                is_dirty INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS blocks (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                type TEXT NOT NULL,
                content TEXT NOT NULL,
                sort_order INTEGER NOT NULL,
                updated_at TEXT NOT NULL,
                is_dirty INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS offline_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                action TEXT NOT NULL,
                payload TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS categories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                icon TEXT,
                color TEXT,
                sort_order INTEGER NOT NULL DEFAULT 0
            );"
        ).map_err(|e| e.to_string())?;

        // Add new columns to tasks table (silently ignore if already exist)
        let _ = conn.execute("ALTER TABLE tasks ADD COLUMN category_id TEXT", []);
        let _ = conn.execute("ALTER TABLE tasks ADD COLUMN parent_id TEXT", []);
        let _ = conn.execute("ALTER TABLE tasks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0", []);

        Ok(Self { conn: Mutex::new(conn) })
    }

    /// Cache tasks from server response
    pub fn cache_tasks(&self, tasks_json: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let tasks: Vec<serde_json::Value> = serde_json::from_str(tasks_json)
            .map_err(|e| e.to_string())?;

        for task in &tasks {
            conn.execute(
                "INSERT OR REPLACE INTO tasks (id, title, status, due_date, updated_at, is_dirty, category_id, parent_id, sort_order) VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?7, ?8)",
                params![
                    task["id"].as_str().unwrap_or(""),
                    task["title"].as_str().unwrap_or(""),
                    task["status"].as_str().unwrap_or("todo"),
                    task["due_date"].as_str(),
                    task["updated_at"].as_str().unwrap_or(""),
                    task["category_id"].as_str(),
                    task["parent_id"].as_str(),
                    task["sort_order"].as_i64().unwrap_or(0),
                ],
            ).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    /// Get cached tasks
    pub fn get_cached_tasks(&self) -> Result<String, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare(
            "SELECT id, title, status, due_date, updated_at, category_id, parent_id, sort_order FROM tasks ORDER BY sort_order ASC, due_date ASC"
        ).map_err(|e| e.to_string())?;

        let tasks: Vec<serde_json::Value> = stmt.query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "title": row.get::<_, String>(1)?,
                "status": row.get::<_, String>(2)?,
                "due_date": row.get::<_, Option<String>>(3)?,
                "updated_at": row.get::<_, String>(4)?,
                "category_id": row.get::<_, Option<String>>(5)?,
                "parent_id": row.get::<_, Option<String>>(6)?,
                "sort_order": row.get::<_, i64>(7)?,
            }))
        }).map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

        serde_json::to_string(&tasks).map_err(|e| e.to_string())
    }

    /// Cache categories from server response
    pub fn cache_categories(&self, categories_json: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let categories: Vec<serde_json::Value> = serde_json::from_str(categories_json)
            .map_err(|e| e.to_string())?;
        for cat in &categories {
            conn.execute(
                "INSERT OR REPLACE INTO categories (id, name, icon, color, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    cat["id"].as_str().unwrap_or(""),
                    cat["name"].as_str().unwrap_or(""),
                    cat["icon"].as_str(),
                    cat["color"].as_str(),
                    cat["sort_order"].as_i64().unwrap_or(0),
                ],
            ).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    /// Get cached categories
    pub fn get_cached_categories(&self) -> Result<String, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare("SELECT id, name, icon, color, sort_order FROM categories ORDER BY sort_order ASC")
            .map_err(|e| e.to_string())?;
        let categories: Vec<serde_json::Value> = stmt.query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "name": row.get::<_, String>(1)?,
                "icon": row.get::<_, Option<String>>(2)?,
                "color": row.get::<_, Option<String>>(3)?,
                "sort_order": row.get::<_, i64>(4)?,
            }))
        }).map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
        serde_json::to_string(&categories).map_err(|e| e.to_string())
    }

    /// Queue an offline operation
    pub fn queue_offline_op(&self, entity_type: &str, entity_id: &str, action: &str, payload: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO offline_queue (entity_type, entity_id, action, payload, created_at) VALUES (?1, ?2, ?3, ?4, datetime('now'))",
            params![entity_type, entity_id, action, payload],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Get all queued offline operations
    pub fn get_offline_queue(&self) -> Result<String, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare(
            "SELECT id, entity_type, entity_id, action, payload, created_at FROM offline_queue ORDER BY id ASC"
        ).map_err(|e| e.to_string())?;

        let ops: Vec<serde_json::Value> = stmt.query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "entity_type": row.get::<_, String>(1)?,
                "entity_id": row.get::<_, String>(2)?,
                "action": row.get::<_, String>(3)?,
                "payload": row.get::<_, String>(4)?,
                "created_at": row.get::<_, String>(5)?,
            }))
        }).map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

        serde_json::to_string(&ops).map_err(|e| e.to_string())
    }

    /// Clear processed operations from queue
    pub fn clear_offline_queue(&self, up_to_id: i64) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM offline_queue WHERE id <= ?1", params![up_to_id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")
            .map_err(|e| e.to_string())?;
        let result = stmt.query_row(params![key], |row| row.get(0)).ok();
        Ok(result)
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }
}
