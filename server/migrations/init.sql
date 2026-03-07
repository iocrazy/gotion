CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  icon        TEXT,
  color       TEXT,
  sort_order  INTEGER DEFAULT 0,
  created_at  TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  id                  TEXT PRIMARY KEY,
  notion_id           TEXT UNIQUE,
  title               TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'todo',
  due_date            TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  title_updated_at    TEXT NOT NULL,
  status_updated_at   TEXT NOT NULL,
  due_date_updated_at TEXT,
  category_id         TEXT REFERENCES categories(id),
  parent_id           TEXT REFERENCES tasks(id),
  sort_order          INTEGER NOT NULL DEFAULT 0,
  starred             INTEGER NOT NULL DEFAULT 0,
  starred_updated_at  TEXT,
  notion_last_edited  TEXT,
  notion_status       TEXT
);

CREATE TABLE IF NOT EXISTS blocks (
  id              TEXT PRIMARY KEY,
  task_id         TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  notion_block_id TEXT,
  block_type      TEXT NOT NULL,
  content         TEXT NOT NULL DEFAULT '{}',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS images (
  id          TEXT PRIMARY KEY,
  block_id    TEXT REFERENCES blocks(id) ON DELETE CASCADE,
  notion_url  TEXT,
  stored_path TEXT NOT NULL,
  uploaded_at TEXT
);

CREATE TABLE IF NOT EXISTS notion_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at);
CREATE INDEX IF NOT EXISTS idx_tasks_notion_id ON tasks(notion_id);
CREATE INDEX IF NOT EXISTS idx_blocks_task_id ON blocks(task_id);
