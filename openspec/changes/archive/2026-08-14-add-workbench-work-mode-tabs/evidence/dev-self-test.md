# 开发自测 — add-workbench-work-mode-tabs

## 范围

把工作台顶部分为「团队管线 / 我的 Agent」两条工作模式 Tab；移除「官方/团队/我的」来源 chip 与「今日待办」整条链；我的 Agent Tab 承载本地 Agent 卡片 + 个人工作流 + 空态自造血。

## 变更

- `src/workspace.html`：在 `.wb-head` 顶栏内新增 `#wbModeTabs` 两 Tab（与能力页 / 知识网同一位置范式），内容区新增 `#wbAgentShelf`/`#wbAgentGrid`；删除 `#wbShelfTodos`、`#wbSourceSwitcher`、悬浮助理 `#km-fab-todo` 及其点击逻辑；脚本版本 `?v=modes2`。
- `src/workbench.js`：新增 `activeWorkMode` / `setWorkMode` / `syncWorkModeUi` / `workModeOf` / `myAgents` / `agentCardHtml` / `handleMyAgentAction`；`shelfItems`/`renderShelf` 改为按 Tab 过滤与渲染；领域筛选按 Tab 显隐；退役 `shelfSource`（含 `restoreTaskRoomReturnState` 存档兼容护栏，改用 `workMode`）；移除今日待办全部函数、DOM 缓存、事件绑定与 `knowme:add-todo` 监听。
- `src/workbench-shelf.css`：顶栏 Tab 样式（对齐 `.drawer-capability-tab`：52px 满高、下划线 `bottom:0` 压顶栏底边、窄屏 44px 独占一行）+ `wb-my-agent-card` + `wb-empty-actions`；删除来源 chip 样式。
- `src/workbench-layout.css`：删除全部 `.wb-todo-*` 失效样式。
- `openspec/changes/rebuild-workbench-workflow-shelf/specs/workbench-workflow-shelf/spec.md`：放宽「一级 MUST NOT 提供 Tab」为「仅允许两条工作模式 Tab」；来源不再作为货架筛选维度。

## 验证结果

| 项 | 命令 | 结果 |
|---|---|---|
| 单元/集成测试 | `npm test` | PASS 1567/1567 |
| Lint | `npm run lint` | PASS（lint ok + script-scope ok）|
| OpenSpec 严格校验 | `npx openspec validate add-workbench-work-mode-tabs --strict` | PASS |
| OpenSpec 严格校验（受改动的兄弟 change）| `npx openspec validate rebuild-workbench-workflow-shelf --strict` | PASS |
| Electron 冒烟 | `node openspec/changes/rebuild-workbench-workflow-shelf/evidence/shelf-electron-smoke.js` | PASS 32/32，控制台错误 0 |

> 冒烟首跑出现一次 `shelf-active` 早退 + 点击超时，是已知的窗口被遮挡（compositor 无新帧）偶发；再跑一次 32/32 全绿。

## 冒烟新增覆盖

- `mode-tabs-present` / `team-tab-default-active` / `domain-visible-on-team`
- `domain-hidden-on-mine` / `mine-tab-content-or-selfstock`
- `team-tab-restores-domain`

## 截图

![团队管线 Tab](screenshots/../../rebuild-workbench-workflow-shelf/evidence/screenshots/shelf-desktop.png)
![我的 Agent Tab](screenshots/../../rebuild-workbench-workflow-shelf/evidence/screenshots/mine-agent-tab.png)

> 截图落在冒烟脚本所在的 `rebuild-workbench-workflow-shelf/evidence/screenshots/`：`shelf-desktop.png`（团队管线）、`mine-agent-tab.png`（我的 Agent，5 Agent + 1 个人工作流）、`shelf-narrow.png`（760px 窄窗）。

## 已知取舍

- Agent「开始使用」路由到助理对话最小实现，与助理「我的专家」的心智重叠按用户要求暂不处理。
- 今日待办的 store 与 IPC 保留、不删用户数据，仅摘除 UI 入口。
