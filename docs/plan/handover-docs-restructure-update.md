# 文档更新 — AI 接手文档

> **状态**：已完成（2026-06-19）  
> **背景**：`openflare-server/` 子目录已删除，项目收敛为 monorepo；后端迁移至 Wavelet 框架，前端迁移至 `frontend/`  
> **触发**：多智能体并行分析后批量更新文档

---

## 1. 分析结论摘要

| 维度 | 主要变化 |
| --- | --- |
| 仓库形态 | 单 monorepo（`github.com/Rain-kl/Wavelet`），无 `openflare-server/` 子目录 |
| Server 入口 | `main.go` + `internal/cmd/`，非 `cmd/server/` |
| 后端分层 | `internal/apps/*/routers.go` + `logics.go`，非 `controller/service` |
| 管理 API | `/api/v1/d/*`，Session Cookie 鉴权，非 `OPENFLARE_TOKEN` |
| 边缘 API | `/api/v1/agent|relay|tunnel/*` |
| 前端 | `frontend/`，路由共置于 `app/(main)/`，非 `features/store` |
| 配置 | `config.yaml` + `APP_*`/`DB_*` 环境变量，非 `JWT_SECRET`/`DSN` |

## 2. 已更新文档（P0）

| 文件 | 更新内容 |
| --- | --- |
| `docs/design/index.md` | 重写 §仓库结构（monorepo、Wavelet 分层、API 前缀、Frontend 结构） |
| `docs/design/architecture.md` | Server 描述、鉴权方式、启动入口 |
| `docs/design/agent-design.md` | Agent API 路径 `/api/v1/agent/*` |
| `docs/reference/cli.md` | 全部命令改为仓库根目录执行 |
| `docs/reference/index.md` | 仓库结构描述 |
| `docs/deployment/deployment.md` | Compose、源码启动、配置变量 |
| `docs/deployment/server.md` | 前端构建路径、启动命令、环境变量 |
| `docs/deployment/openflared.md` | Tunnel API 路径、编译命令 |
| `docs/deployment/relay.md` | 编译命令 |
| `docs/deployment/agent.md` | 源码构建路径 |
| `docs/guideline/Constraints.md` | **新建**，消除全站断链 |
| `AGENTS.md` | 修正 skill/demo 路径 |
| `README.md` | 快速开始指向根目录 compose |

## 3. 待跟进（P1）

- [ ] `docs/reference/configuration.md` — 与 `config.example.yaml` / `.env.example` 对齐
- [ ] `docs/guide/quick-start.md`、`troubleshooting.md` — 鉴权与路径修正
- [ ] `docs/deployment/server.md` — Docker Compose 示例段落（后半部分仍有过时内容）
- [ ] `docs/DEPLOYMENT.md` — Wavelet 脚手架残留
- [ ] `docs/design/tunnel-design.md`、`pages-design.md` — API 前缀统一
- [ ] `docs/changelog/index.md` — JWT_SECRET 声明与代码对齐
- [ ] `docs/en/**` — 英文镜像同步（低优先级）

## 4. 文档维护原则

1. **单一事实来源**：配置以 `config.example.yaml` + `.env.example` 为准；目录以 `docs/design/index.md` 为准；API 以 `make swagger` 为准。
2. **禁止再引用**：`openflare-server/`、`OPENFLARE_TOKEN`、`JWT_SECRET`（除非代码重新引入）。
3. **中英文分工**：功能变更先更新中文文档；英文可标记待同步。