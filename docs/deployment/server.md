# 启动 Server

你会学到：如何从源码构建管理端前端、启动 OpenFlare Server、选择 SQLite 或 PostgreSQL，并访问 Swagger。

OpenFlare Server 是 Gin + GORM 单体控制面，负责管理端 UI、管理 API、Agent API、配置渲染、版本发布、数据存储与聚合查询。

## 前置条件

| 项目 | 要求 |
| --- | --- |
| Go | `1.25+` |
| Node.js | `18+` |
| pnpm | 推荐通过 `corepack enable` 使用项目声明的 pnpm |
| 数据库 | SQLite 文件目录可写，或可访问的 PostgreSQL 实例 |

生产环境必须配置 `app.session_secret`（或 `APP_SESSION_SECRET`），并优先使用 PostgreSQL、Redis 与 ClickHouse。

## 构建管理端前端

Go Server 会嵌入 `frontend/out` 静态产物（构建后复制到 `internal/router/root/dist`）。源码启动前先构建前端：

```bash
cd frontend
corepack enable
pnpm install
pnpm build:embed
```

常用前端检查：

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## 使用 SQLite 启动

```bash
cp config.example.yaml config.yaml
# 编辑 config.yaml：设置 session_secret，并将 database.enabled 设为 false
go run main.go all
```

默认监听 `3000` 端口，访问：

```text
http://localhost:3000
```

## 使用 PostgreSQL 启动

```bash
cp config.example.yaml config.yaml
# 编辑 config.yaml：设置 session_secret、database.* 与 redis.*
go run main.go all
```

生产环境推荐分进程部署：`go run main.go api`、`go run main.go worker`、`go run main.go scheduler`。

## 使用 Docker 启动

使用 Docker 部署可以免去本地配置 Go 与 Node.js 前端构建环境的麻烦。OpenFlare 官方提供了完整的 Dockerfile 与 Compose 配置，支持独立容器启动及多服务联动部署。

### 1. 使用 Docker Run 极速启动（以 SQLite 为例）

确保当前目录下已创建用于持久化数据库和日志的数据卷目录。运行以下命令启动 Server：

```bash
# 创建本地挂载目录
mkdir -p ./openflare-data

# 启动容器
docker run -d \
  --name openflare-server \
  -p 3000:3000 \
  -v $(pwd)/openflare-data:/data \
  -e APP_SESSION_SECRET='replace-with-a-long-random-string' \
  -e DB_ENABLED=false \
  -e SQLITE_PATH='/data/openflare.db' \
  -e LOG_LEVEL='info' \
  ghcr.io/rain-kl/openflare:latest
```

启动参数说明：
* **`-p 3000:3000`**：映射宿主机 `3000` 端口到容器内 `3000` 端口。
* **`-v $(pwd)/openflare-data:/data`**：挂载本地目录到容器的 `/data`，确保数据库文件在重启或重建容器时不丢失。
* **`APP_SESSION_SECRET`**：Session Cookie 签名密钥，生产环境必须配置。

---

### 2. 使用 Docker Compose 一键启动

推荐在生产环境使用仓库根目录的 `docker-compose.yaml`，自动编排 PostgreSQL、Redis、ClickHouse 与 Jaeger：

```bash
cp .env.example .env
docker compose up -d
```

## 命令行参数

```bash
go run main.go api       # 仅 API
go run main.go worker    # 仅 Worker
go run main.go scheduler # 仅 Scheduler
go run main.go all       # 融合模式（默认）
```

监听地址与日志由 `config.yaml`（`app.addr`、`log.*`）或 `APP_ADDR`、`LOG_*` 环境变量控制。

## 首次登录

默认账号：

| 用户名 | 密码 |
| --- | --- |
| `root` | `123456` |

首次登录后请立即修改默认密码。

## 配置要点

复制 `config.example.yaml` 为 `config.yaml`，或使用 `.env.example` 中的环境变量。关键默认值：

| 项 | 值 |
| --- | --- |
| 监听地址 | `:3000` |
| PostgreSQL 库名 | `openflare` |
| SQLite 后备 | `openflare.db` |
| `application_name` | `openflare-server` |
| Redis 键前缀 | `openflare:` |

也可使用 `docker compose up`（见根目录 `docker-compose.yaml`）拉起完整依赖栈。

### 验证

```bash
go build ./...
go test ./internal/apps/openflare/... -count=1

curl http://127.0.0.1:3000/api/v1/d/status
```
