## Why

编排画布顶栏「模式 / 对齐 / 保存 / 运行」图标按钮视觉尺寸不齐，专业感与可点区域不一致。

## What Changes

- 统一 `.wb-studio-tool-btn` 为固定正方形尺寸（含 primary）
- 统一内部图标盒与 SVG 尺寸，防止不同 viewBox 图标撑开或显得大小不一

## 目标用户

在编排画布顶栏操作的创作者。

## 验收标准

- 左工具区与右动作区所有 `wb-studio-tool-btn` 外框宽高一致
- 图标视觉占位一致；无控制台报错

## 非目标（Non-goals）

- 不改按钮含义、顺序或交互
- 不改缩放浮动条（`wb-studio-nav-btn`）

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

（无 — 纯视觉尺寸锁定）

## Impact

- `src/workbench-console.css`
- `tests` 对工具栏按钮尺寸断言（如有）
