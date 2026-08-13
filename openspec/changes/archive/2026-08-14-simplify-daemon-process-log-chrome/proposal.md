## Why

过程日志里 PROGRESS.MD 的「预览/源码」切换多余；展开/收起带文字显得噪；标题「PROGRESS.MD」对 C 端不友好。需要精简为仅预览，并用图标完成折叠，折叠条靠顶/底贴边。

## What Changes

- 去掉预览/源码切换，过程区仅 Markdown 预览
- 展开/收起仅保留 chevron 图标（文案进 `aria-label`）
- 「PROGRESS.MD」改名为「过程」，默认展开
- 收起的分区文件头贴顶（过程）或贴底（运行日志），展开区占满剩余高度

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `daemon-progress-preview`: 去掉源码切换；标题与折叠交互精简

## Impact

- `src/workbench.js`、`src/workbench-layout.css`、`src/lib/workbench-daemon-review.js`
- 契约测试：`tests/workbench-templates.test.js`、`tests/workbench-daemon-review.test.js`
