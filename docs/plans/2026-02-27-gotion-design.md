# Gotion 设计文档

桌面悬浮 TodoList 应用，以 Notion Task 数据库为云端数据源，通过自建后端实现 WebSocket 秒级推送和双向同步，支持离线编辑。

## 目标平台

| 平台 | 方案 | 优先级 |
|------|------|--------|
| macOS | Tauri 2.x 桌面应用 | MVP |
| Windows | Tauri 2.x 桌面应用 | MVP |
| Web | 同一套 React 部署为 SPA | MVP |
| iOS | Swift WidgetKit 主屏幕小组件 | 未来 |

## MVP 功能范围

- 任务清单（按日期分组）
- 状态筛选（未完成 / 已完成）
- 任务 CRUD（新建、编辑、完成、删除）
- 富文本内容编辑（段落、标题、列表、图片）
- 离线可读写，联网后自动双向同步
- WebSocket 秒级实时推送
- 悬浮窗口：透明磨砂玻璃、可拖拽、可配置置顶、边缘吸附

## 技术栈

### 客户端

| 层 | 技术 | 用途 |
|---|------|------|
| 框架 | Tauri 2.x | 桌面应用壳 + Rust 本地逻辑 |
| 前端 | React 19 + TypeScript | UI |
| 构建 | Vite | 前端打包 |
| 样式 | TailwindCSS | 磨砂玻璃 + 响应式 |
| 编辑器 | TipTap (ProseMirror) | 富文本编辑 |
| 状态管理 | Zustand | 轻量 store |
| 本地数据库 | SQLite (rusqlite) | 离线缓存 |

### 服务端

| 层 | 技术 | 用途 |
|---|------|------|
| Web 框架 | Axum (Rust) | REST API + WebSocket |
| 数据库 | PostgreSQL | 服务端数据存储 |
| 异步运行时 | Tokio | 异步 I/O |
| DB 驱动 | sqlx | 异步 PostgreSQL |
| HTTP 客户端 | reqwest | 调用 Notion API |
| 部署 | Docker Compose | 后端 + PostgreSQL |

### 共享

| 层 | 技术 | 用途 |
|---|------|------|
| 共享库 | Rust crate (shared) | 数据模型、Notion 类型、Block 转换器 |
| 认证 | Notion Internal Integration | 个人使用，Token 存服务端 |

## 架构总览

```
┌────────────┐  ┌────────────┐  ┌────────────┐
│ macOS App  │  │ Windows App│  │  Web 端     │
│  (SQLite)  │  │  (SQLite)  │  │ (IndexedDB) │
└─────┬──────┘  └─────┬──────┘  └─────┬──────┘
      │               │               │
      └───── WebSocket + REST API ─────┘
                      │
         ┌────────────┴────────────┐
         │   Gotion 后端 (Axum)     │
         │                         │
         │  ┌───────────────────┐  │
         │  │   PostgreSQL      │  │
         │  └───────────────────┘  │
         │                         │
         │  ┌───────────────────┐  │
         │  │  Notion 同步引擎   │  │
         │  └───────────────────┘  │
         └────────────┬────────────┘
                      │
              Notion API (定时同步)
```

### 职责划分

| 模块 | 职责 |
|------|------|
| 客户端 Rust (Tauri) | 窗口控制、SQLite 离线缓存、WebSocket 客户端、离线队列 |
| 客户端 React | UI 渲染、TipTap 编辑器、用户交互 |
| 服务端 (Axum) | REST API、WebSocket 推送、Notion 同步引擎、冲突处理 |
| shared crate | Task/Block 数据模型、Notion Block ↔ TipTap JSON 转换器 |

## 数据模型

### 服务端 (PostgreSQL)

```sql
CREATE TABLE tasks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_id           TEXT,
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
  type            TEXT NOT NULL,
  content         JSONB NOT NULL,
  sort_order      INTEGER NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE images (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id        UUID REFERENCES blocks(id) ON DELETE CASCADE,
  notion_url      TEXT,
  stored_path     TEXT NOT NULL,
  uploaded_at     TIMESTAMPTZ
);
```

### 客户端 (SQLite 离线缓存)

```sql
CREATE TABLE tasks (
  id                  TEXT PRIMARY KEY,
  title               TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'todo',
  due_date            TEXT,
  updated_at          INTEGER NOT NULL,
  is_dirty            INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE blocks (
  id              TEXT PRIMARY KEY,
  task_id         TEXT NOT NULL REFERENCES tasks(id),
  type            TEXT NOT NULL,
  content         TEXT NOT NULL,
  sort_order      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  is_dirty        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE offline_queue (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  action        TEXT NOT NULL,
  payload       TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);
```

## 同步设计

### 认证

Notion Internal Integration Token 存储在服务端环境变量中，客户端不直接接触 Notion Token。

### 实时推送流程

```
用户在 App 编辑任务:
  App → REST API → 服务端写入 PostgreSQL
      → 服务端通过 WebSocket 推送给其他在线设备
      → 服务端异步推送到 Notion API

Notion 侧有变更 (如用户在 Notion 网页编辑):
  服务端定时轮询 Notion (每 10-30s)
      → 检测到变更 → 写入 PostgreSQL
      → WebSocket 推送给所有在线设备

设备离线后重新上线:
  App 建立 WebSocket 连接 → 服务端推送离线期间的增量变更
  App 上传本地 offline_queue → 服务端处理合并
```

### 冲突处理

字段级合并策略（服务端集中处理）：

- 每个字段独立记录 `updated_at` 时间戳
- 不同字段变更：各取最新值，无冲突合并
- 同字段冲突：时间戳晚的赢（Last-Write-Wins）
- 内容 blocks：以 block 为单位对比，非同一 block 无冲突

### 图片处理

- 上传：App 插入图片 → 上传到服务端 → 服务端存储并异步推到 Notion
- 下载：服务端从 Notion 拉取图片 → 客户端从服务端下载缓存到本地
- Notion 图片 URL 有过期时间，服务端统一管理刷新

## 服务端 API 设计

### REST API

```
POST   /api/tasks              创建任务
GET    /api/tasks              查询任务列表 (支持状态筛选)
PATCH  /api/tasks/:id          更新任务属性
DELETE /api/tasks/:id          删除任务

GET    /api/tasks/:id/blocks   获取内容 blocks
PUT    /api/tasks/:id/blocks   更新内容 blocks

POST   /api/sync/push          客户端上传离线变更队列
GET    /api/sync/pull?since=   拉取指定时间后的增量变更

POST   /api/images/upload      上传图片
GET    /api/images/:id         获取图片
```

### WebSocket

```
连接: ws://your-domain/ws

服务端 → 客户端:
  { "type": "task_created",   "data": {...} }
  { "type": "task_updated",   "data": {...} }
  { "type": "task_deleted",   "data": {...} }
  { "type": "blocks_updated", "data": {...} }

客户端 → 服务端:
  { "type": "ping" }  (心跳保活)
```

## 窗口控制

### Tauri 窗口配置

```jsonc
{
  "app": {
    "windows": [{
      "title": "Gotion",
      "width": 380,
      "height": 520,
      "transparent": true,
      "decorations": false,
      "alwaysOnTop": false,
      "resizable": true
    }]
  }
}
```

### 功能

- **透明磨砂**：Tauri `transparent: true` + CSS `backdrop-filter: blur(20px)` + 系统 vibrancy
- **自定义标题栏**：React 组件 + `data-tauri-drag-region` 拖拽
- **置顶切换**：标题栏图钉按钮 → 调用 Rust `set_always_on_top()`
- **边缘吸附**：拖拽结束时检测窗口距屏幕边缘 < 20px → 自动吸附到边缘（带动画）

## 项目结构

```
gotion/
├── Cargo.toml                      # Workspace 根配置
├── docker-compose.yml              # 部署: 后端 + PostgreSQL
│
├── shared/                         # 共享 Rust 代码
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── models.rs               # Task/Block 数据结构
│       ├── notion_types.rs         # Notion API 类型定义
│       └── converter.rs            # Notion Blocks ↔ TipTap JSON 转换
│
├── server/                         # 服务端 (Axum)
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs
│       ├── api/
│       │   ├── mod.rs
│       │   ├── tasks.rs            # REST 任务接口
│       │   ├── blocks.rs           # REST 内容接口
│       │   ├── images.rs           # 图片上传/获取
│       │   └── sync.rs             # 离线同步接口
│       ├── ws/
│       │   └── handler.rs          # WebSocket 连接管理 + 推送
│       ├── db/
│       │   └── postgres.rs         # PostgreSQL 操作
│       └── sync/
│           ├── notion_poller.rs    # 定时轮询 Notion 变更
│           ├── notion_push.rs      # 推送变更到 Notion
│           └── conflict.rs         # 冲突处理
│
├── client/                         # 客户端
│   ├── src-tauri/                  # Tauri Rust 端
│   │   ├── Cargo.toml
│   │   ├── tauri.conf.json
│   │   └── src/
│   │       ├── main.rs
│   │       ├── commands/
│   │       │   ├── mod.rs
│   │       │   ├── tasks.rs        # 调后端 API + 本地缓存
│   │       │   └── window.rs       # 窗口控制
│   │       ├── db/
│   │       │   └── cache.rs        # SQLite 离线缓存
│   │       ├── ws/
│   │       │   └── client.rs       # WebSocket 客户端
│   │       ├── sync/
│   │       │   └── offline_queue.rs
│   │       └── window/
│   │           └── snap.rs         # 边缘吸附
│   │
│   ├── src/                        # React 前端
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── TaskList.tsx
│   │   │   ├── TaskItem.tsx
│   │   │   ├── StatusFilter.tsx
│   │   │   ├── Editor.tsx          # TipTap 编辑器
│   │   │   ├── TitleBar.tsx
│   │   │   └── GlassPanel.tsx
│   │   ├── hooks/
│   │   │   ├── useTasks.ts
│   │   │   ├── useWebSocket.ts
│   │   │   └── useSyncStatus.ts
│   │   ├── stores/
│   │   │   └── taskStore.ts        # Zustand
│   │   ├── styles/
│   │   │   └── globals.css
│   │   └── lib/
│   │       ├── api.ts              # REST API 调用封装
│   │       └── tauriCommands.ts    # Tauri IPC 调用封装
│   │
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── vite.config.ts
```

## Notion API 通信 (服务端处理)

### 关键端点

| 操作 | 方法 | 端点 |
|------|------|------|
| 查询任务列表 | POST | `/databases/{db_id}/query` |
| 创建任务 | POST | `/pages` |
| 更新任务属性 | PATCH | `/pages/{page_id}` |
| 归档任务 | PATCH | `/pages/{page_id}` (archived: true) |
| 读取内容 blocks | GET | `/blocks/{page_id}/children` |
| 更新 block | PATCH | `/blocks/{block_id}` |
| 追加 blocks | PATCH | `/blocks/{page_id}/children` |
| 删除 block | DELETE | `/blocks/{block_id}` |

### 限制

- 速率：3 请求/秒，服务端统一用 token bucket 节流
- 分页：每次最多 100 条，用 `start_cursor` 翻页
- 增量过滤：`last_edited_time` 支持增量同步
