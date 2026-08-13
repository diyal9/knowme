## Why

工作流货架卡片页脚左侧留白，用户无法一眼判断「这个流程多久没改过」——尤其同名团队/我的副本并排时，缺少时间线索会增加选错或重复编辑的成本。

### 目标用户

- 主：在货架浏览并挑选工作流的知识工作者。
- 次：维护个人副本、需要区分新旧版本的进阶用户。

### 商业化与体验价值

货架是工作台主入口；补上「最近更新」可降低选择犹豫，强化卡片信息完整感，且不改存储与启动协议。

## What Changes

- 货架工作流卡片页脚左下展示最近更新时间（相对时间，悬停可见绝对时间）。
- 页脚布局改为左时间、右操作按钮；无有效时间戳时不占位、不显示假日期。
- 测试断言覆盖新结构；不改 package schema / IPC。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `workbench-workflow-shelf`：货架卡片 MUST 在页脚左下展示最近更新时间（有有效时间戳时）。

## Impact

- `src/workbench.js`：`shelfCardHtml` 页脚
- `src/workbench-shelf.css`：footer 左右分布与时间样式
- `tests/workbench-templates.test.js`：结构断言

## 验收标准

1. 有 `updatedAt`/`createdAt` 的卡片，页脚左下可见相对更新时间。
2. 悬停可看到完整日期时间（title 或等价）。
3. 无有效时间戳时左侧不显示占位文案。
4. 运行/编辑/复制按钮仍在右下，点击行为不回归。
5. `npm test` + `npm run lint` 通过。

## 非目标（Non-goals）

- 不按更新时间重排货架。
- 不改 workflow-package 字段或持久化逻辑。
- 不改「管理」页其他卡片样式（除非复用同一 shelf 组件）。
- 不在卡片上增加「创建时间」第二行。
