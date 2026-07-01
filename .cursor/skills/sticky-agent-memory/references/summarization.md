# 日/周/月摘要

## 触发

`memory_cursor_hook.py` 在 `sessionEnd`、`stop`、`preCompact` 时：

1. 聚合当日 `episodes/` → `summaries/daily/YYYY-MM-DD.md`
2. 周日历周 → `summaries/weekly/YYYY-Www.md`
3. 自然月 → `summaries/monthly/YYYY-MM.md`

## 可选 LLM 增强

设置 `STICKY_MEMORY_LLM=1` + API Key 后，在日报/周报末尾追加 `## LLM 摘要` 段（不覆盖原始条目）。

## Agent 使用

- 复杂任务开场读当日 daily
- 跨会话回顾读 weekly / monthly
- LLM 摘要仅作辅助，指正类以 `working/recent.jsonl` 为准
