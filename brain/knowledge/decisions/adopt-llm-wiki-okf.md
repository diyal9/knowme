---
type: Decision
title: Adopt LLM Wiki + OKF Knowledge Architecture
description: Two-layer knowledge — Karpathy LLM Wiki for synthesis, OKF v0.1 for durable exchangeable facts.
tags: [decision, llm-wiki, okf, knowledge]
timestamp: 2026-07-01T00:00:00Z
---

# Context

项目需要 **自我进化**：经验沉淀、跨会话复利、可分享给其他用户。

# Decision

采用双层知识架构（参考 [Karpathy LLM Wiki](/references/karpathy-llm-wiki.md) + [OKF v0.1](/references/okf-spec.md)）：

| 层 | 路径 | 用途 |
|----|------|------|
| Raw | `brain/raw/` | 只读原始资料 |
| Wiki | `brain/wiki/` | LLM 维护百科（ingest/query/lint） |
| Knowledge | `brain/knowledge/` | OKF bundle，可 import/export |
| Memory | `brain/memory/` | 会话/问题工作记忆 |

# Consequences

- Story 完成后沉淀 learnings → OKF concepts
- 同类问题 ≥3 次 → Skill 升格（见 [Evolution Loop](/processes/evolution-loop.md)）
- `npm run kb:export` / `kb:import` 实现知识便携

# Citations

[1] [Karpathy LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
[2] [OKF SPEC.md](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
