## Why

工作流货架卡片信息齐全，但纯文字堆叠、字号接近、缺少视觉锚点，扫读像文档块而非可点的产品卡片，降低「浏览 → 理解 → 启动」转化。

### 目标用户

- 主：在工作台货架挑现成工作流的知识工作者。
- 次：扫一眼判断能否运行、再决定打开详情的进阶用户。

### 商业化与体验价值

货架是工作台主入口；卡片更易扫读、更有「卡片感」，可缩短选择成本、提升启动意愿，且不改 package 真源与启动协议。

## What Changes

- 货架卡增加领域色标 / 图标井，形成可识别的卡片锚点。
- 标题、一句话说明、元信息建立明确字号与颜色层级。
- 「需要 / 产出 / 步骤」改为紧凑 chip 行，避免与说明段落重复成字墙。
- 可运行 / 阻塞态用左边色或状态点强化；阻塞文案压缩为一行。
- 页脚图标操作与点击分区保持不变。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `workbench-workflow-shelf`：卡片 MUST 具备可扫读的视觉层级与卡片身份（图标/色标 + 排版），同时仍回答产出 / 输入 / 可运行三问。

## Impact

- `src/workbench.js`：`shelfCardHtml` 信息架构
- `src/workbench-shelf.css`：卡片视觉与字号层级
- `tests/workbench-templates.test.js`：结构断言更新
- 不改 IPC、workflow-package schema、启动路径

## 验收标准

1. 卡片标题明显大于说明与元信息；领域图标井可见。
2. 输入 / 产出 / 步数以 chip 呈现，仍无需展开即可回答三问。
3. 阻塞态有视觉区分且仍显示缺失摘要。
4. 点卡片 / 运行图标 / 编辑复制行为不回归。
5. `npm test` + `npm run lint` 通过。

## 非目标（Non-goals）

- 不在卡片上画 DAG。
- 不改详情弹层、Studio、Daemon 协议。
- 不引入插画或重阴影拟物风格。
- 不改 package 存储字段。
