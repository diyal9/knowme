## Why

管线审阅「步骤」Tab 下，任务身份标题（`Daemon 阶段 · …`）与顶栏重复；失败态还会多出「推荐查看「过程日志」」提示行，干扰扫读。目标用户是在右栏快速查看失败/进行中步骤的知识工作者。去掉重复标题与推荐文案，让进度条与步骤列表成为主内容，降低半成品感。

## What Changes

- 步骤区进度块去掉与顶栏同文的 `purposeTitle` 行，只保留进度摘要与进度条。
- 去掉审阅 Tab 下方「推荐查看「…」」提示行（含 DOM、渲染与文案投影）。
- 保留失败态默认切到「过程日志」Tab 的推荐逻辑（静默，无文案）。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `pipeline-run-review-surface`：步骤区标题唯一性；不再展示 Tab 推荐文案。

## 验收标准

- 步骤 Tab 内不再出现与顶栏相同的 `Daemon 阶段 · …` 标题行。
- 任意状态下审阅区不出现「推荐查看「…」」文案。
- 失败任务仍可默认落到过程日志 Tab（无推荐文案）。
- `npm test` / `npm run lint` 通过。

## 非目标（Non-goals）

- 不改 Tab 推荐算法本身（除不展示文案）。
- 不改顶栏标题、Outcome Pill、步骤卡片内容。
- 不重做审阅区布局。

## Impact

- `src/workbench.js`、`src/workspace.html`、`src/lib/workbench-daemon-review.js`
- 可选：`src/workbench-layout.css`、相关契约测试
