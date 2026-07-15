# Design: favorite-to-footer

## 渲染

- `note.html`：`#btnStar` 从 `.win-btns` 移入 `.footer`，置于 `.mode-seg` 之后
- 样式：底栏按钮（`foot-star`），复用 `.star.on` 实心/空心 glyph 逻辑
- JS：`btnStar` / `setFavorite` / `toggleFavorite` 不变

## 主进程 / IPC

无变更。

## 性能

仅 DOM 位置移动，无额外 IO。
