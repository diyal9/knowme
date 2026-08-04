# Retro: prompt-studio-v0.2

**日期**: 2026-07-06

## 做了什么

v0.2.0 将产品叙事统一为 KnowMe：结构化五段编辑、版本 diff、category/OKF 筛选、记忆面板、卡片↔Concept 双向。

## 做得好的

- 数据模型向后兼容：`migrateNoteFields` + 单测覆盖
- OKF promote 带 lint 门禁，与设置页实例化闭环
- 30 项自动化测试，门禁一次通过

## 可改进

- 收录 OKF 用 `alert`，应统一 Toast
- promote 重复无去重提示
- GUI 流式 AI 仍依赖 ADVISORY 实机点验

## 下一版线索

- 模板市场 / 提示词变量表单
- Concept 与卡片双向同步（编辑 Concept 回写卡片）
- 代码签名 + v0.2.0 tag 发布（task 32 待用户确认）
