# Acceptance — push-strict-score-to-96

制作人体验验收（对照证据口径，非新表面）。

## 通过条件

- [x] 助理默认路由可发送（`assistant.spec` 28 绿）
- [x] 100 条消息走虚拟列表（`agent-message-virtuoso`）
- [x] 首屏静态 CSS 小于 `f6ad048` 神文件（ratio 0.2388）
- [x] 工作台 / Hub / 知识网现有 spec 仍绿
- [x] 未恢复便签分屏编辑器；`restore-game-studio-ui-parity` 诚实缺口仍打开

## 对照图

- 基线助理：`../restore-game-studio-ui-parity/evidence/screenshots/baseline/baseline-assistant.png`
- 当前助理：`../restore-game-studio-ui-parity/evidence/screenshots/react/react-assistant.png`

## 结论

通过。从严九维落地后加权约 **96**（见评分画布）。性能不做 Electron 墙钟承诺；体验不做便签编辑器 1:1。
