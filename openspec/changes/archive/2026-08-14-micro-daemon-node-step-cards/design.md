## Context

管线审阅「步骤」Tab 已有时间线圆点 + 分层文案（`tidy-daemon-node-progress`）。`projectSteps` 目前未透传 `outputLabel`/`outputTitle`/`owner`/`type`。约束：不得恢复「外层壳 + 内层白卡」双层装饰；渲染进程内完成，无新增 IPC。

## Goals / Non-Goals

**Goals:**
- 左圆点对齐 + 右微节点卡；点击钻取详情并可返回。
- 投影透传详情字段；轮询刷新时保持选中节点（若仍存在）。

**Non-Goals:**
- 不改主进程/Daemon API；不单节点重跑；不改左栏过程流。

## Decisions

1. **微卡 = 轻量表面，非整栏白卡**  
   节点卡：细边框、小圆角、紧凑内边距、`max-width` 约内容区且左贴时间线；无阴影、无整列表套卡。  
   备选：通栏 hover 行 → 拒绝，不够「卡片微展示」。

2. **详情 = 同 Tab 内钻取，非模态**  
   `daemonReviewStepId` 有值时 `renderDaemonReviewBody` 渲染详情（返回 + 字段表）；无则列表。切 Tab / 换任务清空。  
   备选：居中对话框 → 窄右栏叠层打扰大。

3. **字段透传在 `projectSteps`**  
   保留 graphNodes 的 `outputLabel`/`outputTitle`/`owner`/`type`/`handoff`，详情直接读 step。

## Risks / Trade-offs

- [轮询重绘丢焦点] → 按 step id 恢复选中；节点消失则回列表。  
- [微卡被误读为双层装饰] → 单节点轻边框，列表本身无白壳。

## Migration Plan

纯前端；回滚还原 `renderDaemonReviewBody` 步骤分支与 CSS 即可。
