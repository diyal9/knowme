# QA Plan

勾选状态说明：`[x]` = 已有自动化证据（括号内为对应检查项）；`[ ]` = 留给测试角色人工执行。
自动化证据来源：`evidence/shelf-electron-smoke.json`（Electron 实机 26 项）、
`evidence/shelf-supply-before-after.md`（供给夹具）、`tests/workflow-supply.test.js`（单元）。

## Smoke Scope

### 货架有货（供给侧，本次成败核心）

- [x] 启动 KnowMe 进入工作台，确认落地页是货架，页面上**不存在任何一级 Tab**（`shelf-active`、`legacy-entries-removed`）
- [x] 记录货架条目总数与「可运行」条目数，与改造前基线对比（`shelf-has-cards`：17 条 / 15 可运行；对比见 `shelf-supply-before-after.md`）
- [x] 货架汇总数字与实际卡片一致，不虚报（`shelf-summary-honest`）
- [ ] 确认 Daemon 在线时其目录中的工作流出现在货架上，与本地工作流使用同一套卡片
- [ ] 确认 `team-run` 卡片显示的步骤数与 `.cursor/workflows/team-run.json` 中的节点数一致，不再是空壳（夹具层已验，实机待人工确认）
- [x] 确认 `game-dev-delivery`（已标记 deprecated）**不出现**在货架上（`tests/workflow-supply.test.js` + 供给夹具 `hidden` 诊断）
- [ ] 确认领域筛选初始为「全部」，不预先隐藏研发与视觉领域的工作流

### 卡片与启动

- [ ] 不展开、不悬停、不进详情，仅浏览货架即可读到每张卡的产出、所需输入与可运行状态
- [ ] 找到一个不可运行的工作流，确认卡片列出具体缺失项，主操作禁用，且补齐入口可点击并跳到正确位置
- [x] 确认页面上**只有卡片主操作能启动运行**：无启动抽屉、无顶栏启动按钮（`legacy-entries-removed`）
- [x] 领域筛选生效且可一键清除（`domain-filter-applies`、`filter-clear-restores`）
- [ ] 在搜索框输入内容并回车，确认只筛选货架、不启动任何运行

### 运行三段式

- [x] 从卡片启动，确认进入接管式运行视图（`run-surface-active`、`run-stage-input`、`run-shell-is-single-column`、`run-topbar-sits-above-body`）
- [x] 确认输入阶段提供目标字段（`run-input-has-goal-field`）
- [ ] 确认输入阶段按工作流声明生成表单；留空必填项时无法进入执行
- [x] 确认执行后端由系统判定并展示，**不要求用户选择**（`run-backend-decided`）
- [x] 从卡片主操作到运行开始不出现二次确认弹窗，无全屏遮罩拦截点击（`run-leaves-input-stage`、`no-blocking-mask-during-run`）
- [x] 进入执行中阶段有实时状态（`run-shows-live-status`）
- [x] 运行期间返回货架，运行不中断，顶部「进行中」可见并能回到运行视图（`cancel-returns-to-shelf`、`running-toggle-visible-after-launch`）

### 管理抽屉

- [x] 从货架管理入口分别进入智能体、编排、执行后端、自动化四个面板（`manage-menu-opens`、`manage-panel-agents`、`manage-panel-studio`、`manage-panel-daemon`、`manage-panel-automation`）
- [x] 关闭抽屉回到货架（`manage-drawer-closes`）
- [ ] 确认编排工作室未选中节点时为不超过两栏的布局，检查器不占常驻空间
- [ ] 在编排中保存一个工作流，返回货架，确认它立即出现在「我的」来源下

### 诚实空状态

- [x] 空状态与汇总数字一致，不出现占位卡片或示例卡片（`empty-state-consistent`）
- [ ] 断开 Daemon 后刷新货架，确认 Daemon 来源的工作流消失，且系统明确提示「连接 Daemon 可恢复 N 个工作流」
- [ ] 构造无可运行工作流的场景，确认空状态逐条列出原因并提供补齐操作

## Regression Scope

- [ ] 工作流实际执行链路不变：本地 Team Runtime 与 Daemon 后端的运行结果、日志、产物与改造前一致
- [ ] 个人工作流存储 `workbench-workflows.json` 可被新版本正常读取，已有个人工作流不丢失
- [ ] 助理对话区功能不受影响；其快捷卡改为跳转货架后仍能到达可启动位置
- [ ] Rail 各入口（助理、工作台、能力、自动化、知识网、设置）行为不变
- [ ] 重启应用后工作台模式、进行中运行、滚动位置正确恢复；领域筛选**不**被记住
- [x] 760px 窄窗下货架与运行视图无横向溢出（`narrow-no-horizontal-overflow`，截图 `screenshots/shelf-narrow.png`）
- [x] 全流程控制台零报错（`console-error-free`）

## Anti-pattern Review（测试角色重点）

- [ ] 是否出现新的第二启动路径（哪怕只是一个「快速开始」按钮）
- [ ] 是否有信息被藏进折叠区导致判断可运行性必须展开
- [ ] 空状态是否在无货时仍试图显得「有东西」
- [ ] 卡片文案是否泄漏内部术语（workflow id、`.cursor/workflows/`、后端代号）
- [ ] 删除多入口后，是否存在任何一条用户旧路径变成死路（点击无反应或跳到空页面）

## Automated Checks

- [x] `npm test` — 1560 / 1560
- [x] `npm run lint` — 无 error
- [x] `npx openspec validate rebuild-workbench-workflow-shelf --strict` — 通过
- [x] `node openspec/changes/rebuild-workbench-workflow-shelf/evidence/shelf-electron-smoke.js` — 26 / 26
- [x] `node .cursor/scripts/harness.js gate --json` — `blocking: false`
