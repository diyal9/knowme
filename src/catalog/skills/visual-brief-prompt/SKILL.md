---
name: visual-brief-prompt
description: >-
  把视觉 Brief 整理为文案方向与可迭代图像提示词。Use for campaign visuals,
  key art prompts, and export-ready creative briefs.
slash: /visual-brief-prompt
version: 1.0.0
disable-model-invocation: false
---

# 视觉 Brief 出图提示

## 何时使用

- 官方「Brief 出图审阅」工作流
- 用户给出活动/素材 Brief，需要文案方向 + 图像 prompt

## 输出顺序

1. **受众与卖点**（3 条以内）
2. **文案方向**（标题/副标题/CTA 各 1–2 备选）
3. **图像提示词**（中英均可，含构图、风格、负向词）
4. **审阅清单**（人工选版前需确认的 3 点）

## 约束

- 不调用外部生图 API；只产出可交给人工或下游工具的 prompt
- 不虚构品牌资产；缺 Brief 时最多追问 1 句
