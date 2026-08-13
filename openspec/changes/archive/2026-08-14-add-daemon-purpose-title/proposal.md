## Why

管线（Daemon）执行间右栏身份区目前主要展示工作流名或整段 intent，用户扫读时难以一眼认出「这次任务要干什么」。需要在合适位置展示由 LLM 根据输入目的提炼的短标题，失败时有本地回退，不阻塞任务推进。

## What Changes

- 在 Daemon 执行间身份区（运行标题 / 审阅步骤头）展示 **`Daemon 阶段 · {目的标题}`**。
- 目的标题优先由 LLM 根据用户输入 intent 提炼（≤20 字）；无 API / 失败时回退到既有 compact 摘要或工作流名。
- 标题异步升级：先本地回退，LLM 返回后刷新；可写入任务草稿避免重复请求。
- 补充主链路验收：overview → launchContext → task/progress/steps 投影；若 API 访问失败则停止并记录，仍确认 KnowMe 侧编排主链路契约。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `pipeline-run-review-surface`：Daemon 执行间必须展示基于输入目的的短标题（LLM 优先，本地回退）。

## 目标用户

- 在工作台启动/审阅管线任务、需要快速识别任务目的的知识工作者。

## 验收标准

- 打开 Daemon 执行间时，身份区可见 `Daemon 阶段 · …` 形式标题，不为整段 URL/长 intent。
- 有可用 LLM 时标题语义贴近输入目的；无 LLM 时仍有可读 compact 回退。
- 不阻塞任务启动与轮询；标题提炼失败不影响主链路。
- 主链路验收脚本对 overview / 任务投影可跑通；遇 API 失败干净停止并留证据。

## 非目标（Non-goals）

- 不改 Daemon 服务端协议或远端任务库字段。
- 不重做步骤时间线、过程日志 Tab 或卡片列表 compact 逻辑（列表仍用既有 compact）。
- 不强制每次打开都扣 LLM（有草稿缓存则复用）。

## Impact

- `src/lib/workbench-daemon-surface.js`、`src/workbench.js`、CSS（标题层级）
- 复用既有 `ai-suggest-title` IPC
- `tests/workbench-daemon-surface.test.js`、主链路 evidence 脚本
