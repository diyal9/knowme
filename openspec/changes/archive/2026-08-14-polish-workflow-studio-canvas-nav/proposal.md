## Why

编排工作流画布目前只能靠滚动条查看大图，无法平移/缩放；节点仅有左右连接点、自动边粗硬，用户反馈排版僵、连线不顺。

## What Changes

- 画布视口：滚轮缩放、空白/中键/空格拖动画布、右下角缩放控件（适应 / 100%）
- 四向端口：入口（左/上）+ 出口（右/下）；条件节点保留双分支
- 连线路由按相对位置选择锚点，三次贝塞尔更柔顺
- 自动间距略放宽；开始/结束节点可拖动

## Impact

- `src/lib/workbench-studio-canvas.js`
- `src/workbench.js`、`src/workbench-console.css`、`src/workspace.html`
- `tests/workbench-studio-canvas.test.js`
