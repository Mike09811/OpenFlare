# 系统架构

OpenFlare 由 Server、Agent 与节点本地 OpenResty 组成。

```text
OpenFlare Server (Gin + SQLite/PostgreSQL + Web UI)
        |
        | HTTP API / Config Pull
        v
OpenFlare Agent (register / heartbeat / sync / apply / update)
        |
        v
Local OpenResty or Docker OpenResty
        |
        v
Origin
```

## Server

`openflare_server` 是单体控制面：

* Gin
* GORM
* SQLite / PostgreSQL
* 现有登录与 Session 体系
* 认证源与外部账号绑定
* 托管 `openflare_server/web` 静态构建产物

Server 负责管理端 UI 与 API、Agent API、配置渲染、版本发布、数据存储与聚合查询。

认证源登录由 Server 统一处理。管理端配置 `github` 或 `oidc` 认证源后，登录页从 `/api/status` 获取已启用认证源列表；OAuth/OIDC callback 仍回到管理端前端页面，再由前端调用 Server API 完成 code 交换、账号绑定与 Session 建立。

## Agent

`openflare_agent` 是 Go 单体程序：

* 单二进制
* 节点本地执行
* 优先使用 `openresty_path`
* 未配置 `openresty_path` 时默认使用 Docker OpenResty

Agent 负责首次注册、周期性心跳、配置同步、文件写入、`openresty -t`、reload、失败回滚、自更新与轻量采集。

## Frontend

`openflare_server/web` 是正式管理端前端：

* Next.js App Router
* React 19
* TypeScript
* Tailwind CSS
* 静态导出后由 Go Server 托管

## 核心对象

当前有效实体包括 `proxy_routes`、`origins`、`config_versions`、`nodes`、`auth_sources`、`external_accounts`、`apply_logs`、`tls_certificates`、`managed_domains`、`node_request_reports`、`node_access_logs`、`node_metric_snapshots`、`traffic_analytics_rollups` 与 `node_health_events`。
