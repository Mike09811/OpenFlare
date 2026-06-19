# 边缘运行时重构设计

你会学到：Agent、Relay、OpenFlared 三组件的重复代码如何收敛到 `internal/apps/edge/`，以及后续演进路线。

---

## 背景

三类边缘守护进程共享同一运行时骨架：

```text
配置加载 → HTTP/WS 客户端 → 定时心跳 →（可选）配置同步 → 自更新 → 信号优雅退出
```

重构前，以下模块在三个组件间近乎复制粘贴：

| 模块 | 重复度 |
| --- | --- |
| `updater/` + `restart_{unix,windows}.go` | ~98% |
| `httpclient` 传输层 (`do/postJSON/getJSON`) | ~90% |
| `tryAutoUpdate` | ~98% |
| `detectNodeIP` | ~95% |
| `relay/flared runner` WS 重连环 | ~85% |
| `parseLevel`（main 内联） | 100% |

Agent 额外包含 nginx 栈、geoip、观测缓冲等**领域特有**逻辑，不宜强行合并。

---

## 共享包结构

```
internal/apps/edge/
├── logging/          # Setup、ParseLevel
├── nodeip/           # Detect、DetectLocal（可注入 LookupOutboundIP）
├── httpclient/       # 基础 HTTP 客户端（鉴权头可配置）
├── wsclient/         # 基础 WebSocket 客户端（组件 Preset 驱动 HeaderKey + WSPath）
├── updater/          # GitHub Release 自更新 + 二进制替换重启
├── heartbeat/        # TryAutoUpdate 统一入口
└── runner/           # WS 重连循环、SleepContext
```

### 组件层保留

各组件仅保留**薄包装**与**领域逻辑**：

| 组件 | 保留模块 |
| --- | --- |
| Agent | `nginx/`、`sync/`（OpenResty）、`geoipupdate/`、`agent/runner`（discovery/WS 混合） |
| Relay | `frps/`、`observability/` |
| Flared | `frpc/`、`sync/`（tunnel） |

各组件 `updater/`、`httpclient/`、`wsclient/` 变为类型别名 + `New()` 工厂函数。

---

## API 约定

### 自更新

```go
edgeupdater.New(edgeupdater.Config{
    LocalVersion: config.Version,
    AssetPrefix:  "openflare-agent", // relay: openflare-relay, flared: openflared
    LogLabel:     "agent",
})
```

### HTTP 客户端

```go
edgehttp.New(baseURL, token, timeout, "X-Agent-Token")   // Agent/Relay
edgehttp.New(baseURL, token, timeout, "X-Tunnel-Token")  // Flared
```

### WebSocket 客户端

```go
edgews.New(edgews.PresetAgent, baseURL, token, timeout)   // HeaderKey=X-Agent-Token,  /api/v1/agent/ws
edgews.New(edgews.PresetRelay, baseURL, token, timeout)   // HeaderKey=X-Agent-Token,  /api/v1/relay/ws
edgews.New(edgews.PresetFlared, baseURL, token, timeout)  // HeaderKey=X-Tunnel-Token, /api/v1/tunnel/ws
```

### 节点 IP 探测

```go
nodeip.Detect() // outbound → local 回退
```

测试可通过替换 `nodeip.LookupOutboundIP` / `nodeip.LookupLocalIP` 注入桩。

---

## 已完成（Phase 0–2）

- [x] `edge/updater` — 三组件 updater 收敛（删除 ~1100 行重复）
- [x] `edge/logging` — relay/flared main 统一日志初始化
- [x] `edge/nodeip` — 删除三处 detectNodeIP 重复
- [x] `edge/httpclient` — 三组件 HTTP 传输层收敛
- [x] `edge/heartbeat/autoupdate` — tryAutoUpdate 统一
- [x] `edge/runner` — relay/flared WS 重连环收敛

---

## 已完成（Phase 3 Batch 1）

- [x] `edge/config/duration.go` — MillisecondDuration 三处合并（含 MarshalJSON）
- [x] `edge/observability/linux.go` — agent/relay collector 底层 Linux 指标采集收敛
- [x] `edge/heartbeat/loop.go` — relay/flared 心跳 ticker 循环统一

## 已完成（Phase 3 Batch 2）

- [x] `heartbeat/cycle.go` — Agent HTTP 心跳周期从 runner 下沉（payload 构建、同步、自动更新）
- [x] `pkg/protocol/agent.go` — Agent 客户端协议类型迁入公共包，`internal/apps/agent/protocol` 保留别名 re-export

## 已完成（Phase 3 Batch 3）

- [x] `edge/wsclient` — Agent/Relay/Flared WebSocket 传输层收敛（Preset 配置表 + `AgentConnection` 适配 `protocol.WebSocketConnection`）
- [x] Server 侧协议统一 — `internal/apps/openflare/{agent,relay,flared}` 心跳/观测类型改为 `pkg/protocol` 别名

## 可选后续

| 项 | 说明 |
| --- | --- |

---

## 迁移原则

1. **领域逻辑不下沉**：nginx/frps/frpc/sync 核心业务保留在各自组件。
2. **鉴权头显式传入**：禁止 httpclient 默认 Token Header，避免 Agent/Tunnel 混用。
3. **小步 PR**：每阶段独立可测，自更新路径需集成验证。
4. **测试随包迁移**：updater 测试已迁至 `edge/updater/`。