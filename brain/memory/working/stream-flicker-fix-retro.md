# Retro: stream-flicker-fix

日期：2026-07-22

## 做了什么

- 流式 MD：未完成表格/半行/围栏暂挂纯文本尾
- rAF 合并更新 + near-bottom 滚动 + CSS contain

## 学到什么

- 聊天「闪屏」多半是结构块（表格）每 chunk 重建，不是单纯 scroll
- 与 note 窗「流式纯文本」不同，工作台要活 MD，应用「稳定切分」而非关 MD

## 可升格

- 流式渲染稳定切分 checklist — 若再复发 ≥3 再 `/evolve`
