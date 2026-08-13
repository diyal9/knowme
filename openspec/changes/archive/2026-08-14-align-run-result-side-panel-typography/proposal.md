## Why

结束态结果页右侧卡片（`#wbRunStageResult`）的小标题、主标题、分区标题与分割线，尚未与对话右栏工作流卡（`.wb-side-workflow`）对齐：分区标题偏灰、区块无 inset 分割线、内边距节奏不一致，用户切换左右栏时视觉不统一。

## What Changes

- 结果页标题区与「产物」分区采用与右栏相同的字号/字重/颜色层级。
- 标题区与「产物」之间增加与 `.wb-side-block` 同 token 的水平分割线，并统一上下边距。
- 结果区内边距对齐右栏面板（约 11–12px），底部操作区分割线复用同一边框色。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `pipeline-run-review-surface`：结束态结果页排版 MUST 与对话右栏工作流卡的边距、分割线、标题层级一致。

## 目标用户

- 在工作台查看管线/工作流运行结果的知识工作者。

## 验收标准

- 结果页「管线/工作流」小标题与主标题字重、颜色对齐右栏「工作流」+ 工作流名。
- 「产物（N）」分区标题对齐右栏「需要」（深色加粗，非 muted）。
- 标题区与产物区之间有 inset 水平分割线；左右边距与右栏面板一致。
- 「再跑一次 / 查看执行过程」行为不变。

## 非目标（Non-goals）

- 不改产物打开逻辑、列表条目交互或 footer 按钮文案。
- 不重做双栏布局或对话右栏本身。

## Impact

- `src/workbench.js`、`src/workbench-shelf.css`
- 相关契约测试
