## Why

管线执行间左栏把 Daemon 过程块 `prepend` 到对话区顶部，日志出现在「当前工作」引导之上，与 Agent 对话「旧上新下、最新贴近输入框」的阅读习惯相反，扫读像倒序。

## What Changes

- 过程块改为挂到对话流**底部**（`append`），位于空态/消息之后、输入框之上。
- 日志行内滚动默认贴底，便于看到最新输出。
- 不改日志行时间序（仍旧→新）与轮询协议。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `pipeline-run-review-surface`：左栏过程块在对话流中的垂直位置与贴底行为。

## 目标用户

- 在管线双栏执行间边看过程边补充材料的知识工作者。

## 验收标准

- 有过程日志时：自上而下为「当前工作/消息 → 过程块 → 输入框」。
- 过程块内最新日志行可见（贴底或可滚到最新）。
- Agent 对话区其他空态/消息顺序不变。

## 非目标（Non-goals）

- 不改右栏审阅 Tab、状态推断或节点进度文案。
- 不重做 progress.md 折叠交互。

## Impact

- `src/workspace-agent.js`
- `src/workbench-layout.css`（间距）
- 相关静态契约测试
