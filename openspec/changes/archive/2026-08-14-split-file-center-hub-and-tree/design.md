## Context

文件中心侧栏由渲染进程 `src/workspace.js` 的 `renderSourceTree()` 一次性拼出源管理分区 + 文件树。IPC（`sourcesList` / `sourcesSetActive` / `sourcesTreeChildren` 等）不变。见 `proposal.md` Why。

## Goals / Non-Goals

**Goals:**
- 用会话态分层（hub / tree）拆开导航，不改主进程与数据模型。
- 树层首屏即文件；源中心承载管理与 AI 产物列表。

**Non-Goals:**
- 不持久化分层状态到 `workspaceState`（会话内足够）。
- 不引入新 IPC / 新依赖。

## Decisions

1. **分层状态 `fileCenterLayer: 'hub' | 'tree'`**  
   - 有活跃源且用户未主动进 hub → `tree`  
   - 无活跃源，或用户点返回/切换 → `hub`  
   - 在 hub 选源成功后 → `tree`  
   - 替代方案：整页源中心 → 否（日常路径过重）；仅折叠分区 → 否（仍占首屏）

2. **复用 `#btnProjectBack` 作为「返回源中心」**  
   - 树层显示；hub 隐藏。`title` / `aria-label` 改为「返回我的空间」。  
   - 替代：侧栏内再做一个返回按钮 → 增加 chrome 噪音。

3. **树层切换条**  
   - 展示当前源名 + 类型短 meta +「切换」；本地/仓库可保留小「打开」动作。  
   - 不渲染完整路径与用途说明。

4. **搜索**  
   - hub：过滤源名与 AI 产物标题。  
   - tree：保持现有文件路径过滤。

## Risks / Trade-offs

- [Risk] 用户习惯「一眼看到所有源」→ Mitigation：切换条文案明确「切换」，hub 标题仍为「我的空间」。  
- [Risk] 契约测试硬编码旧 DOM 文案 → Mitigation：同步更新 `file-center-navigation` / `source-tree-ui` 测试。

## Migration Plan

纯前端渲染变更；无数据迁移。回滚即恢复 `renderSourceTree` 单栏堆叠。

## Electron 边界

- 仅渲染进程 DOM 与会话变量。  
- 选源仍走既有 `sourcesSetActive` IPC；懒加载树逻辑不变。
