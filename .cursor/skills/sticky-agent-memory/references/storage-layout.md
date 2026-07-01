# 存储布局

## 目录树

```
<memory_root>/
├── index.md
├── bootstrap.md             # sessionStart 生成，首轮优先读
├── profile.yaml             # 稳定偏好（可选）
├── episodes/
│   └── YYYY-MM-DD/
│       └── <conversation_id>.jsonl
├── working/
│   └── recent.jsonl         # correction/product_theory/habit/dev_workflow
├── patterns/
│   ├── registry.json
│   └── pending_prompts.jsonl
└── summaries/
    ├── daily/YYYY-MM-DD.md
    ├── weekly/YYYY-Www.md
    └── monthly/YYYY-MM.md
```

## workspace_id

仓库根路径 SHA256 前 12 位 — 同一 clone 路径稳定、不同仓库隔离。

## 保留策略

| 层级 | 建议 |
|------|------|
| episodes | 30 天 |
| working/recent | 最近 500 条 |
| daily | 90 天 |
| weekly | 1 年 |
| monthly | 永久 |

## 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `STICKY_MEMORY` | `1` | `0` 关闭 |
| `STICKY_MEMORY_ROOT` | 见上 | 覆盖持久根 |
| `STICKY_MEMORY_BUFFER` | `%TEMP%/sticky-notes/memory-buffer/<ws>` | 热缓冲 |
| `STICKY_MEMORY_PROMPT_THRESHOLD` | `3` | 重复几次后入 pending |
| `STICKY_MEMORY_LLM` | — | `1` 启用可选 LLM 摘要 |
| `STICKY_MEMORY_LLM_API_KEY` | — | 或 `OPENAI_API_KEY` |

## 查看当前根

```bash
npm run memory:path
```
