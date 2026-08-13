## Why

货架卡片信息已齐（说明、输入/产出、更新时间、操作），但边框叠层多、chip 截断生硬、页脚与按钮对比失衡，扫读仍像「未抛光的线框」，降低成品感。

### 目标用户

在工作台货架挑选工作流的知识工作者。

### 商业化与体验价值

货架是主入口；卡片 chrome 更精细可提升专业感与启动意愿，不改真源与协议。

## What Changes

- 元信息 chip：软底无硬边框，减少视觉噪音与生硬截断感。
- 「步骤」并入页脚 meta（与更新时间并列），chip 区只保留输入/产出。
- 页脚：顶部分隔线；开始任务主按钮轻强调；编辑/复制为幽灵按钮。
- 领域图标：办公 / 研发 / 视觉使用不同图标，增强辨识。
- 整体字号、间距、圆角再收一档。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `workbench-workflow-shelf`：货架卡片 MUST 呈现更精细的 chrome（软 chip、页脚 meta、主次操作、领域图标），同时仍回答产出 / 输入 / 可运行三问。

## Impact

- `src/workbench.js`：`shelfCardHtml` 结构
- `src/workbench-shelf.css`：卡片 chrome
- `tests/workbench-templates.test.js`

## 验收标准

1. chip 无硬描边叠层；输入/产出仍可见。
2. 页脚可见步骤数与更新时间；操作按钮主次分明。
3. 不同领域卡片图标可区分。
4. 点击行为不回归；`npm test` + `npm run lint` 通过。

## 非目标（Non-goals）

- 不改排序、schema、详情弹层。
- 不引入插画或重拟物。
