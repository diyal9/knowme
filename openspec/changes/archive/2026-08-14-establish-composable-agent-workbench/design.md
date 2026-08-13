## Context

见 `proposal.md`。当前 `workbench-load` 将激活仓库/Daemon 的 Agent 与 workflow 直接交给 `workbench.js`，首页把这组 Agent 当作全局专家团队；Capability Hub 的 Expert 已有安装、启用、Session 与安全投影，但与工作台没有持久绑定关系。`agent-package-and-team-runtime` 已建立真实多 Agent RunManager/Launcher，本 change 不重复建设执行内核，只补齐用户可见的工作模式与能力组队层。

Electron 继续遵循主进程拥有文件与能力状态、preload 暴露最小 IPC、Renderer 只消费 plain DTO 的边界。工作模式数据规模小于几十 KB，必须不增加网络启动请求，也不能让 Hub iframe 直接访问主进程或用户数据目录。

## Goals / Non-Goals

**Goals:**

- 用版本化工作模式模型把 Expert、Daemon 角色、专业能力和 workflow 组织为用户可理解的个人团队。
- 保留现有 Daemon 编码路径，把它投影为“软件研发”专业能力。
- 提供日常办公、软件研发、视觉创作三个内置模式以及用户 Expert 绑定。
- 让工作台总览、团队和工作流分栏共享一个当前模式事实源。
- 让 Hub 通过受限消息实现“安装/启用 → 添加到当前工作台”。
- 在无可运行 provider 时诚实降级，不制造演示数据或假成功。

**Non-Goals:**

- 不修改 RunManager、Scheduler、Launcher、MessageBus 或 Daemon HTTP 协议。
- 不实现工作流可视化编辑器、定时调度器、图像供应商或模式市场。
- 不把 Daemon Agent 转存为 Expert，不让工作模式绑定扩大工具权限。

## Decisions

### 1. 新增独立 Workbench Mode Store

新增 `src/lib/workbench-mode-store.js`，存储于 `%APPDATA%\KnowMe\workbench-modes.json`。Store 保存版本、当前模式和每个模式的用户 Expert 绑定；内置模板由代码提供并在读取时物化，不把整份模板复制为可漂移的用户数据。

最小状态：

```js
{
  version: 1,
  activeModeId: 'office',
  bindings: {
    office: [{ expertId, addedAt }],
    engineering: [],
    visual: [],
  },
  updatedAt,
}
```

公开 DTO：

```js
{
  activeModeId,
  modes: [{
    id, name, description, icon, accent,
    professionalCapabilities: [{ id, label, status }],
    providers: [{ id, label, kind, status }],
    suggestedRoles: [{ id, label }],
    bindings: [{ expertId, addedAt }],
  }],
}
```

内置模式：

- `office`：日常办公；默认 provider 为本地 Agent/飞书能力，工作流为空时展示能力引导。
- `engineering`：软件研发；投影现有 Daemon Agent、workflow 和 task。
- `visual`：视觉创作；声明图像生成专业能力，但 provider 未接入时标为 `setup_required`。

选择该方案而不是复用 settings，是因为绑定具有独立版本、数量限制和后续迁移需求；也不复用 Capability Store，因为“安装能力”与“把能力加入某个团队”是不同生命周期。

写入使用 `tmp + rename` 原子替换，并在 Windows `EPERM` 时有限重试或安全回退；读取损坏时返回默认状态但不覆盖损坏文件直到用户发生有效写操作。

### 2. 主进程在 workbench-load 聚合模式与可用性

新增 IPC：

- `workbench-mode-list`
- `workbench-mode-select`
- `workbench-mode-bind-expert`
- `workbench-mode-unbind-expert`

`workbench-load` 同时返回 `modes`，避免 Renderer 进入工作台后再发一次阻塞请求。模式切换/绑定使用独立 IPC 并返回完整最新 Mode DTO，Renderer 无需自行合并状态。

Expert 绑定前主进程通过 `ensureCapabilityHub().listCapabilities({ kind: 'expert' })` 检查目标存在、已安装且启用。Store 只保存 Expert ID；名称、描述、能力、状态在读取 DTO 时由实时 catalog 投影，因此卸载或禁用后可以显示可修复占位，不会保存过时 persona 或权限。

Daemon 状态只影响 engineering 模式的 provider、内置角色和 workflow 可用性，不改变当前模式，也不把离线解释为整个工作台离线。

选择主进程聚合而不是 Renderer 同时调用 `expert-list`，是为了保持状态一致、减少 iframe/Renderer 自行拼接和防止伪造 Expert ID。

### 3. 工作流按模式投影，而不改执行协议

`workbench.js` 增加 `activeMode()` 和模式视图投影：

- engineering：`activeWorkflows()` 继续使用现有 Daemon/仓库目录，所有启动与恢复逻辑不变。
- office / visual：首期只展示显式适用于该模式的 workflow；当前目录尚无 mode 元数据时为空，并展示下一步，不借用编码流程充数。
- 最近任务保留真实 Daemon task；非 engineering 模式将其标为“软件研发中的任务”并提供切换入口，而不是丢弃历史。

这比修改 Daemon catalog 协议更安全；后续 Capability Pack 增加 `workModes[]` 后，投影函数可以无破坏扩展。

### 4. UI 采用“工作模式 → 总览/团队/工作流”层级

工作台顶部保留轻量 Tab，新增“团队”：

```text
[日常办公 ▾]   总览  团队  工作流
```

总览：

- 当前模式 hero：岗位价值、专业能力状态、provider 状态。
- 快速开始：当前模式常用 workflow；没有时显示配置引导。
- 继续工作：真实运行任务。
- 团队摘要：内置角色 + 用户 Expert，提供添加 Agent。
- 今日待办保留但降低为辅助区。

团队：

- 内置角色标“专业能力提供”，只读。
- 用户 Expert 标“从能力中心添加”，可从当前模式移除。
- “添加 Agent”打开 Capability Hub 专家页。

工作流：

- 复用当前目录、搜索、DAG 启动和最近运行。
- 页内文案不再暴露“与 Daemon 工作台保持一致”，改为用户可理解的专业流程说明。

视觉方向沿用现有暖灰、墨绿、编辑式桌面风格，不引入新字体和依赖；用色彩 token 区分工作模式，但保持卡片克制、键盘焦点和窄窗口响应式布局。

### 5. Hub 使用双动作和受限消息桥

Expert Drawer 保留“开始对话”，新增次级动作“添加到工作台”。添加动作复用现有安装/启用准备逻辑，再发送：

```js
{
  type: 'capability-hub-add-expert-to-workbench',
  requestId,
  expertId,
}
```

宿主必须验证 `event.source === capabilityFrame.contentWindow` 和 ID 格式，调用 `window.api.workbenchModeBindExpert`，再回传：

```js
{
  type: 'capability-hub-add-expert-to-workbench-result',
  requestId,
  ok,
  modeId,
  modeName,
  alreadyBound,
  error,
}
```

绑定成功时不关闭 Hub，方便继续组队；工作台通过 `Workbench.refreshModes()` 刷新团队。相比 iframe 直接调用 parent API，这保留了与专家对话桥一致的来源校验和错误反馈。

### 6. Capability Pack 首期采用兼容投影

不在本 change 强制迁移所有 `pack.json`。工作模式内置模板先声明专业能力与 provider；若 pack manifest 已含 `workModes`/`providers`，Mode Store 可规范化读取，旧 pack 继续作为通用能力。

后续 manifest 可选字段：

```js
{
  workModes: ['engineering'],
  providers: [{ id: 'workbench-daemon', kind: 'daemon', required: true }],
  suggestedRoles: ['product', 'developer', 'tester'],
}
```

这些字段只影响发现与展示，不绕过 Capability Pack 原有依赖和权限校验。

## Electron 边界与性能

- Main：唯一读写 mode store，校验 Expert 可用性并聚合 Daemon/catalog 状态。
- Preload：仅暴露 list/select/bind/unbind 四个结构化方法。
- Renderer：不持久化 mode 状态，不接触路径，不信任 iframe 输入。
- Hub iframe：只发意图和接收结果，不持有 Node 能力。
- `workbench-load` 对 Daemon 与 mode store 可并行读取；Mode Store 同步读取小 JSON，预算低于 5ms。
- Mode DTO 最多 12 个模式、每模式 32 个用户绑定、每个展示字符串截断；不复制 persona 全文和工具 schema。
- Hub catalog 仅在绑定/刷新时查询；不在应用启动额外扫描远程能力。

## Risks / Trade-offs

- [首期 office/visual 没有完整 workflow，看起来能力不足] → 明确显示“添加 Agent / 安装能力 / 创建工作流”，绝不填充假卡片；engineering 保持完整可用样板。
- [Daemon Agent 与 Hub Expert 仍是两套定义] → 在 UI 中区分“专业能力内置角色”和“我添加的 Agent”，不做脆弱的名称合并。
- [活跃 change 修改同一工作台文件] → 仅在现有 DOM/状态机上增量扩展，保留现有 ID 与执行函数；提交前检查完整 diff。
- [Hub 添加后工作台未立即更新] → 宿主在 IPC 成功后调用公开 `Workbench.refreshModes()`；下次进入/刷新仍从主进程恢复。
- [模式过滤隐藏历史任务] → 任务不删除，非研发模式用跨模式提示和切换动作保留可发现性。
- [持久化损坏] → 规范化 + 默认状态降级 + 原子写；未知字段忽略。

## Migration Plan

1. 上线 Store 与单元测试；无文件时使用 `office` 默认，不触碰既有数据。
2. 扩展 preload/IPC 与 `workbench-load`；旧 Renderer 忽略新增字段仍可运行。
3. 上线工作台模式切换、总览和团队分栏；engineering 复用现有执行路径。
4. 上线 Hub 添加动作和宿主消息桥。
5. 运行测试、lint、OpenSpec 校验和 Electron 冒烟，检查三模式、绑定、重启恢复与 Daemon 回归。
6. 回滚时可隐藏新 UI 并停止写 mode store；文件保留且不影响 Session、Capability、自动化或 Daemon 数据。
