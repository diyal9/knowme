---
type: Conflict
title: DNU 计算口径 — 行业手册疑似笔误
status: open
parties:
  - 行业术语手册（投放）：「当日首次登录账号数 / 当日总登录账号数」
  - 行业通用：DNU = 当日首次登录的去重账号数（计数，非比例）
timestamp: 2026-06-17T12:00:00Z
---

# 差异

| 来源 | 计算口径 |
|------|----------|
| [行业术语 — 投放](/references/industry-glossary/acquisition.md) | 当日首次登录账号数 **/** 当日总登录账号数 |
| 通用行业实践 | `COUNT(DISTINCT user_id)` WHERE 当日为首次登录日 |

# 判断

手册中 DNU/WNU/MNU 均写为「分子/分母」形式，**疑似模板笔误**（应为去重计数）。Agent 引用 DNU 时须标注 open 争议，**不得**将比例当作标准 DNU。

# 建议裁定

1. 向手册维护方确认是否修正 CSV/飞书表。
2. 项目 Wiki 若建 `dnu` Metric，采用计数口径并链本 Conflict。

# Agent 引用规则

- 引用行业手册 DNU 时须标注 **open 争议**，采用 **去重计数** 而非比例。
- 本仓 **尚无** `dnu` Metric Concept；百炼查数不涉及 DNU，可忽略至 ingest 需求出现。

# 相关

- [industry-glossary-policy](/synthesis/industry-glossary-policy.md)
