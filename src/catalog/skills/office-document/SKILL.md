---
name: office-document
description: >-
  根据场景与材料撰写通知、汇报、周报、方案同步、会议纪要等可发送办公文稿，含简洁发送版与去
  AI 味处理。Use when the user asks for office documents, reports, memos, or 办公文档.
slash: /office-document
version: 1.0.0
disable-model-invocation: true
---

# 写办公文档

## 何时使用

- 用户要写通知、汇报、周报、方案同步、会议纪要等日常办公文稿
- KnowMe 写作模式空态或快捷菜单触发 `writingOfficeDoc`

## 输入

- 文档类型、受众、核心信息（用户一句话或粘贴要点）
- 材料不足时最多追问 3 个最关键缺口

## 执行步骤

1. 判断最合适的文体（通知 / 汇报 / 周报 / 纪要等）
2. 按文体组织结构，输出 **完整正文**
3. 正文后补一版 **更简洁的发送版**

## 缺事实处理

- 缺关键事实用 **「待补」** 标注
- **禁止编造**未提供的日期、数据、人名、结论

## 去 AI 味（交付后必做一轮）

- 减少模板腔和高频套话
- 保留事实、语气和结论

## 约束

- 不调用飞书工具
- 写入外部系统须等用户确认
