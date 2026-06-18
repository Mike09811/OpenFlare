# OpenFlare 前端迁移 — 任务拆分与 AI 委派

> **状态**：✅ 迁移完成（多角度验证通过；P2 可选打磨待办）  
> **目标前端**：`Wavelet/frontend/`（Next.js 16 + shadcn/ui + Session 鉴权）  
> **验证报告**：[`verify-frontend-routes.md`](./verify-frontend-routes.md)、[`verify-frontend-services.md`](./verify-frontend-services.md)、[`verify-frontend-ui.md`](./verify-frontend-ui.md)、[`verify-frontend-build.md`](./verify-frontend-build.md)

## 任务队列

| ID | 板块 | 状态 |
|---|---|---|
| F0 | 基建 | ✅ |
| F-NODE | 节点（含 Relay/Tunnel 详情） | ✅ |
| F-PROXY | 代理规则（含 6 Section 实装） | ✅ |
| F-CFG | 配置发布 + 应用日志 | ✅ |
| F-DASH | 总览仪表盘 | ✅（缺世界地图，P2） |
| F-WAF | WAF 规则组 + IP 组 | ✅ |
| F-WEB | 网站/证书/DNS | ✅ |
| F-PAGES | Pages 托管 | ✅ |
| F-ORIGIN | 源站 | ✅ |
| F-LOGS | 访问日志 | ✅ |
| F-PERF | 性能调优 | ✅ |
| F-ADMIN | Admin 运维设置扩展 | ✅ |
| F-AUTH | Wavelet 登录/用户复用 | ✅（原生，未改登录页） |
| F-ABOUT | About 页（FC-20） | ✅ |
| F-UPDATE | 服务升级 UI + UpdateService | ✅ |

## 验证结果摘要

| 门禁 | 结果 |
|---|---|
| `tsc --noEmit` | ✅ |
| `pnpm lint` | ✅ |
| `pnpm build:embed` | ✅（47 静态页） |
| 路由覆盖 FC-1~20 | ✅ 20/20 文件（FC-1 世界地图 P2） |
| Service 覆盖 | ✅ 100% |
| UI 规范 | ✅ PASS |

## P2 可选待办

1. **FC-1** 世界地图（当前用 geo 列表）
2. **UI 打磨** — proxy 列表 error 态、access-logs cleanup Zod、node-observability error
3. **废弃旧前端** — 移除 `openflare-server/web` 引用（阶段五）
4. **E2E** — Playwright 核心路径

## 验收命令

```bash
cd Wavelet/frontend
pnpm exec tsc --noEmit
pnpm lint
pnpm build:embed
pnpm dev
```