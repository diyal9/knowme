## Why

编排画布顶栏右侧「轻量步骤 / 保存 / 测试运行」占位偏重，左手侧又缺少对齐整理工具，拖乱节点后只能手动微调，编排效率与专业感不足。

## What Changes

- 右侧三个文字按钮改为图标按钮（title/aria-label 保留完整文案）
- 工具栏左侧：轻量步骤切换 + 一键对齐（自动布局）
- 右侧仅保留保存 / 测试运行
- 轻量步骤模式下左侧仅保留模式切换；一键对齐仅专业画布显示

## Capabilities

### New Capabilities

- `studio-canvas-toolbar`: 编排画布顶栏图标动作与左侧布局工具行为

### Modified Capabilities

- （无）行为增量落在新 capability；现有 composition studio 规格不改 REQUIREMENTS 条文

## Impact

- `src/workspace.html` — 工具栏结构（左工具 + 标题 + 右动作）
- `src/workbench.js` — 渲染与点击处理
- `src/lib/workbench-studio-canvas.js` — 导出/复用 autoLayout；可选对齐辅助
- `src/workbench-console.css` / `src/ui-icons.js` — 图标按钮样式与缺失图标
- tests: studio toolbar / layout helpers

## 目标用户

在工作台「编排工作流」里拖节点排版的创作者与产品使用者。

## 验收标准

- 右侧仅见图标，悬停/读屏可读出原按钮含义
- 左侧可一键整理节点并写回坐标；对齐工具对 ≥2 个有坐标节点生效（单选时对齐全部可布局节点或提示）
- 无控制台报错；`npm test` / `npm run lint` 通过

## 非目标（Non-goals）

- 不做多选框选、撤销栈、网格吸附开关
- 不改动右下角缩放控件语义
- 不引入第三方画布库
