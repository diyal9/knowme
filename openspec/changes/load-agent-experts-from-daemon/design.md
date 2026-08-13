## Context

见 `proposal.md`。当前 `workbench-load` 并行返回本地仓库 Agent 与 Daemon workflow/task overview，但 Daemon 客户端尚未调用已存在的 `/api/agents-team/overview`。Renderer 的专家卡片已经消费统一 Agent DTO，可通过主进程适配而不改 IPC。

## Goals / Non-Goals

**Goals:**

- 在一次 Daemon overview 加载中取得 workflow、task 与 Agent 专家目录。
- 将 Daemon 专家规范化为现有工作台 Agent DTO，减少 Renderer 分支。
- 在线优先 Daemon，任何专家端点失败时独立降级到本地仓库，不拖垮 workflow/task overview。
- 保持刷新按钮和 `workbench-load` IPC 不变。

**Non-Goals:**

- 不改变 Capability Hub Expert runtime 或安装状态。
- 不缓存 Daemon 专家到用户数据目录。
- 不向 Renderer 透传 `working_on` 任务明细、资产路径或鉴权信息。

## Decisions

### 1. 专家请求与 workflow/task 请求并行且独立降级

Daemon client 的 `overview()` 同时请求 `/api/workflows`、`/api/tasks` 与 `/api/agents-team/overview`。专家接口失败时返回空 `agents` 和可诊断状态，但保留 health、workflow 与 task 结果。

选择该方案是为了避免新增第二次 Renderer IPC 和串行启动延迟。未选择“由 Renderer 单独请求专家”，因为这会绕过主进程网络与鉴权边界。

### 2. 主进程选择在线权威源

`workbench-load` 先解析本地专家作为 fallback；当 Daemon overview 明确包含成功的专家目录时，返回 Daemon 专家，否则返回本地专家，并附加 `agentSource` 供 UI/测试诊断。

不直接合并两套列表，避免同一 Agent 重复、旧本地定义覆盖实时 Daemon 模型或状态。

### 3. 复用现有工作台 Agent DTO

Daemon 字段映射：

- `id` → `id`
- `label_zh` / `label_en` → `title` / `name`
- `description` → `description`
- `model` 与 model label → `model`
- `state`、`display_order` → 安全扩展字段
- `keywords_*` 与 `card_line` → `skills` / 展示摘要辅助

这样 `renderTeam`、详情弹窗和现有 presenter 无需新增 Daemon 专属模板。

### 4. Electron 边界与性能

所有 HTTP、鉴权 header 与响应裁剪仍在主进程客户端完成。最大响应体继续受 2 MiB 限制；三类目录请求并行，不增加关键路径的串行等待。Renderer 只通过 `workbench-load` 接收裁剪后的 DTO。

## Risks / Trade-offs

- [旧 Daemon 没有专家接口] → 专家请求 404 独立降级，本地目录继续可用。
- [专家接口慢于其他目录] → 共享现有超时上限；并行请求避免额外串行延迟。
- [本地专家与 Daemon 名称不同] → 在线时以 Daemon 为权威，不做混合去重；离线回退时允许名称变化。
- [响应字段演进] → 适配器只读取白名单字段并提供默认值。

## Migration Plan

1. 上线客户端适配与主进程源选择。
2. 重启 KnowMe，在线 Daemon 环境刷新专家并核对数量与名称。
3. 回滚时移除 agents overview 请求和源选择即可；本地专家加载路径始终保留。
