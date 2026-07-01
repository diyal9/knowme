---
name: llm-wiki-maintenance
description: >-
  Use when ingesting sources into brain/wiki, updating OKF knowledge bundle,
  querying wiki/knowledge, or linting contradictions and broken links for StickyNotes.
---

# LLM Wiki 维护

基于 [Karpathy LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) + [OKF v0.1](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)。

## 三层（`brain/`）

| 层 | 路径 | 规则 |
|----|------|------|
| 原始资料 | `brain/raw/` | **只读**，Agent 不得修改 |
| 领域百科 | `brain/wiki/` | LLM 维护，ingest/query/lint |
| 长期知识 | `brain/knowledge/` | OKF bundle，可 import/export |
| 工作记忆 | `brain/memory/` | 会话/问题，定期升格 |

## Ingest 流程

1. 读 `brain/raw/ingest/` 或用户指定来源
2. 与用户确认要点（可选）
3. 更新 `brain/wiki/`：summary/entity/concept 页
4. 更新 `brain/knowledge/`：OKF concept（必填 `type`）
5. 更新双方 `index.md` + `log.md`
6. 运行 `npm run kb:lint`

单源可能触及 10+ 页 — 保持交叉引用。

## Query 流程

1. 先读 `brain/wiki/index.md` 或 `brain/knowledge/index.md`
2. 打开相关 concept，综合回答
3. 有价值的探索结果 **可写回** wiki 为新页（标注来源）

## Lint 流程

```bash
npm run kb:lint
```

检查：schema（type 必填）、孤儿页、断链、重复标题。  
**不删除**文件 — 仅报告，等用户确认。

## OKF Frontmatter

```yaml
---
type: Concept          # REQUIRED
title: Display Name
description: One line
tags: [tag1, tag2]
timestamp: 2026-07-01T00:00:00Z
resource: optional-uri
---
```

保留文件名：`index.md`、`log.md`（index 可有 `okf_version: "0.1"` frontmatter）。

## 链接

- 推荐 bundle 绝对路径：`[customers](/concepts/foo.md)`
- 容忍断链（OKF 消费模型）
