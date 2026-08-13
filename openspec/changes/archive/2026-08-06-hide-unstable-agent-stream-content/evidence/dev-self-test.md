# 开发自测报告

- 日期：2026-08-06
- Change：`hide-unstable-agent-stream-content`
- 定向测试：PASS（46/46）
- `npm test`：PASS（1278/1278）
- `npm run lint`：PASS（lint ok；script-scope ok）
- OpenSpec strict validate：PASS
- Electron 冒烟：PASS（12/12）

## 验证结论

- 半行标题、未闭合表格/代码围栏/链接与 thinking/suggestion 协议不进入可见文本或 HTML。
- 稳定标题、列表和表格直接渲染为最终 Markdown 节点。
- pending 状态只显示固定文案「正在整理…」，不包含模型尾部。
- 完成前后助手气泡与正文容器保持同一 DOM 节点。
- 用户取消时丢弃未稳定尾部，不会在终态暴露半截链接或 Markdown 源码。
- V2 事件经真实 preload/IPC 路径提交，用户上滑后的滚动漂移为 0 px。
- V2 canonical answer 与 legacy 兼容流均经过展示协议清洗。

## 证据

- `stream-visibility-electron-smoke.json`
- `screenshots/buffered-pending-content.png`
- `screenshots/stable-stream-content.png`
