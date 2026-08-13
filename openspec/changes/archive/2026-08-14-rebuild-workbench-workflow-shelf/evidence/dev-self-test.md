# 开发自测 — rebuild-workbench-workflow-shelf

## 命令

| 项 | 命令 | 结果 |
|---|---|---|
| 单元 / 集成测试 | `npm test` | 1560 / 1560 通过 |
| Lint | `npm run lint` | lint ok · script-scope ok |
| OpenSpec 严格校验 | `npx openspec validate rebuild-workbench-workflow-shelf --strict` | valid |
| Electron 冒烟 | `node openspec/changes/rebuild-workbench-workflow-shelf/evidence/shelf-electron-smoke.js` | 26 / 26 · 控制台报错 0 |
| 死代码扫描 | `node scripts/dead-code-scan.js src/workbench.js` | unused 0 |
| 僵尸 DOM 扫描 | `node scripts/dead-dom-scan.js` | dead bindings 0 |

## 冒烟覆盖

`evidence/shelf-electron-smoke.json` 中 26 项检查，重点：

- `shelf-has-cards`：17 个工作流 · 15 个现在可以运行
- `legacy-entries-removed`：旧的七处启动入口在 DOM 中已不存在
- `domain-filter-applies` / `filter-clear-restores`：领域与来源筛选可用且可一键清除
- `manage-panel-agents|studio|daemon|automation`：抽屉内四个分区都能直接切换
- `run-leaves-input-stage`：点卡片 → 填目标 → 开始运行，真的进了执行/产物阶段
- `no-blocking-mask-during-run`：运行期间没有残留的全屏遮罩
- `run-topbar-sits-above-body` / `run-shell-is-single-column`：运行视图是单列、顶栏在上
- `narrow-no-horizontal-overflow`：760px 窄窗无横向滚动

## 本轮修掉的真实缺陷

1. **全屏遮罩吞掉所有点击**。启动时 `restoreLaunchIntentFromStores()` 会用历史意图重开旧的
   `#wbWorkflowModal`，该遮罩铺满窗口，导致左侧导航、货架卡片全部点不动。
2. **确认两次才能跑**。运行视图点「开始运行」后，`openWorkflow()` 又弹出旧的启动弹窗要求再点
   「开始任务」。现在 `startWorkflowRun()` 直接起跑，弹窗只保留 Agent 详情 / Profile / 提示 / 澄清。
3. **运行视图被历史 grid 拆成两栏**。`workbench-console.css` 里
   `[data-layout="task-room"] #wbTaskDashboard { display:grid; ... }` 把顶栏挤成竖条、内容甩到右侧。
4. **顶栏文案答非所问**。运行视图副标题显示的是货架筛选状态（「全部领域」），现在显示在跑的工作流与目标。

## 截图

- `screenshots/shelf-desktop.png` — 货架（桌面）
- `screenshots/shelf-narrow.png` — 货架（760px 窄窗）
- `screenshots/run-input-stage.png` — 运行 · 确认输入
- `screenshots/run-live-stage.png` — 运行 · 产物
- `screenshots/manage-drawer.png` — 管理抽屉
