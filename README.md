# Gotion

桌面浮动 TodoList 应用，双向同步 Notion 任务数据库，支持离线使用和 WebSocket 实时推送。

![Desktop Widget](docs/preview.png)

## 功能特性

- 🪟 桌面浮动窗口，浅色主题，红色强调色
- 📋 任务列表，支持按状态 / 日期 / 优先级分组
- ✅ 任务状态切换（Todo / Done），优先级标识（! !! !!!）
- 📝 TipTap 富文本编辑器，支持图片
- 🔄 Notion 双向同步，字段级冲突合并，Webhook 实时触发
- 📡 WebSocket 实时推送，多设备秒级同步
- 💾 SQLite 离线缓存，断网可读可写
- 🏷️ 分类管理，Notion Select 属性同步
- ⭐ 星标任务，Notion Checkbox 属性同步
- 🔍 Notion 原生状态多选筛选（Not started / In progress / On hold / Waiting for / Done / Cancelled）

## 技术栈

| 层 | 技术 |
|---|------|
| 客户端 | Tauri 2.x + React 19 + TypeScript + TailwindCSS 4 + TipTap + Zustand |
| 服务端 | Axum (Rust) + SQLite + WebSocket |
| 共享 | Rust crate — 数据模型、Notion Block ↔ TipTap JSON 转换器 |
| 构建 | Vite、Cargo workspace |
| 部署 | Docker + GitHub Actions → GHCR → Synology NAS |

## 项目结构

```
Gotion/
├── Cargo.toml              # Workspace 根 (members: shared, server, client/src-tauri)
├── shared/                 # 共享 Rust crate: 模型、Notion 类型、转换器
├── server/                 # Axum 后端
│   ├── src/api/            # REST 路由 (tasks, blocks, categories, notion, images)
│   ├── src/db/             # SQLite 操作
│   ├── src/ws/             # WebSocket 广播
│   ├── src/sync/           # Notion 轮询、推送、冲突解决、Webhook
│   ├── migrations/         # SQL 迁移脚本
│   └── Dockerfile          # 多阶段构建
├── client/
│   ├── src-tauri/          # Tauri Rust: 窗口控制、SQLite 缓存、离线队列
│   └── src/                # React 前端
│       ├── components/     # TasksView, TaskList, TaskItem, TaskDetailPanel, AddTaskPanel, ...
│       ├── stores/         # Zustand (taskStore, settingsStore, categoryStore)
│       ├── hooks/          # useWebSocket
│       └── lib/            # API 客户端
├── deploy/                 # NAS 部署配置
│   ├── docker-compose.nas.yml
│   └── README.md
├── .github/workflows/      # CI/CD
│   └── deploy.yml          # 构建镜像 → GHCR → SSH 部署到 NAS
└── docker-compose.yml      # 本地开发
```

## 快速开始

### 环境要求

- [Rust](https://rustup.rs/) 1.88+
- [Node.js](https://nodejs.org/) >= 18
- [Docker](https://docs.docker.com/get-docker/)

### 1. 启动服务端（Docker）

```bash
docker compose up -d
# 服务端监听 http://localhost:3001
# SQLite 数据库自动创建，迁移自动运行
```

### 2. 配置 Notion（可选）

启动后在客户端 Settings → Notion Sync 中配置：
- Notion Internal Integration Token
- Notion Database ID
- 字段映射（Status、Due Date、Category 等）

或通过 API 配置：
```bash
curl -X PUT http://localhost:3001/api/notion/config \
  -H "Content-Type: application/json" \
  -d '{"token":"ntn_xxx","database_id":"xxx"}'
```

### 3. 启动客户端

```bash
cd client
npm install
npx tauri dev
```

仅前端开发（浏览器预览）：

```bash
cd client
npm run dev
# 访问 http://localhost:5173
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tasks` | 任务列表（可选 `?status=todo\|done&search=xxx`） |
| POST | `/api/tasks` | 创建任务 |
| PATCH | `/api/tasks/:id` | 更新任务 |
| DELETE | `/api/tasks/:id` | 删除任务 |
| GET | `/api/tasks/:id/blocks` | 获取任务内容块 |
| PUT | `/api/tasks/:id/blocks` | 替换任务内容块 |
| GET | `/api/categories` | 分类列表 |
| POST | `/api/categories` | 创建分类 |
| PUT | `/api/categories/:id` | 更新分类 |
| DELETE | `/api/categories/:id` | 删除分类 |
| GET | `/api/notion/config` | 获取 Notion 配置 |
| PUT | `/api/notion/config` | 更新 Notion 配置 |
| POST | `/api/notion/test` | 测试 Notion 连接 |
| GET | `/api/notion/schema` | 获取 Notion 数据库 Schema |
| POST | `/api/notion/sync-now` | 手动触发同步 |
| POST | `/api/notion/webhook` | Notion Automation Webhook 接收端点 |
| WS | `/ws` | WebSocket 实时推送 |

## 同步机制

- **Notion → Server**：后台每 30s 轮询，增量同步 `last_edited_time` 之后的变更
- **Notion → Server（实时）**：Notion Database Automation 触发 Webhook，立即同步
- **Server → Notion**：任务创建/更新/删除时异步推送（标题、状态、日期、分类、星标）
- **冲突解决**：字段级 Last-Write-Wins，按 `title_updated_at`、`status_updated_at`、`due_date_updated_at` 独立比较
- **实时推送**：Server 通过 WebSocket 广播变更，客户端自动刷新

## 部署到 NAS

详见 [deploy/README.md](deploy/README.md)。

流程：`git push` → GitHub Actions 构建 Docker 镜像 → 推送 GHCR → SSH 到群晖拉取部署。

## 构建发布

```bash
cd client
npx tauri build
```

产物在 `client/src-tauri/target/release/bundle/`。

## License

MIT
