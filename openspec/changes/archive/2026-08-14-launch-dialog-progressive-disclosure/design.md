## Context

启动弹窗由渲染进程 `workbench.js` 组装 HTML，样式在 `workspace.html`；完整 DAG 已由 `renderWorkflowDagHtml` + `buildWorkflowGraph()` 实现。见 proposal.md - Why。本 change 只改启动弹窗信息架构，不跨主进程/IPC。

## Goals / Non-Goals

**Goals:**
- 默认降低首屏密度：摘要代替完整 DAG；工程字段默认折叠。
- 展开态复用现有 DAG 渲染与分支语义，避免双实现。
- 用 `modal.dagExpanded` 状态驱动布局类名，保持与现有 `renderModal()` 一致。

**Non-Goals:**
- 不改 Daemon IPC、启动 payload 字段名。
- 不改任务工作间运行时拓扑。

## Decisions

1. **摘要默认 / 点击展开完整 DAG（而非永久移除）**  
   - 默认：`aside` 渲染摘要卡（步数 + 特征芯片 +「查看执行流程」）。  
   - 展开：`modal.dagExpanded = true`，复用 `renderWorkflowDagHtml`，弹窗加宽。  
   - 备选：永久去掉 DAG → 否决（启动前信任与「有门禁」预期仍有价值）。  
   - 备选：二级全屏弹层 → 否决（多一层模态，关闭路径复杂）。

2. **工程字段收入 `<details class="wb-launch-engineering">`**  
   - 首屏保留：任务标识、PRD/asset。  
   - 折叠：GitLab 项目、ref、commit、输入/输出制品、资源路径。  
   - 备选：全部塞进现有「高级设置」→ 与执行说明混杂，否决。

3. **窄模态默认宽度**  
   - 未展开时弹窗约单栏宽度（≈560–640px），展开后恢复宽分栏。  
   - 纯渲染层 CSS class 切换，无性能风险。

## Risks / Trade-offs

- [Risk] 老用户习惯右侧常驻 DAG → Mitigation：摘要明确写步数与「查看执行流程」。  
- [Risk] 模板测试硬编码「DAG rail」结构 → Mitigation：同步更新 `workbench-templates.test.js`。

## Migration Plan

纯前端；发版即生效。回滚即恢复 `wrapWorkflowLaunchBody` 常驻完整 DAG。
