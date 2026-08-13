## Why

编排工作流 Studio 侧栏过宽、文案过密、画布未铺满；节点缺少可发现的删除与右键操作，画布作业效率差。

## What Changes

- 编排页全宽全高铺满（去掉浮动卡片留白）
- 节点库固定窄侧栏 + 紧凑调色板/专家列表
- 画布节点卡片精简；节点删除按钮 + 右键菜单 + Delete 键
- 连线可选中删除（pointer-events 可点）

## Impact

- `src/workbench-console.css`、`src/workbench-shelf.css`
- `src/workspace.html`、`src/workbench.js`
- `src/lib/workbench-studio-canvas.js`
- tests: static contract
