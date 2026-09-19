# OKF 渐进加载

避免首轮塞满上下文。

## 加载顺序

```
kb/okf/index.md
  → semantic/index.md | behavioral/index.md（按问题）
    → metrics/index.md | events/index.md（按问题）
      → 单个 Concept .md
```

## 按任务类型

| 任务 | 优先加载 |
|------|----------|
| 指标口径 | `semantic/metrics/` + 链接的 `behavioral/events/` |
| **查数 / 要数字** | Metric `# TE Query Hint` + [te-mcp-analysis](/references/te-mcp-analysis.md) + TE MCP |
| 埋点协议 | `behavioral/events/` + 盘古 MCP |
| SQL | `behavioral/queries/` + 链接 Table |
| 活动复盘 | `semantic/playbooks/` + synthesis |
| 口径争议 | `synthesis/conflicts/` |

## index 不足时

- Cherry KB `search_knowledge`（关键词 + project 名）
- grep 仓库 `kb/okf/**/*.md`
