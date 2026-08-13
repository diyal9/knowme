## Why

工作流首页的「N 个工作流 · M 个现在可以运行」独占一行，挤占卡片上方空间；同时货架已改为两列网格，但折叠预览仍按旧的自适应列数估算，导致默认折叠时仍露出第二行半截卡片。

## What Changes

- 将货架摘要文案移入筛选行：紧挨领域 chip（全部/办公/研发/视觉）右侧，「管理工作流」仍靠右
- 折叠态默认只展示**一行**卡片（宽屏 2 张、窄屏 1 张），超出以「更多」展开；默认保持折叠

## 目标用户

在工作台「工作流」页快速扫读并启动工作流的日常用户。

## 验收标准

1. 摘要与领域筛选在同一行，位于 chip 右侧、「管理工作流」左侧
2. 进入工作流首页时货架默认折叠，只显示一行卡片
3. 卡片数超过一行时出现「更多（N）」；展开后可看到全部，再点可收起

## 非目标（Non-goals）

- 不改卡片内部结构、文案或运行逻辑
- 不改「你的工作流运行」近期列表折叠规则
- 不改两列网格本身（沿用既有断点）

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `workbench-workflow-shelf`：首页筛选栏布局与折叠预览行容量对齐两列网格。

## Impact

- HTML：`src/workspace.html` 货架筛选区结构
- CSS：`src/workbench-shelf.css` 摘要样式
- JS：`src/workbench.js` `shelfRowCapacity()`
- 测试：`tests/workbench-templates.test.js` 静态回归
