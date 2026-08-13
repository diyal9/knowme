## Why

管线服务（Daemon / workflow-web）已统一错误体为 `{ detail: { code, message } }`（API v1.0.0），但 KnowMe 客户端仍主要读顶层 `body.code`，导致绝大多数失败被压成泛化的 `http_error`，用户只能看到模糊提示，授权/权限/校验也无法按稳定机器码分支。同时仓库内缺少与上游对齐的协议文档副本，联调易漂移。

## What Changes

- 将上游 `API.md` 同步入库为 KnowMe 侧 Daemon 协议文档（含同步来源与 KnowMe 客户端使用说明）
- 客户端按 `detail.code` 解析错误码；保留旧信封兼容（`detail` 字符串 / 顶层 `code`）
- 内置错误码默认文案目录，服务端未带 message 时可回退可读中文
- 鉴权类码（`auth_required` / `unauthorized`）继续映射到现有授权引导；权限类码（`task_forbidden` 等）保留原码，不再误判为需重新登录
- 补充单元测试覆盖统一错误信封

## Capabilities

### New Capabilities

- `daemon-api-protocol`: KnowMe 调用管线服务 HTTP API 时的协议契约——错误信封解析、错误码透传与协议文档同步

### Modified Capabilities

- （无）现有 workbench 能力不改需求语义，仅补协议层行为

## Impact

- 代码：`src/lib/workbench-daemon-client.js`、`src/lib/workbench-auth.js`；新增 `src/lib/workbench-daemon-errors.js`
- 文档：`docs/daemon/API.md`（同步上游）+ 简短 README
- 测试：`tests/workbench-daemon-client.test.js`；新增 errors 单测
- 依赖：无新 npm 依赖；协议源为 `D:\workflows\workbench\tools\workflow_runner\webserver\API.md`

## 目标用户

- 使用工作台启动/审阅管线任务的 C 端用户（需可读失败原因）
- 联调 Daemon 的开发与测试（需仓库内协议真源）

## 验收标准

1. 收到 `{ detail: { code: "task_not_found", message: "..." } }` 时，客户端 `result.code === "task_not_found"`，且 `error` 使用服务端 message
2. `auth_required` / `unauthorized` 仍触发现有「需要 Workbench 授权」引导
3. `task_forbidden` / `tenant_forbidden` 不误判为 `auth_required`
4. 仓库存在与上游 v1.0.0 对齐的 `docs/daemon/API.md`，并注明 KnowMe 实际调用的端点子集与已知扩展（如 `launch-context`）
5. `npm test` / `npm run lint` 通过

## 非目标（Non-goals）

- 不实现上游未提供的任务删除/归档 API
- 不改写工作台 UI 布局或新增错误码专属弹窗体系（仅透传码与可读文案）
- 不强制上游补齐 `launch-context` 文档（仅在 KnowMe 协议副本中标注客户端扩展）
