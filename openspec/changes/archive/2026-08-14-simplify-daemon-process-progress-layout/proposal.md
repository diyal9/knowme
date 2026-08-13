## Why

过程日志 Tab 的「全部过程」区信息噪音过高：顶部引导文案重复、元数据与 Traces 被包成卡片显得臃肿，Steps 宽表在窄栏里裁切且横滑不便，排障时难以一眼读全。

## What Changes

- 去掉过程日志顶部「Agent 全局运行过程…」引导文案
- 过程分区标题由「过程」改为「全部过程」
- Process / Traces 等 Markdown 列表元数据改为单行 label:content，去掉卡片壳
- 「全部过程」分区标题栏右侧增加放大预览按钮，点击后居中二级弹窗展示整块过程摘要（含元数据与 Steps 表）

### 目标用户

- 在工作台审阅 Daemon/管线任务进度与排障的用户

### 验收标准

- 过程日志 Tab 不再显示「Agent 全局运行过程」类 tip
- 分区标题为「全部过程」
- workflow/status/Traces 等条目无独立卡片边框，label 与内容同一行
- 「全部过程」标题栏右侧有放大图标；点击后弹窗可见完整过程摘要并可关闭

### 非目标（Non-goals）

- 不改 Daemon progress 源文内容或轮询协议
- 不改「步骤 / 制品 / 变更 / 事件」其它 Tab
- 不重做整页审阅信息架构

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `daemon-progress-preview`: 过程区文案、列表排版与 Steps 全貌预览弹窗

## Impact

- `src/lib/workbench-daemon-review.js`
- `src/workbench.js`、`src/workbench-layout.css`
- 测试：`tests/workbench-daemon-review.test.js`、`tests/workbench-templates.test.js`
