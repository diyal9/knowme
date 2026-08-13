## Why

编排画布节点卡用 Unicode 符号当图标，与左侧组件库（`ui-icons` / Lucide）不一致；长标题与多行出入参被卡片边界裁切，扫读时像「内容没展示完」，而不是有意摘要。需要统一图标并改为重点摘要展示。

## What Changes

- 画布节点头栏图标改为与组件库同一套 `data-icon`（与调色板一致：play / users / clipboardCheck 等），经 StickyIcons 挂载
- 摘要正文只保留重点：过长标题/行文省略并带完整 `title` 悬停；出入参过多时只显示前几项 +「等 N 项」
- 修正卡片高度预算（头栏更高），避免正文被底边硬裁切
- 窄节点（如确认）适当加宽，减少标题无意义截断

## 目标用户

在「编排工作流」里拖节点排版的创作者：需要一眼认出节点类型，并扫到关键配置，而非读完整字段。

## 验收标准

- 开始 / 专家 / 确认 / 结束等节点图标与左侧组件库同类图标一致（非 ▶■◆ 等字符）
- 长标题以省略号收尾，悬停可读全文；出入参超过展示上限时出现「等 N 项」而非半截裁切
- 结束节点等多行摘要不再被卡片底边切断
- 选中、连线、拖拽、属性面板编辑不受影响
- `npm test` / `npm run lint` 通过

## 非目标（Non-goals）

- 不改 Inspector 完整字段与 runtime 编译
- 不重做画布视觉体系或引入新图标包
- 不改轻量步骤列表模式

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `agent-composition-studio`：专业画布节点摘要投影与类型图标对齐组件库

## Impact

- `src/workbench.js` — 节点 HTML 用组件库图标；共用 kind→icon 映射
- `src/lib/workbench-studio-canvas.js` — 摘要行截断、重点字段、尺寸
- `src/workbench-console.css` — 图标 SVG 尺寸、省略与溢出
- `tests/workbench-studio-canvas.test.js` — 摘要与静态契约
