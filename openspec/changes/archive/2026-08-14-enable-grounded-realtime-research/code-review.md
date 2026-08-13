# Code Review: enable-grounded-realtime-research

## 范围

- 实时研究意图、来源发现与 task frame
- 无密钥 RSS 搜索、URL 安全过滤与 Tool Registry 契约
- Agent Run 注入、EvidenceLedger / OutputGate 失败关闭
- 提示词、时间线标签、单测与 Electron fixture 冒烟

## 结论

PASS。实现遵循 OpenSpec，未新增 npm 依赖、IPC、持久化格式或 Renderer 网络出口；普通 `chat` 快路径保留。最终自动化 1385/1385、lint、OpenSpec strict、Electron 8/8 均通过。

## 重点检查

- [x] `search_web` 具有完整 Tool Contract，可在 v1 Registry 注册与投影
- [x] 研究来源从本轮 `getToolRecords()` 发现，不硬编码飞书按钮名单
- [x] `search_web` 结果限制数量、总字符、响应体、超时和时间范围
- [x] 非 http(s)、localhost、字面私网地址在搜索结果阶段过滤；正文读取继续 DNS/重定向 SSRF 复核
- [x] Bing redirect 解包后再次进行 URL 安全校验
- [x] 公开时效任务的 task frame 要求成功 `search_web` 证据；失败输出被 OutputGate 关闭
- [x] 搜索摘要与网页正文证据区分，回答规则要求发布时间/检索时间
- [x] 单项结构化来源选择被提示词禁止，现有 choice 协议与 UI 未改

## 风险与后续观察

- 公共 RSS provider 无 SLA；当前可注入 endpoint/fetch，失败返回稳定错误，不编造结果。
- `search_web` 只保证一次成功搜索为硬门禁；多原文读取目前是强提示与回归要求，不是硬计数门禁，避免站点 403 让整轮不可交付。
- 新闻查询会移除“今天/最新/资讯”等时效包装词；具体时间仍由 `recency_days` 和结果 `publishedAt` 过滤。
- 外部 MCP 搜索的语义推断只影响来源描述，不提升权限、不自动执行，也不进入固定 requiredTools。
