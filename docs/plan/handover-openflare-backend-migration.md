# OpenFlare 后端迁移 — AI 接手文档

> **状态**：进行中（阶段 5 收尾）  
> **主线**：`openflare-server` 业务域已迁入 `Wavelet/internal/apps/openflare/`；管理控制台走 `/api/v1/d/*` + `Wavelet/frontend`；节点协议走 `/api/v1/agent|relay|tunnel/*`  
> **关联计划**：[实现计划](./20260618-openflare-wavelet-backend-migration.md)

---

## 1. 当前任务状态

### 主线任务

将 OpenFlare 控制面后端从 `openflare-server` 迁移至 Wavelet 框架，复用 Wavelet 用户/OAuth/Cap 等平台能力，并完成 Agent/Relay/Tunnel 协议兼容。

**架构现状（2026-06-19）**：原计划「阶段一 `/api/*` legacy 层 + 旧前端联调」已在 v1 路径切换时撤销。`internal/apps/openflare/legacy/`、`compat/auth.go` 已删除；`openflare-server/web` 不再能对接当前 Wavelet 后端。

### 开发分支

- 分支：`dev`
- 参考对照：旧后端 `openflare-server/`（待 ETL 验证后归档）

### 已完成（✅）

- [x] **业务模块 T-OPTION ~ T-MISC**：14 个 OpenFlare 业务包 + `internal/router/v1/openflare/register_*.go`
- [x] **goose 迁移** `202606190001` ~ `202606190014`（PostgreSQL + SQLite 双份）
- [x] **可观测性 v1 单表**：无 `_00`~`_09` 分片；heartbeat 持久化、访问日志查询、Relay/Tunnel 观测
- [x] **后台任务**：已迁入 Wavelet Asynq（`async_tasks.go` + `202606190013` 种子）
- [x] **TLS ACME** 申请/续期（lego DNS-01）
- [x] **集成测试** 4 个场景包全部通过（23 用例）
- [x] **配置默认值**：DB 名 `openflare`、监听 `:3000`、`application_name=openflare-server`、Redis 前缀 `openflare:`
- [x] **API 路径统一**：控制台 `/api/v1/d/*`；协议 `/api/v1/agent|relay|tunnel/*`；Swagger 约 99 端点

### 进行中（阶段 5）

- [/] **B5-3** 旧环境数据迁移脚本 `support-files/migration/`（用户 + 业务表 ETL，含 10 分片观测数据合并）
- [/] **B5-4** `make swagger` + `make code-check` 全绿
- [/] **B5-5** 全量 API 回归（对照实现计划 §12 端点表）

### 待处理

- [ ] 生产环境：创建并**激活** config version，消除节点列表「异常」（`openresty_status=unhealthy` + `当前没有激活版本`）
- [ ] 归档 `openflare-server/` 整包（ETL 与回归通过后）

---

## 2. 任务队列（委派状态）

| ID | 板块 | 状态 | 负责目录 |
|---|---|---|---|
| T-AUTH | 认证/用户/OAuth/Cap | ✅ | Wavelet `apps/user`、`apps/oauth`、`apps/cap`、`apps/admin`（无独立 legacy 包） |
| T-OPTION | 状态/公告/Option | ✅ | `openflare/option/`，`register_option.go` |
| T-ORIGIN | 源站 | ✅ | `openflare/origin/`，`register_origin.go` |
| T-APPLYLOG | 应用日志 | ✅ | `openflare/apply_log/`，`register_apply_log.go` |
| T-PROXY | 代理规则 | ✅ | `openflare/proxy_route/`，`register_proxy_route.go` |
| T-NODE | 节点管理 | ✅ | `openflare/node/`，`register_node.go` |
| T-WAF | WAF | ✅ | `openflare/waf/`，`register_waf.go` |
| T-TLS | TLS/证书/域名/DNS | ✅ | `openflare/tls/`，`register_tls.go` |
| T-CFGVER | 配置版本 | ✅ | `openflare/config_version/`，`register_config_version.go` |
| T-AGENT | Agent API + WS | ✅ | `openflare/agent/`，`register_agent.go` |
| T-PAGES | Pages 托管 | ✅ | `openflare/pages/`，`register_pages.go` |
| T-RELAY | Relay + Tunnel | ✅ | `openflare/relay/`、`openflare/flared/`，`register_relay_flared.go` |
| T-OBS | 仪表盘 + 可观测 | ✅ | `openflare/dashboard/`、`openflare/observability/`，`register_dashboard.go`、`register_observability.go` |
| T-MISC | 升级/GeoIP/UptimeKuma | ✅ | `openflare/update/`、`openflare/geoip/`、`openflare/uptimekuma/`，`register_update.go`、`register_option.go` |

### 任务隔离规则

| 规则 | 说明 |
|---|---|
| 文件所有权 | 每个任务 **仅修改** 自己的 `internal/apps/openflare/<module>/`、对应 `router/v1/openflare/register_<module>.go`、`internal/model/openflare_<module>.go`、goose SQL |
| 禁止修改 | `v1/user.go`、`v1/admin.go`、`model/users.go`、其他任务的 `register_*.go` |
| 控制台响应格式 | `{error_msg, data}` + `response.Abort*`（Wavelet 标准） |
| 协议响应格式 | `compat.OK/Fail`（`{success, message, data}`），供 Agent/Relay/Tunnel 二进制使用 |
| 控制台鉴权 | `apiutil.AdminRequired()`（Session / `X-Access-Token`，`user.IsAdmin` + `token_admin`） |
| Logic 层 | `logics.go` 使用 `context.Context`，不依赖 `*gin.Context` |
| 数据源 | `db.DB(ctx)` 获取 GORM |
| 质量门禁 | 完成后 `go build ./...` 并通过本模块测试 |

---

## 3. 核心文件与上下文

### 路由注册

| 路径 | 职责 |
|---|---|
| `Wavelet/internal/router/router.go` | `apiGroup` → `v1.RegisterV1Routes` |
| `Wavelet/internal/router/v1/v1.go` | 汇总 User/Admin/OpenFlare 路由 |
| `Wavelet/internal/router/v1/openflare/v1.go` | `RegisterV1Routes` → `/api/v1/d/*` 控制台 |
| `Wavelet/internal/router/v1/openflare/openflare.go` | `RegisterRoutes` → `/api/v1/agent|relay|tunnel/*` 协议 |
| `Wavelet/internal/router/v1/openflare/register_*.go` | 各资源路由挂载 |
| `Wavelet/internal/apps/openflare/*/routers.go` | Handler + Swagger 注解 |
| `Wavelet/internal/apps/openflare/compat/response.go` | 协议层 legacy 信封（**仅** Agent/Relay/Tunnel） |
| `Wavelet/internal/apps/openflare/apiutil/` | 控制台 BindJSON、AdminRequired、RegisterCollection |

### 后台任务（Asynq）

| 任务名 | 说明 |
|---|---|
| `openflare:database_auto_cleanup` | 可观测数据自动清理（受 Option 开关控制） |
| `openflare:waf_ip_group_sync` | WAF IP 组周期同步 |
| `openflare:uptime_kuma_sync` | UptimeKuma 同步 |
| `openflare:ssl_renew` | ACME 证书自动续期 |

**启动链路**：`wavelet api` / `wavelet all` → `bootstrap.Init` → Asynq worker/scheduler 执行；任务定义见 `async_tasks.go`，调度种子见 `202606190013`。

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
| `202606190010` | 可观测性单表 |
| `202606190011` | `of_node_access_logs` 复合索引 |
| `202606190012` | `of_node_obs_frpc` |
| `202606190013` | OpenFlare Asynq 调度种子 |
| `202606190014` | Pages `upload_id` 字段 |

路径：`Wavelet/internal/db/migrator/goose/postgres/` 与 `sqlite/` 各一份。

### 近期修复要点（2026-06-19）

| 问题 | 根因 | 修复/处理 |
|---|---|---|
| Agent 已连接但节点显示「异常」 | 无激活 config version | 运维：发布并激活配置版本 |
| 节点详情无错误日志 | 可观测性表未迁移 | `202606190010` + `agent/observability.go` |
| WAF IP 组未下发 | Agent sync 未实装 | `agent/waf_ip_group.go`、`waf/ip_group_sync.go` |
| Pages 包下载 404 | Agent 路由缺失 | `pages/logics.go`、`agent/routers.go` |
| 访问日志查询空 | 单表查询层缺失 | `model/openflare_access_log.go`、`202606190011` |
| Relay/Tunnel 观测缺失 | heartbeat 未持久化 | `relay/observability.go`、`flared/observability.go`、`202606190012` |

### 依赖修复

`replace github.com/rain-kl/openflare => ../` 会引入根 `go.mod` 的 `gomodule/redigo v2.0.0+incompatible`，与 `gin-contrib/sessions/redistore` 不兼容。已在 `Wavelet/go.mod` 添加 `exclude` 并锁定 `redigo v1.9.3`。

---

## 4. 集成测试

| 测试包 | 场景 | 结果 |
|---|---|---|
| `integration/auth_option_test.go` | Access Token 鉴权、option 权限、热重载 | ✅ 5/5 |
| `integration/core_chain_test.go` | 源站→规则→发布→节点→apply-log | ✅ 6/6 |
| `integration/security_test.go` | WAF/TLS/域名/DNS | ✅ 7/7 |
| `integration/agent_protocol_test.go` | Agent/Relay/Tunnel 协议 | ✅ 5/5 |

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

### 启动命令

```bash
cd Wavelet
go run . all    # 开发：API + Worker + Scheduler
go run . api    # 生产：API 进程
go run . worker
go run . scheduler
```

### 当前联调方式

- **管理控制台**：`Wavelet/frontend`（`pnpm dev` 或 embed 构建产物），Session 鉴权，API 前缀 `/api/v1/d/*`
- **节点二进制**：连接 `/api/v1/agent/*`、`/api/v1/relay/*`、`/api/v1/tunnel/*`（legacy `{success,message,data}` 信封）
- **旧前端 `openflare-server/web`**：已无法对接当前后端（无 `/api/*` 控制台路由、无 `OpenFlare-Token` 桥接）

---

## 6. 待决策与遗留问题

| 项 | 说明 | 当前处理 |
|---|---|---|
| 观测数据 10 分片 → 单表 | 旧生产环境有 `node_*_XX` 分片表 | v1 单表；B5-3 ETL 脚本待建 |
| 微信登录 | Wavelet 无内置 | 旧 `/api/oauth/wechat*` 未保留；评估废弃或补 v1 适配 |
| 三级角色 Root(100) | 旧 `RootAuth` | 简化为 `is_admin` + Access Token `token_admin` |
| 节点「异常」展示 | 连接正常但无激活版本 | 属预期行为；需运维发布配置 |
| `make code-check` | 全仓库静态检查 | 阶段 5 待跑通 |

---

## 7. 下一步行动指南

1. **确认环境**：`cd Wavelet && go build ./... && go test ./internal/apps/openflare/... -count=1`
2. **跑质量门禁**：`make code-check`
3. **实现 B5-3**：`Wavelet/support-files/migration/` ETL 脚本
4. **API 回归**：对照实现计划 §12 端点表逐项验证
5. **联调验证**：`Wavelet/frontend` 登录 → 创建规则 → 发布并**激活** config version → Agent 心跳 → 检查节点状态

---

## 8. 参考文档

| 文档 | 用途 |
|---|---|
| [实现计划](./20260618-openflare-wavelet-backend-migration.md) | 模块清单、§12 端点对照 |
| [前端迁移计划](./20260618-openflare-wavelet-frontend-migration.md) | UI 迁移与验收 |
| [`Wavelet/AGENTS.md`](../../Wavelet/AGENTS.md) | 框架 Guardrails |
| 旧后端源码（对照用） | `openflare-server/internal/` |
| Changelog | [`docs/changelog/index.md`](../changelog/index.md) `[Unreleased]` |