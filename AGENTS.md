# AGENTS.md

本文件是 OpenFlare 的 AI 接手入口，不承载详细设计、规范和计划。接手项目时，请根据以下分层文档指引进行阅读与开发：

### 1. 开发指导规范 (AI & Developer Guidelines)

* **必须阅读**：
  * **[docs/guideline/development-constraints.md](./docs/guideline/development-constraints.md)**：掌握核心后端/Agent/前端分层约束、数据模型规范、数据库迁移升级协议、API 与鉴权设计准则及变更准入与验收标准。
  * **[docs/guideline/Role.md](./docs/guideline/Role.md)**：通用的 Go 后端开发与高质量编码准则，包括架构、并发、错误处理、安全及工作流程。
* **正在进行的开发计划与接手 (Handover & Plans)**：
  * **[docs/plan/index.md](./docs/plan/index.md)**：查看正在进行的开发实现计划（Implementation Plan）与 AI 代理交接文档（Handover），接手项目时优先检查。

### 2. 系统设计与架构 (Design Docs)

* **[docs/design/index.md](./docs/design/index.md)**：理解产品范围、系统边界、核心对象及长期约束，以及[仓库结构](./docs/design/index.md#仓库结构)。
* **[docs/design/architecture.md](./docs/design/architecture.md)**：理解 Server、Agent、OpenResty 与前端的职责边界与网络拓扑。
* **[docs/design/agent-design.md](./docs/design/agent-design.md)**：理解 Agent 设计原则、与 Server 交互时序、OpenResty 管控与配置发布回滚模型。

### 3. 部署与参考手册 (Deployment & References)

* **[docs/deployment/deployment.md](./docs/deployment/deployment.md)** / **[server.md](./docs/deployment/server.md)** / **[agent.md](./docs/deployment/agent.md)** / **[upgrade.md](./docs/deployment/upgrade.md)**：Server 和 Agent 的单机、Docker 部署配置，接入、升级与维护策略。
* **[docs/reference/configuration.md](./docs/reference/configuration.md)** / **[cli.md](./docs/reference/cli.md)**：支持的环境变量、参数、命令行与配置文件参考。

---

## 开发与执行要求

1. **设计先行**：
   * 开发新功能或重要特性时，必须在 `docs/design/` 下创建/更新对应的设计文档，理清架构与核心决策。
   * 新增的设计文档应同步更新至 `docs/design/architecture.md` 及在 `docs/config.ts` 中注册侧边栏路由。
   * 若实现内容超出产品边界，必须先修改设计文档，再编码实现。
2. **遵守约束**：
   * 必须严格遵循 `docs/guideline/` 下的所有开发准则与开发约束规范，不得绕过任何规范。
   * 涉及前端改造或管理端 UI 时，必须遵守 `docs/guideline/development-constraints.md` 中的前端规范。
3. **开发计划与交接**：
   * 正在进行的开发计划或 AI 接手交接发生变化时，在 `docs/plan/` 下创建或更新对应的开发计划或接手文档，并使用相应模板初始化。
4. **文档与变更日志**：
   * 当相关内容发生变化时，同步更新对应的**中文文档**（不要同步英文文档）。
   * 任何代码、配置或文档变更完成后，必须在 [`docs/changelog/index.md`](./docs/changelog/index.md) 的 `[Unreleased]` 区块补充对应变更条目。
