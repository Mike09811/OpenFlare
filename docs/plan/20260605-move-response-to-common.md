# 提取公共 Response 包以支持 Middleware 统一响应实现计划

---

## 1. 目标与背景 (Goal & Context)
* **需求背景**：
  原本 `response.go` 放在 `controller` 目录下。由于 `middleware` 处于 `controller` 上游，并且和 `controller` 跨包，`middleware` 无法直接调用 `controller` 的响应逻辑。这导致 `middleware` 中存在许多手写的、格式硬编码的 `c.JSON` 调用。
  如果直接将 `response.go` 放入已有的 `common` 根包，会引入 `github.com/gin-gonic/gin` 依赖，导致依赖 `common` 的底层 `service` 和 `model` 也受到 `gin` 框架的依赖污染。
* **开发范围 (Scope)**：
  * 在 `openflare_server/common/response` 下新建 `response.go` 子包（`package response`），存放通用的 HTTP 响应逻辑。
  * 将 `controller/response.go` 中的响应逻辑移植到 `common/response/response.go`。
  * 在 `controller/response.go` 中保留参数解析逻辑，并作为代理调用 `common/response` 中的方法，从而实现对 controller 内 140+ 处现有调用的**零改动**。
  * 修改 `middleware` 包下的所有 `c.JSON` 手写响应，统一采用 `common/response` 的方法。

## 2. 设计与决策 (Design & Decisions)
* **核心对象/数据模型**：无需改动任何数据库或数据模型。
* **API 与鉴权设计**：不改变任何公开 API 接口路由与现有的成功/失败响应 JSON 格式。
* **设计决策权衡**：
  * **方案 A：直接把 response.go 放入 common 根包**
    * 缺点：导致原本不应该感知 Web 传输协议的 `service`、`model`、`job` 包间接依赖了 `github.com/gin-gonic/gin` 框架。
  * **方案 B：在 common 下建子包 `common/response`**
    * 优点：满足 `common` 归类的直觉，又保持了包的物理依赖隔离。业务底层不受 `gin` 污染，而 `controller` 和 `middleware` 这类传输层可引入该包进行代码复用。**（采用此方案）**

## 3. 具体修改文件清单 (Proposed Changes)

### 后端 Server
* #### [NEW] [response.go](file:///Users/ryan/DEV/Go/OpenFlare/openflare_server/common/response/response.go)
  * 职责：通用的 Gin 响应工具包，包括 `RespondSuccess`、`RespondSuccessWithExtras`、`RespondSuccessMessage`、`RespondFailure`、`RespondBadRequest`、`RespondUnauthorized` 和 `RespondForbidden`。
* #### [MODIFY] [response.go](file:///Users/ryan/DEV/Go/OpenFlare/openflare_server/controller/response.go)
  * 职责：删去具体的 HTTP 响应渲染实现，以代理方式调用 `common/response` 包中导出的函数，保持 controller 包内现有调用的向后兼容；保留原有的 `decodeJSONBody`、`decodeOptionalJSONBody`、`parseIDParam`、`parseIDParamByName`、`bindJSON` 参数绑定解析逻辑。
* #### [MODIFY] [agent-auth.go](file:///Users/ryan/DEV/Go/OpenFlare/openflare_server/middleware/agent-auth.go)
  * 职责：替换 `c.JSON(http.StatusUnauthorized, ...)` 为使用 `response.RespondUnauthorized(...)` 渲染统一响应。
* #### [MODIFY] [auth.go](file:///Users/ryan/DEV/Go/OpenFlare/openflare_server/middleware/auth.go)
  * 职责：替换 `c.JSON` 相关的未授权和失败响应为使用 `response` 包方法。
* #### [MODIFY] [jwt.go](file:///Users/ryan/DEV/Go/OpenFlare/openflare_server/middleware/jwt.go)
  * 职责：替换 JWT 未授权的回调响应为使用 `response` 统一格式。
* #### [MODIFY] [relay-auth.go](file:///Users/ryan/DEV/Go/OpenFlare/openflare_server/middleware/relay-auth.go)
  * 职责：替换未授权和 StatusForbidden 响应为使用 `response` 方法。
* #### [MODIFY] [tunnel-auth.go](file:///Users/ryan/DEV/Go/OpenFlare/openflare_server/middleware/tunnel-auth.go)
  * 职责：替换未授权和 StatusForbidden 响应为使用 `response` 方法。

---

## 4. 验证计划 (Verification Plan)

### 自动化单元测试
* 运行项目已有测试验证重构是否影响 API 连通性与响应结构：
  ```bash
  go test -v ./router/...
  ```
  ```bash
  go test -v ./service/...
  ```
