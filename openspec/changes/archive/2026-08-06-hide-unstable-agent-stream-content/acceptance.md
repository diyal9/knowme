# 制作人体验验收

- 日期：2026-08-06
- Change：`hide-unstable-agent-stream-content`
- 结论：PASS，可交测试

## 验收结果

- [x] 未完成标题、表格、代码围栏、链接不显示 Markdown 原文。
- [x] thinking / suggestion / JSON 协议片段不进入可见文本或 DOM。
- [x] 稳定标题、列表、表格直接以最终格式出现。
- [x] 缓冲期间只显示低干扰「正在整理…」状态。
- [x] 完成前后气泡与正文容器保持稳定。
- [x] 用户取消时未稳定尾部被丢弃，不在终态泄漏。
- [x] 最终内容可达，既有追问与行动入口保持一致。

## 体验判断

隐藏半行内容会让无换行长句稍晚出现，但相较“先看源码再刷新”，稳定性与可信感收益更高；已稳定段落仍可渐进展示，不会退化为整段等待。

## 证据

- Electron smoke：12/12 PASS（含 V2 preload/IPC 与滚动漂移 0 px）
- `evidence/screenshots/buffered-pending-content.png`
- `evidence/screenshots/stable-stream-content.png`
- `evidence/dev-self-test.md`
- `code-review.md`

## BLOCKING

无。
