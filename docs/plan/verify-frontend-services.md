# OpenFlare 前端 Service 层验证报告

> **验证日期**：2026-06-18（复验）  
> **目录**：`Wavelet/frontend/lib/services/openflare/`

## 覆盖率摘要

| 维度 | 结果 |
|---|---|
| §7.1 计划服务文件 | **15 / 15 = 100%** |
| 业务 `/api/*` 端点 | **100%** |
| 待补 API | **0** |

## §7.1 对照结果

| 计划服务 | 实际文件 | 注册 | 方法覆盖 |
|---|---|---|---|
| dashboard | ✅ | `openflareDashboard` | ✅ |
| node | ✅ | `openflareNode` | ✅ 12 方法 |
| proxy-route | ✅ | `openflareProxyRoute` | ✅ |
| config-version | ✅ | `openflareConfigVersion` | ✅ |
| waf | ✅ | `openflareWaf` | ✅ |
| website | ✅ | `openflareWebsite` | ✅ |
| tls-certificate | ✅ | `openflareTls` | ✅ |
| dns-account | ✅ | `openflareDns` | ✅ |
| acme-account | ⚠️ 合并 | 经 `openflareTls` | `getDefaultAcmeAccount()` |
| pages | ✅ | `openflarePages` | ✅ |
| origin | ✅ | `openflareOrigin` | ✅ |
| access-log | ✅ | `openflareAccessLog` | ✅ |
| apply-log | ✅ | `openflareApplyLog` | ✅ |
| option | ✅ | `openflareOption` | ✅ |
| update | ✅ | `openflareUpdate` | ✅ 6 方法 |
| about | ✅ | `openflareAbout` | `getAboutContent()` |

## update.service.ts 复验

| 方法 | 端点 |
|---|---|
| `getLatestRelease(channel?)` | `GET /api/update/latest-release` |
| `upgradeServer(channel?)` | `POST /api/update/upgrade` |
| `uploadServerBinary(file, onProgress?)` | `POST /api/update/manual-upload` |
| `confirmManualServerUpgrade(token)` | `POST /api/update/manual-upgrade` |
| `createUpgradeLogsWebSocket()` | `WS /api/update/logs/ws` |
| `parseUpgradeStreamSnapshot(raw)` | WS 消息解析 |

已接入：`use-openflare-server-upgrade.ts`、`openflare-version-entry.tsx`、`openflare-ops.tsx`。

## 计划外（已实现）

- `status.service.ts` → `openflareStatus`
- `uptimekuma.service.ts` → `openflareUptimeKuma`
- `about.service.ts` → `openflareAbout`
- `legacy-base.service.ts`（基类）

## 待补 API

无。

## 结论

Service 层迁移 **完成**。所有计划内业务 API 均已由 Service 覆盖。