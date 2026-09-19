---
type: Synthesis
title: 行业术语手册 — 权威层级与 override 约定
description: 说明行业 Reference 与项目 Wiki/MCP 口径的关系；非团队强制标准。
tags: [industry-glossary, authority, policy]
status: active
timestamp: 2026-06-17T12:00:00Z
---

# 定位

[行业术语手册](/references/industry-glossary/)（345 条，20260616 版）为**行业参考**，**不是** Forever9 团队强制口径。各项目可采纳、裁剪或 override。

# 权威优先级

| 层级 | 来源 | 适用 |
|------|------|------|
| 1 | 盘古 MCP（埋点 / 枚举） | Event 名、属性、维度枚举 |
| 2 | OKF Wiki `semantic/metrics/` 等 | 项目生产口径定义 |
| 3 | TE MCP `query_adhoc` | 平台上实际查出的数值（附 QP） |
| 4 | **行业术语 Reference** | 释义、行业基准值、沟通对齐 |
| 5 | th-config | 配表数值 |

# Agent 作答规则

1. 用户问「行业里 XX 通常指什么」→ 引用 [industry-glossary](/references/industry-glossary/)，并声明「行业参考，非本项目强制口径」。
2. 用户问「我们项目 XX 怎么算」→ 引用 Wiki Metric + MCP；若与行业参考不同，**并列说明**。
3. 用户问「上周 XX 是多少」→ Wiki `# TE Query Hint` + TE builder → `query_adhoc`；结果与 Wiki 定义不同 → [te-analysis-policy](/synthesis/te-analysis-policy.md)。
4. **行业基准值**（如次留合格线）可用于 Playbook 解读与对标，不可替代项目 KPI 目标。

# Override 流程（项目侧）

1. 在对应 Metric 页 `# Definition` 写明项目 cohort / 公式。
2. 在 `# Citations` 链行业 Reference，必要时链 [Conflict](/synthesis/conflicts/)。
3. 裁定后 Conflict 标 `resolved`。

# Citations

[1] Raw：`raw/10-data-basic-knowledge/business-glossary/游戏行业数据分析标准术语手册_20260616/`
[2] 飞书：[在线表](https://forever9.feishu.cn/sheets/TtQUs0ISHhgnGEthTD8cQsnUnVg)
