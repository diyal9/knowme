---
type: Concept
title: KnowMe Conversation Reading Layout
description: Assistant reply width, typography and spacing contract for continuous conversation reading.
tags: [product, design-system, conversation]
timestamp: 2026-08-20T00:00:00Z
---

# 对话阅读布局规范

## 结论

KnowMe 的助手回复采用窄于输入框的独立阅读轨，正文字号和段落间距保持克制，目标是连续对话阅读，而不是文档铺满。

## 当前契约

- 阅读轨最大宽度：`--conversation-reading-max: 880px`
- 正文大小：`--conversation-body-size: 15px`
- 正文行高：`--conversation-body-leading: 1.68`
- 对话间距：`--conversation-turn-gap: 16px`
- 输入框工作轨可保持 920px，不要求和回复正文同宽。
- 执行过程默认以约 32px 的紧凑摘要展示，详细步骤按需展开。

## 维护规则

1. 优先修改 `src/renderer/app/tokens.css` 的对话 token，不在单个组件写另一套字号或字体。
2. 回复正文的段落、标题和列表使用 `agent-chrome.css` 的紧凑覆盖规则。
3. 任何扩大阅读轨、字号或段落留白的改动，都需要用 Codex/对话阅读截图进行视觉验收。
