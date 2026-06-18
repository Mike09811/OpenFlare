# OpenFlare 后端迁移 — AI 接手文档

> **状态**：进行中（阶段 5 收尾）  
> **主线**：`openflare-server` 业务域已迁入 `Wavelet/internal/apps/openflare/`，阶段一通过 `/api/*` legacy 层联调旧前端  
> **关联计划**：[实现计划](./20260618-openflare-wavelet-backend-migration.md)

---

## 1. 当前任务状态

### 主线任务

将 OpenFlare 控制面后端从 `openflare-server` 迁移至 Wavelet 框架，保留旧前端 API 路径，复用 Wavelet 用户/OAuth/Cap 等平台能力，并完成 Agent/Relay/Flared 协议兼容。

### 开发分支

- 分支：`dev`（相对 `origin/dev` 领先若干提交）
- 工作区：迁移计划文档 `docs/plan/20260618-openflare-wavelet-backend-migration.md` 可能仍有未提交修改

### 已完成（✅）

- [x] **Batch 0 基建**：`compat/`、`legacy/register*.go`、`router.go` 挂载 `/api/*`
- [x] **T-AUTH ~ T-MISC** 全部 14 个业务任务队列项（见下表）
- [x] **goose 迁移** `202606190001` ~ `202606190012`（PostgreSQL + SQLite 双份）
- [x] **可观测性 v1 单表**：无 `_00`~`_09` 分片；heartbeat 持久化、访问日志查询、Relay/Flared 观测
- [x] **定时任务包** `internal/apps/openflare/tasks/`（主进程 cron，非 Asynq）
- [x] **TLS ACME** 申请/续期（lego DNS-01）
- [x] **集成测试** 4 个场景包全部通过（23 用例）
- [x] **配置默认值**：DB 名 `openflare`、监听 `:3000`、`application_name=openflare-server`、Redis 前缀 `openflare:`

### 进行中（阶段 5）

- [/] **B5-3** 旧环境数据迁移脚本 `support-files/migration/`（用户 + 业务表 ETL，含 10 分片观测数据合并）
- [/] **B5-4** `make swagger` + `make code-check` 全绿
- [/] **B5-5** 全量 API 回归（120+ 端点对照表）

### 待处理

- [ ] 生产环境：创建并**激活** config version，消除节点列表「异常」（`openresty_status=unhealthy` + `当前没有激活版本`）
- [ ] 旧前端静态托管与 Wavelet 嵌入前端的联调路径文档化（阶段二切 `Wavelet/frontend`）

---

## 2. 任务队列（委派状态）

| ID | 板块 | 状态 | 负责目录 |
|---|---|---|---|
| T-AUTH | 认证/用户/OAuth/Cap | ✅ | `legacy/register_auth.go`, `openflare/auth/`, `compat/auth.go` |
| T-OPTION | 状态/公告/Option | ✅ | `legacy/register_option.go`, `openflare/option/` |
| T-ORIGIN | 源站 | ✅ | `legacy/register_origin.go`, `openflare/origin/` |
| T-APPLYLOG | 应用日志 | ✅ | `legacy/register_apply_log.go`, `openflare/apply_log/` |
| T-PROXY | 代理规则 | ✅ | `legacy/register_proxy_route.go`, `openflare/proxy_route/` |
| T-NODE | 节点管理 | ✅ | `legacy/register_node.go`, `openflare/node/` |
| T-WAF | WAF | ✅ | `legacy/register_waf.go`, `openflare/waf/` |
| T-TLS | TLS/证书/域名/DNS | ✅ | `legacy/register_tls.go`, `openflare/tls/` |
| T-CFGVER | 配置版本 | ✅ | `legacy/register_config_version.go`, `openflare/config_version/` |
| T-AGENT | Agent API + WS | ✅ | `legacy/register_agent.go`, `openflare/agent/`, `openflare/websocket/` |
| T-PAGES | Pages 托管 | ✅ | `legacy/register_pages.go`, `openflare/pages/` |
| T-RELAY | Relay + Flared | ✅ | `legacy/register_relay_flared.go`, `openflare/relay/`, `openflare/flared/` |
| T-OBS | 仪表盘 + 可观测 | ✅ | `legacy/register_dashboard_obs.go`, `openflare/dashboard/`, `openflare/observability/` |
| T-MISC | 升级/GeoIP/UptimeKuma | ✅ | `legacy/register_misc.go`, `openflare/update/`, `openflare/geoip/`, `openflare/uptimekuma/` |

### 任务隔离规则

| 规则 | 说明 |
|---|---|
| 文件所有权 | 每个任务 **仅修改** 自己的 `internal/apps/openflare/<module>/`、对应 `legacy/register_<module>.go`、`internal/model/openflare_<module>.go`、goose SQL |
| 禁止修改 | `v1/user.go`、`v1/admin.go`、`model/users.go`、其他任务的 `register_*.go` |
| 响应格式 | 旧前端兼容 API 使用 `compat.OK/Fail/Unauthorized`（`{success,message,data}`） |
| 鉴权 | 管理端 `compat.AdminAuth()` / `compat.RootAuth()`；用户 `compat.UserAuth()`；全局 `OpenFlare-Token` 桥接见 `legacy/register.go` |
| Logic 层 | `logics.go` 使用 `context.Context`，不依赖 `*gin.Context` |
| 数据源 | `db.DB(ctx)` 获取 GORM |
| 质量门禁 | 完成后 `go build ./...` 并通过本模块测试 |

---

## 3. 核心文件与上下文

### 路由与兼容层

| 路径 | 职责 |
|---|---|
| `Wavelet/internal/router/router.go` | 在 `apiGroup` 下调用 `oflegacy.RegisterRoutes` |
| `Wavelet/internal/apps/openflare/legacy/register.go` | 汇总各 `register_*.go`；`OpenFlare-Token` 全局桥接 |
| `Wavelet/internal/apps/openflare/compat/auth.go` | JWT ↔ Session/AccessToken、角色 `of_role` 解析 |
| `Wavelet/internal/apps/openflare/compat/response.go` | Wavelet 信封 → 旧 `{success,message,data}` |

### 定时任务（OpenFlare cron）

| 文件 | Job 名 | Cron | 说明 |
|---|---|---|---|
| `tasks/database_cleanup.go` | `database_auto_cleanup` | `0 3 * * *` | 可观测数据自动清理（受 Option 开关控制） |
| `tasks/waf_ip_group_sync.go` | `waf_ip_group_sync` | `@every 5m` | WAF IP 组周期同步 |
| `tasks/uptimekuma_sync.go` | `uptime_kuma_sync` | `* * * * *` | 按 Option 间隔触发 UptimeKuma 同步 |
| `tasks/ssl_renew.go` | `ssl_renew` | `0 0 * * *` | ACME 证书自动续期 |
| `waf/register_tasks.go` | — | — | 通过 `RegisterCronJob` 注册，避免 import cycle |

**启动链路**：`wavelet api` / `wavelet all` → `bootstrap.RegisterAPI()` → `bootstrap.Init(ctx, {API:true})` → `oftasks.Start(ctx)`。  
**注意**：OpenFlare cron **仅在 API 进程**运行；`wavelet worker` / `wavelet scheduler` 负责 Wavelet 框架 Asynq 任务，与 OpenFlare cron 解耦。

### 数据库迁移

| 版本 | 内容 |
|---|---|
| `202606190001` | `of_options` |
| `202606190002` | `of_origins` |
| `202606190003` | `of_apply_logs` |
| `202606190004` | `of_proxy_routes` |
| `202606190005` | `of_nodes` |
| `202606190006` | `of_waf_*` |
| `202606190007` | `of_tls_*` |
| `202606190008` | `of_config_versions` |
| `202606190009` | `of_pages_*` |
| `202606190010` | 可观测性单表（profiles/metrics/reports/health/openresty/frps/access_logs） |
| `202606190011` | `of_node_access_logs` 复合索引 `(node_id, logged_at)` |
| `202606190012` | `of_node_obs_frpc` |

路径：`Wavelet/internal/db/migrator/goose/postgres/` 与 `sqlite/` 各一份。

### 近期修复要点（2026-06-19）

| 问题 | 根因 | 修复位置 |
|---|---|---|
| Agent 已连接但节点显示「异常」 | 无激活 config version → `openresty_status=unhealthy` | 运维：发布并激活配置版本 |
| 节点详情无错误日志 | 可观测性表未迁移 | `202606190010` + `agent/observability.go` |
| WAF IP 组未下发 | Agent sync 未实装 | `agent/waf_ip_group.go`、`waf/ip_group_sync.go` |
| Pages 包下载 404 | Agent 路由缺失 | `pages/logics.go`、`agent/routers.go` |
| 旧前端 Token 部分路由 401 | 未全局桥接 | `legacy/register.go` |
| 访问日志查询空 | 单表查询层缺失 | `model/openflare_access_log.go`、`202606190011` |
| Relay/Flared 观测缺失 | heartbeat 未持久化 | `relay/observability.go`、`flared/observability.go`、`202606190012` |

### 依赖修复

`replace github.com/rain-kl/openflare => ../` 会引入根 `go.mod` 的 `gomodule/redigo v2.0.0+incompatible`，与 `gin-contrib/sessions/redistore` 不兼容。已在 `Wavelet/go.mod` 添加 `exclude` 并锁定 `redigo v1.9.3`。

---

## 4. 集成测试

| 测试包 | 场景 | 结果 |
|---|---|---|
| `integration/auth_option_test.go` | 登录/self/option 权限/热重载 | ✅ 5/5 |
| `integration/core_chain_test.go` | 源站→规则→发布→节点→apply-log | ✅ 6/6 |
| `integration/security_test.go` | WAF/TLS/域名/DNS | ✅ 7/7 |
| `integration/agent_protocol_test.go` | Agent/Relay/Flared 协议 | ✅ 5/5 |

```bash
cd Wavelet
go test ./internal/apps/openflare/... -count=1
go build ./...
```

---

## 5. 本地启动（Wavelet 后端）

### 配置

复制 `Wavelet/config.example.yaml` → `config.yaml`，关键项：

```yaml
app:
  app_name: "openflare"
  addr: ":3000"
database:
  enabled: true
  database: "openflare"
  application_name: "openflare-server"
redis:
  key_prefix: "openflare:"
```

或使用 `.env` / 环境变量：`DB_ENABLED=true`、`DB_NAME=openflare`、`POSTGRES_DB=openflare`。

### 启动命令

```bash
cd Wavelet
# 开发：API + Worker + Scheduler 合一
go run . all

# 生产：分进程（OpenFlare cron 仅需 api 进程）
go run . api
go run . worker
go run . scheduler
```

### 阶段一旧前端联调

- **API**：指向 Wavelet `:3000` 的 `/api/*`（legacy 兼容层）
- **静态页面**：阶段一仍使用 `openflare-server/web/build`（由旧 Server 托管或独立静态服务）；Wavelet 默认嵌入的是 `Wavelet/frontend`，非旧 OpenFlare UI
- **鉴权**：旧前端使用 `OpenFlare-Token` Header；登录 `POST /api/user/login` 由 legacy 层签发 JWT

---

## 6. 待决策与遗留问题

| 项 | 说明 | 当前处理 |
|---|---|---|
| 观测数据 10 分片 → 单表 | 旧生产环境有 `node_*_XX` 分片表 | v1 单表；B5-3 ETL 脚本待建 |
| 微信登录 | Wavelet 无内置 | legacy 快捷路由已补；长期评估废弃或独立维护 |
| OpenFlare cron vs Asynq | 两套任务体系并存 | 阶段一 cron 在 API 进程；后续可迁入统一框架 |
| 节点「异常」展示 | 连接正常但无激活版本 | 属预期行为；需运维发布配置 |
| `make code-check` | 全仓库静态检查 | 阶段 5 待跑通 |

---

## 7. 下一步行动指南

新接手 AI 建议按以下顺序执行：

1. **确认环境**：`cd Wavelet && go build ./... && go test ./internal/apps/openflare/... -count=1`
2. **跑质量门禁**：`make code-check`（修复 swagger/静态检查问题）
3. **实现 B5-3**：在 `Wavelet/support-files/migration/` 编写 `users` → `w_users` 与业务表 ETL（含分片观测合并）
4. **API 回归**：对照实现计划 §12 端点表，用 curl/集成测试逐项验证
5. **联调验证**：旧前端登录 → 创建规则 → 发布并**激活** config version → Agent 心跳 → 检查节点状态与 apply-log

---

## 8. 参考文档

| 文档 | 用途 |
|---|---|
| [实现计划](./20260618-openflare-wavelet-backend-migration.md) | 完整模块清单、端点对照、分阶段验收 |
| [前端迁移计划](./20260618-openflare-wavelet-frontend-migration.md) | 阶段二 UI 迁移 |
| [`Wavelet/AGENTS.md`](../../Wavelet/AGENTS.md) | 框架 Guardrails 与 Skills |
| [`docs/guideline/Constraints.md`](../guideline/Constraints.md) | 开发约束 |
| 旧后端源码 | `openflare-server/internal/controller/`、`service/`、`model/` |
| Changelog | [`docs/changelog/index.md`](../changelog/index.md) `[Unreleased]` |