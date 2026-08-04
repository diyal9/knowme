# Retro: chat-context-fastpath

## 做了什么

Agent 对话上下文装配改为意图分级（chat / assist / retrieval）+ 进程内读盘/结果缓存，短消息不再扫 wiki/装技能，TTFB 本地成本下降。

## 学到什么

- `wantWiki = !context.trim()` 是隐性性能坑：无打开文件时连「你好」也会全量读 wiki
- 意图分级必须保守：误伤任务比多带一点上下文更贵；异常默认 `assist`
- 缓存 API 要与单测约定一次写清（`invalidateFiles` / `statMtimeMs(-1)`），避免并行草稿文件互踩

## 后续

- 设置页可暴露 `chatContextTier`（现支持 settings 字段与 `KNOWME_CTX_FULL=1`）
- 意图词表可抽配置，持续补口语检索词
