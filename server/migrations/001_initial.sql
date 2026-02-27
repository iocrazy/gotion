CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE tasks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_id           TEXT UNIQUE,
  title               TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'todo',
  due_date            DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  title_updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  status_updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date_updated_at TIMESTAMPTZ,
  notion_last_edited  TIMESTAMPTZ
);

CREATE TABLE blocks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  notion_block_id TEXT,
  block_type      TEXT NOT NULL,
  content         JSONB NOT NULL DEFAULT '{}',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE images (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id        UUID REFERENCES blocks(id) ON DELETE CASCADE,
  notion_url      TEXT,
  stored_path     TEXT NOT NULL,
  uploaded_at     TIMESTAMPTZ
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_updated_at ON tasks(updated_at);
CREATE INDEX idx_blocks_task_id ON blocks(task_id);
