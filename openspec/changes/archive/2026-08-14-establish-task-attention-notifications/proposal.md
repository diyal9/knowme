## Why

KnowMe 已将右下角铃铛定位为「通知 + 快捷处理」，但仍无真实任务提醒链路：协作 / 工作流 / Daemon 需要授权或输入时，用户若在看别的任务栏，或把应用藏到托盘，会错过 HITL。需按前台 / 后台分流提示。

### 目标用户

- 同时跑多条管线 / 协作任务、常把工作台藏到托盘的知识工作者。
- 需要被授权、澄清问题打断时立刻发现的人。

### 验收标准

- KnowMe **在前台**且当前焦点**不是**该任务工作间时：通知出现在 FAB 面板；需用户授权/输入时铃铛间歇动画；点击铃铛打开面板后动画停止。
- KnowMe **不在前台**（工作台未聚焦或已隐藏）：弹出桌面级暗色提示窗（头像/标题/正文/关闭），点击可回到工作台。
- 同一 HITL 键不重复刷屏；HITL 解除后条目可清除。
- 本迭代竖切以 Daemon gate/clarification 为主；协作/工作流等待可复用同一事件契约。
- `npm test` / `npm run lint` 通过。

### 非目标（Non-goals）

- 不做完整通知中心（已读历史、分类筛选、推送渠道配置）。
- 不恢复 FAB Session「继续工作」卡。
- 不把主进程 daemon 轮询整站搬迁（仅在必要时补焦点与 toast）。

### 商业化与体验价值

任务等待用户时「找得到、点得开」直接降低漏处理成本，强化 KnowMe 作为可信任工作伙伴的感知。

## What Changes

- 新增 `knowme-needs-attention` / `knowme-attention-cleared` 渲染事件与 FAB 列表消费面。
- 需输入类提醒驱动铃铛间歇动画；打开 FAB 停止动画。
- 主进程：焦点判定 + 桌面级 toast 窗（暗色卡）+ IPC；点击聚焦工作台。
- Daemon HITL 边沿发射提醒（竖切）；契约兼容 workflow / collab。

## Capabilities

### New Capabilities

- `task-attention-notify`: 任务待办提醒的前台 FAB / 后台桌面分流与交互契约。

### Modified Capabilities

- `workspace`: 悬浮铃铛面板承载真实通知条目与动画态。

## Impact

- `src/workspace.html` FAB
- `src/workbench.js` HITL 边沿
- `src/main.js` + `src/ipc/` + `src/preload.js`
- 新 `src/attention-toast.html`（或等价）
- 测试与 OpenSpec
