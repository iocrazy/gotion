# Gotion

桌面浮动 TodoList 应用，双向同步 Notion 任务数据库，支持离线使用和 WebSocket 实时推送。

![Desktop Widget](docs/preview.png)

## 功能特性

- 🪟 桌面浮动窗口，毛玻璃 / 深色双主题切换，透明度可调
- 📋 任务列表，支持按状态 / 日期 / 优先级分组
- ✅ 任务状态切换（Todo / Done），优先级标识（! !! !!!）
- 📝 TipTap 富文本编辑器，支持图片
- 🔄 Notion 双向同步，字段级冲突合并
- 📡 WebSocket 实时推送，多设备秒级同步
- 💾 SQLite 离线缓存，断网可读可写

## 技术栈

| 层 | 技术 |
|---|------|
| 客户端 | Tauri 2.x + React 19 + TypeScript + TailwindCSS 4 + TipTap + Zustand |
| 服务端 | Axum (Rust) + PostgreSQL + WebSocket |
| 共享 | Rust crate — 数据模型、Notion Block ↔ TipTap JSON 转换器 |
| 构建 | Vite、Cargo workspace |

## 项目结构

```
Gotion/
├── Cargo.toml              # Workspace 根 (members: shared, server, client/src-tauri)
├── shared/                 # 共享 Rust crate: 模型、Notion 类型、转换器
├── server/                 # Axum 后端
│   ├── src/api/            # REST 路由 (tasks, blocks)
│   ├── src/db/             # PostgreSQL 操作
│   ├── src/ws/             # WebSocket 广播
│   ├── src/sync/           # Notion 轮询、推送、冲突解决
│   └── migrations/         # SQL 迁移脚本
├── client/
│   ├── src-tauri/          # Tauri Rust: 窗口控制、SQLite 缓存、离线队列
│   └── src/                # React 前端
│       ├── components/     # GlassPanel, TitleBar, TaskList, TaskItem, AddTask, Editor, TaskDetailPanel
│       ├── stores/         # Zustand (taskStore, themeStore)
│       ├── hooks/          # useWebSocket
│       └── lib/            # API 客户端, 工具函数
├── docker-compose.yml      # PostgreSQL + Server
└── docs/plans/             # 设计与实现文档
```

## 快速开始

### 环境要求

- [Rust](https://rustup.rs/) nightly（`rust-toolchain.toml` 已配置）
- [Node.js](https://nodejs.org/) >= 18
- [Docker](https://docs.docker.com/get-docker/)
- Windows: [MSYS2](https://www.msys2.org/) MinGW-w64（`/c/msys64/mingw64/bin` 需在 PATH）

### 1. 启动数据库

```bash
docker compose up -d db
```

### 2. 运行迁移

```bash
docker compose exec -T db psql -U gotion -d gotion < server/migrations/001_initial.sql
```

### 3. 配置环境变量

在项目根目录创建 `.env`：

```env
DATABASE_URL=postgres://gotion:gotion_dev@localhost:5432/gotion
NOTION_TOKEN=         # 可选，Notion Internal Integration Token
NOTION_DATABASE_ID=   # 可选，Notion 数据库 ID
RUST_LOG=info
```

### 4. 启动服务端

```bash
cargo run -p gotion-server
# 监听 http://localhost:3001
```

### 5. 启动客户端

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
| GET | `/api/tasks` | 任务列表（可选 `?status=todo\|done`） |
| POST | `/api/tasks` | 创建任务 |
| PATCH | `/api/tasks/:id` | 更新任务 |
| DELETE | `/api/tasks/:id` | 删除任务 |
| GET | `/api/tasks/:id/blocks` | 获取任务内容块 |
| PUT | `/api/tasks/:id/blocks` | 替换任务内容块 |
| WS | `/ws` | WebSocket 实时推送 |

## 同步机制

- **Notion → Server**：后台每 30s 轮询，增量同步 `last_edited_time` 之后的变更
- **Server → Notion**：任务创建/更新/删除时异步推送
- **冲突解决**：字段级 Last-Write-Wins，按 `title_updated_at`、`status_updated_at`、`due_date_updated_at` 独立比较
- **实时推送**：Server 通过 WebSocket 广播变更，客户端自动刷新

## 构建发布

```bash
cd client
npx tauri build
```

产物在 `client/src-tauri/target/release/bundle/`。

## License

MIT
