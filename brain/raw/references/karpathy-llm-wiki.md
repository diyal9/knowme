---
type: Reference
title: Karpathy LLM Wiki
description: 持久化、可复利增长的 LLM 维护维基模式。
tags: [reference, llm-wiki, karpathy]
timestamp: 2026-07-01T00:00:00Z
resource: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
---

# 三层架构

1. **Raw sources** — 只读原始资料（`brain/raw/`）
2. **Wiki** — LLM 维护的结构化百科（`brain/wiki/`）
3. **Schema** — Agent 配置（`AGENTS.md`、rules、skills）

## 核心操作

| 操作 | 说明 |
|------|------|
| **Ingest** | 读 raw → 更新 wiki + knowledge |
| **Query** | 先读 index，再钻取相关页 |
| **Lint** | 矛盾、孤儿、断链、过期声明 |

## 与本项目

KnowMe 将 OKF bundle（`brain/knowledge/`）作为可交换的长期知识层，wiki 作为领域综合层。

# Citations

[1] [Karpathy LLM Wiki Gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
