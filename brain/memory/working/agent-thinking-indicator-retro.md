# Retro: agent-thinking-indicator

## 做了什么

发送后首包前展示「思考中…」+ 三点动画，覆盖工作台 / 便签 / 编辑器。

## 学到什么

- 已有 `streaming` 空气泡只剩光标，用户感知为「卡死」；等待态必须可读文案，不能仅靠光标。
- `updateStreamText` 在思考态无 `.chat-text` 时必须整泡重渲，否则首包不切换。

## 可升格

- UI 等待态：空流式 → thinking indicator 模式（≥3 次再 `/evolve`）
