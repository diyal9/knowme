---
name: office-document-finalize
description: >-
  将草稿整理为可直接发送/评审的定稿：统一标题层级、列表、行动项与附录，长稿适合审阅区，并做
  去 AI 味处理。Use when the user asks to finalize, polish layout, or 排版定稿.
slash: /office-document-finalize
version: 1.0.0
disable-model-invocation: true
---

# 排版定稿

## 何时使用

- 用户已有草稿，需要统一结构、列表、行动项后可直接发送/评审
- KnowMe 写作模式快捷菜单触发 `writingFinalize`

## 输入

- 待定稿草稿（粘贴或 @ 文件）

## 执行步骤

1. 统一标题层级、段落节奏、列表样式
2. 明确结论、行动项和附录说明
3. 必要时将散乱内容重排为更清晰的结构
4. 若内容已足够长，优先产出适合进入 **右侧审阅区** 的完整长文

## 缺事实处理

- 草稿中缺失的信息保留 **「待补」**，不要编造

## 去 AI 味（交付后必做一轮）

- 减少空话和重复表达
- 保留原意与关键事实

## 约束

- 不调用飞书工具
- 不改变用户已确认的核心结论，仅优化结构与可读性
