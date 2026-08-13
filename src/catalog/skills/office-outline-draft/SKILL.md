---
name: office-outline-draft
description: >-
  根据标题、提纲与要点扩写完整文稿，补齐过渡与行动项，缺事实标待补并做去 AI 味处理。Use when
  the user provides an outline or 提纲 and wants a full draft.
slash: /office-outline-draft
version: 1.0.0
disable-model-invocation: true
---

# 按提纲成稿

## 何时使用

- 用户给出标题、提纲、要点，需要扩写成完整文稿
- KnowMe 写作模式快捷菜单触发 `writingOutlineDraft`

## 输入

- 标题、提纲或要点（粘贴或 @ 文件）
- 材料不足时最多追问 3 个最关键缺口

## 执行步骤

1. 按提纲顺序扩写段落
2. 补齐段落衔接、例子占位、结尾收束和行动项
3. **不要编造**用户未提供的事实或数据
4. 缺关键事实时用 **「待补」** 明确标注

## 去 AI 味（交付后必做一轮）

- 让成稿更自然可读
- 不牺牲结构与层次

## 约束

- 不调用飞书工具
- 保持提纲层级与用户意图一致
