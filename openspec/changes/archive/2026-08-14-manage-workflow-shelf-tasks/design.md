## Context

任务 Tab 已有 `openTaskManageHub`：仅 `expertHomeTasks()`，弹窗 DOM 单例、选择策略与 `workbenchTaskArchive` 删除。工作流 Tab「你的工作流任务」复用同一卡片渲染，但标题旁无管理入口。见 proposal.md - Why。

边界：纯渲染进程 UI；归档经既有 preload IPC，不新增主进程通道。

## Goals / Non-Goals

**Goals:**
- 复用同一管理弹窗壳，按作用域切换列表数据与文案
- 工作流作用域卡片展示工作流身份（名称 + workflow 图标/头像回退）

**Non-Goals:**
- 不新建独立 modal DOM / 不改 task-store schema
- 不把「管理工作流」（包）与「管理工作流任务」合并

## Decisions

1. **作用域参数而非第二弹窗**  
   `openTaskManageHub(scope)`：`expert` | `workflow`。同一 `ensureTaskManageModal`，打开时改标题/空态/hint/aria，策略与勾选逻辑共用，策略查询按当前 scope 的 task map。  
   *备选*：复制一套 modal — 拒绝，避免双份策略按钮与删除逻辑。

2. **入口放在「你的工作流任务」标题右侧**  
   与 `wbTaskManage` 同构（`settingsLine` 图标按钮），不用货架「管理工作流」按钮，避免与包管理混淆。  
   *备选*：每张任务卡右侧齿轮 — 与「参考图2」批量管理不符，且破坏现有卡片主点击打开任务。

3. **工作流卡片副文案**  
   `workflowName || workflowId` + 相对时间；头像用伪 agent `{ name, id }` + `agentAvatarMark`，无图时依赖现有语义图标回退（可传 workflow 相关 id 或统一用 workflow 图标类）。保持与专家卡片布局一致。

4. **删除后刷新**  
   现有 `deleteSelectedManagedTasks` 已 `syncRecentTaskCaches()`；补 workflow 空态 `elShelfRecentEmpty`。重新打开时按当前 scope 刷新列表。

## Risks / Trade-offs

- [Risk] 单例 modal 残留上一 scope 标题 → Mitigation：每次 `openTaskManageHub` 同步 title/hint/list  
- [Risk] 用户误删进行中任务 → Mitigation：沿用既有文案「进行中的对话会话不会自动关闭」；不新增二次确认（与专家侧一致）

## Migration Plan

无数据迁移。回滚：移除货架设置按钮与 scope 分支即可。
