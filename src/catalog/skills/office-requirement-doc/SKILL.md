---
name: office-requirement-doc
description: >-
  根据用户材料撰写结构化需求文档初稿，含背景、范围、验收标准与风险，并做去 AI 味处理。Use
  when the user asks to write a requirements document, PRD, or 需求文档.
slash: /office-requirement-doc
version: 1.0.0
disable-model-invocation: true
---

# 写需求文档

## 何时使用

- 用户要撰写/评审需求文档、PRD、需求案初稿
- KnowMe 写作模式空态或快捷菜单触发 `writingRequirementsDoc`

## 输入

- 用户提供的：目标、背景、约束、要点
- 可粘贴文本或 @ 引用文件
- 材料不足时 **最多追问 3 个最关键缺口**；信息已足够时 **直接交付**，不要先讲方法论

## 默认结构

1. 背景
2. 目标
3. 范围
4. 非目标
5. 用户场景
6. 核心流程
7. 验收标准
8. 风险与待确认事项

## 缺事实处理

- 缺关键信息用 **「待确认」** 或 **「待补」** 标注
- **禁止编造**用户未提供的事实、数据或项目名

## 去 AI 味（交付后必做一轮）

- 减少空泛拔高、宣传腔、三段排比和套话
- 保留事实、术语、边界和专业度

## 约束

- 不调用飞书工具（本 Skill 纯写作；用户若需查资料应另行触发文档/飞书 Skill）
- 写入飞书须等用户审批
