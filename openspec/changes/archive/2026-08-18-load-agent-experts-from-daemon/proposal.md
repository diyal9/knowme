## Why

KnowMe 工作台当前从本地内容源仓库读取 Agent 专家，而工作服务 Daemon 已通过 `/api/agents-team/overview` 提供实时专家目录、模型、状态与当前任务。两套来源会让刷新后的专家列表与实际可调度团队不一致，因此需要重新以 Daemon 为在线权威来源。

目标用户：在 KnowMe 工作台浏览并调用研发、测试、部署 Agent 的项目成员。

商业化与体验价值：专家目录与工作服务保持一致，能减少“界面有专家但服务不可调度”或“Daemon 已更新但 KnowMe 看不到”的认知差异，为后续团队状态、模型能力与企业权限展示建立稳定数据契约。

## What Changes

- Daemon 客户端在 overview 中同时读取 `/api/agents-team/overview`，规范化专家身份、名称、描述、模型、状态与排序。
- Workbench 在线时优先使用 Daemon 专家目录；Daemon 不可达、未授权或端点不支持时继续使用当前内容源仓库专家作为回退。
- 工作台右上角刷新重新请求完整 overview，立即更新专家卡片、数量和详情。
- 不把 Daemon 任务明细或内部资产路径暴露给 Renderer。

验收标准：
- 当前本机 Daemon 在线时，刷新后显示其返回的 10 位专家，并按 `display_order` 稳定排序。
- 专家卡片展示 Daemon 的中英文名称、简介和模型信息，不依赖本地 `.cursor/agents` 文件。
- Daemon 断开、鉴权失败或专家接口不可用时，工作台仍展示本地仓库专家。
- 现有工作流、任务、自动化与 Agent 调度路径不回归。

非目标（Non-goals）：
- 不修改 Daemon API、鉴权或 Agent 定义。
- 不把 Daemon 专家自动安装为 Capability Hub Expert。
- 不新增专家编辑、启停或模型切换功能。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `workspace`: 工作台在线时从 Daemon 加载 Agent 专家目录，并在失败时回退本地内容源。

## Impact

- `src/lib/workbench-daemon-client.js`：新增专家 overview 请求与 DTO 规范化。
- `src/main.js`：`workbench-load` 选择 Daemon 专家或本地回退。
- `src/workbench.js`：消费专家来源信息并保持刷新行为。
- `tests/workbench-daemon-client.test.js`、`tests/workbench-templates.test.js`：新增来源、排序与回退回归。
- 不新增依赖，不改变现有 preload/IPC 名称。
