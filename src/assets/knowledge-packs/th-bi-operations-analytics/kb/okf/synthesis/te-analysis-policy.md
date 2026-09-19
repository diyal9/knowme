---
type: Synthesis
title: TE 查数 vs Wiki 口径 — 权威与冲突
description: TE query_adhoc 结果与 OKF Metric 定义的关系；与盘古、行业 Reference 并列。
tags: [te-mcp, authority, policy]
status: active
timestamp: 2026-06-17T16:00:00Z
---

# 原则

1. **Wiki Metric** = 口径**定义**（人类可读 + 行为层链接）
2. **TE `query_adhoc`** = 平台上按 QP **算出的数字**
3. 两者不一致时 **不得**静默以 TE 覆盖 Wiki，或反之

# 权威优先级（查数场景）

| 问题 | 权威 |
|------|------|
| 埋点协议 / 枚举 | 盘古 MCP |
| 指标定义 / cohort 约定 | OKF Wiki |
| **报表/即席查询数值** | TE `query_adhoc` 结果（须注明 QP 与时间范围） |
| 行业释义 / 基准 | [industry-glossary](/references/industry-glossary/)（非强制） |

# Agent 作答

| 用户问 | 做法 |
|--------|------|
| 「7留怎么定义？」 | Wiki [d7_retention](/semantic/metrics/d7_retention.md) + 行业 Reference |
| 「上周 7留是多少？」 | TE builder → `query_adhoc`；附 projectId、时间、QP 摘要 |
| Wiki 定义 vs TE 结果不同 | 并列原因（cohort 事件不同、时间 mode、过滤条件）→ Conflict |

# 已知 open 关联

- [D1/D7 cohort](/synthesis/conflicts/d1-cohort-industry-vs-wiki.md)：Wiki 注册日 vs 行业「首日新增」；TE 留存由 `initialEvent`/`returnEvent` 决定，可能三者皆不同

# Lint

有 TE `projectId` 时：TE `list_events` 与 Wiki Event 名 diff，与盘古 diff **分开报告**。

# Citations

[1] [TE MCP Reference](/references/te-mcp-analysis.md)
[2] [info/conventions/authority-and-conflicts.md](../../../info/conventions/authority-and-conflicts.md)
