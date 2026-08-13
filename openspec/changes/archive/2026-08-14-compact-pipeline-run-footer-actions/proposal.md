## Why

管线任务执行右栏底部同时有「刷新 / 返回」动作条，与顶栏 `#wbRunBack` 重复；「过程日志」按钮又拉满整行，显得过宽且与刷新脱节。需收敛底栏 chrome，让常用动作贴在一起。

## What Changes

- 去掉 daemon 审阅右栏底栏「返回」（退路仅保留顶栏返回）。
- 去掉终态「重跑」底栏按钮；执行过程与后续意图改走左栏对话区。
- 「刷新」移到与「过程日志」同一行（审阅 foot）。
- 无审批/澄清等必要动作时，隐藏整条 `#wbRunnerActions` 底栏。
- 「过程日志」按钮由通栏改为自适应宽度，与刷新并排。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `pipeline-run-review-surface`：审阅右栏底栏动作布局与返回唯一性。

## 目标用户

- 在右栏审阅管线结果、只需刷新或回看过程日志的知识工作者。

## 验收标准

- 管线执行右栏底栏不再出现「返回」。
- 「刷新」与「过程日志」并排，且过程日志按钮不再拉满整行。
- 无审批/重跑等动作时，不再露出空底栏条。
- 顶栏 `#wbRunBack` 仍可用；相关静态契约测试通过。

## 非目标（Non-goals）

- 不改审批 / 澄清 / 重跑动作语义。
- 不改左栏过程对话协议或轮询。
- 不重做运行顶栏。

## Impact

- `src/workspace.html`、`src/workbench.js`、`src/workbench-layout.css`
- 必要时 `tests/workbench-templates.test.js`
