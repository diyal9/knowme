## Why

按面拆 CSS 并扫 UX 壳债 — 架构扫尾，用现行分层还债，不还原便签窗或 HTML 工作台。

## 目标用户

KnowMe 桌面工作台的开发者与制作人（后续迭代速度）。

## 验收标准

- 本 change tasks 全勾选
- `npm test` / `npm run lint` / `npm run typecheck:renderer` 绿
- evidence/react.md 记录 ReAct 反思

## 非目标

便签窗、页面级 HTML 工作台、cron、文件分屏编辑器、飞书 iframe。

## What Changes

见 design.md 与 tasks.md。

## Capabilities

### New Capabilities
- `workspace-css-ux`: 按面拆 CSS 并扫 UX 壳债

### Modified Capabilities
- （结构债，产品行为保持）

## Impact

主进程 / 渲染 / IPC 边界见 design.md。
