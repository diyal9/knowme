## Why

工作台专家对话发送任意消息时，`ai-generate` 直接抛 `ReferenceError: buildTemporalAnchorContext is not defined`，对话完全不可用。根因是 IPC 拆分后时间锚点函数仍留在 `main.js`，未随 `ai-generate` 进入 IPC 模块。横向排查后发现同类闭包泄漏不止一处。

### 目标用户

- 在工作台与专家（如「办公伙伴」）聊天协作的日常用户。

### 商业化与体验价值

专家对话是工作台核心路径；发送「你好」即报错会立刻摧毁「可协作」信任，必须优先止血，并堵住同类 IPC 拆分回归。

## What Changes

- 将 `buildTemporalAnchorContext` 抽到可 `require` 的 `src/lib/` 模块。
- `ai-generate` IPC 路径正式引用该模块装配 `timeAnchor`，消除 ReferenceError。
- 删除 `main.js` 中未再使用的死函数。
- 横向补齐 `ai-generate` 对其它 main 闭包 helper 的 deps（`mergeExtraTools`、`buildActiveSourceFileTools`、`agentRuntimeOutputBridges`、`loadSourcesStore`、`getActiveSourceRoot`、`kosSourcesCtx`、`workbenchDaemon`）。
- `ai-assist` 取消路径改为本地 require `agent-process-tools` / `agent-orchestration`（不再依赖未注入 deps）。
- 补充单元测试 + IPC 自由标识符防回归守卫。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `agent-context-assembly`: 明确 `ai-generate` 动态上下文 MUST 注入本地时间锚点，且不得因缺失符号导致整轮生成失败。

## Impact

- `src/lib/temporal-anchor.js`（新增）
- `src/ipc/ai-generate.js`
- `src/ipc/ai-assist.js`
- `src/main.js`
- `tests/temporal-anchor.test.js`
- `tests/ipc-free-helper-guard.test.js`

### 验收标准

- 工作台专家会话发送「你好」不再出现 `buildTemporalAnchorContext is not defined`。
- 工具面 / 写作 / 取消 run 路径不再因同类未绑定符号崩溃。
- 生成请求的动态上下文仍含本地日期/时间/时区锚点。
- `npm test` / `npm run lint` 通过。

### 非目标（Non-goals）

- 不改时间锚点文案语义或相对时间换算规则。
- 不重构整段 context orchestrator。
- 不把全部 main helper 一次性抽到 lib（仅修已证实泄漏）。
