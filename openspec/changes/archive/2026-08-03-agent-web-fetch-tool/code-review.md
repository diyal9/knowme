# Code Review: agent-web-fetch-tool

审阅范围：`src/lib/web-fetch.js`（新）、`src/lib/agent-web-tools.js`（新）、`src/lib/web-source.js`、`src/lib/agent-tools.js`、`src/lib/ai-assistant-context.js`、`src/main.js`、`src/workspace-agent.js`、`tests/*`

## 结论

**通过**，无 BLOCKING 问题。一项已知残余风险（DNS rebinding）已在设计与代码注释中显式标注并接受。

## 逐项检查

| 项 | 结论 | 说明 |
|---|---|---|
| SSRF 防护完整性 | 通过 | 协议白名单 + 字面 IP 判定 + DNS 解析后全地址判定；IPv4 11 段、IPv6 含 `::ffff:` 映射还原；`redirect: 'manual'` 每跳重校验 |
| 内存边界 | 通过 | 流式 reader 累计，超 `MAX_BYTES=2MB` 即 `reader.cancel()`；未使用 `response.text()` 一次性读全 |
| 超时分层 | 通过 | 抓取 15s（`AbortSignal.timeout` + `AbortSignal.any` 合流外部 signal），外层工具执行 45s 兜底；跨跳共用同一 deadline，不会被重定向链放大 |
| 资源泄漏 | 通过 | 3xx / 非 2xx / 类型不符三条早退路径均 `await response.body?.cancel()` |
| 错误分类联动 | 通过 | `timeout` / `network_error` 经 `agent-recovery.classifyToolError()` 落入可重试类；`blocked_target` 落入 `unknown`（不重试、如实反馈），符合预期 |
| 契约兼容 | 通过 | `web-source.fetchPageSnapshot()` 签名、返回结构、`web-sources/<hash>/` 目录布局均未变；新增参数为可选注入，仅测试使用 |
| 工具描述边界 | 通过 | description 显式写明 feishu 域改用 `feishu.read_doc`，与提示词形成双保险 |
| 启动性能 | 通过 | 新模块无顶层副作用，不进主进程启动路径 |
| 测试可信度 | 通过 | 34 条新增用例；SSRF 用例注入 stub lookup，不依赖真实 DNS；重定向/超时/截断用例起真实本地 HTTP server |

## 提出并已修复

1. **十六进制字符引用未解码**（自测中真实抓取暴露）：`decodeEntities()` 只处理 `&#39;` 未处理 `&#x27;`，导致正文出现 `Here&#x27;s`。已抽出 `codePointOrSpace()` 统一处理并补用例。
2. **既有 `sources.test.js` mock 过于失真**：原 mock 返回 `{ ok, text() }` 裸对象，且会打真实 DNS。改为真实 `Response` 对象 + 注入 stub lookup，测试不再依赖网络。

## 已知残余风险（接受）

**DNS rebinding**：`assertSafeUrl()` 校验时解析到公网 IP、undici 实际建连时可能解析到内网。Node 的 `fetch` 不暴露「按已解析 IP 连接」的钩子，彻底封堵需自定义 undici dispatcher（`Agent({ connect: { lookup } })`）。

接受理由：触发条件是用户主动粘贴攻击者控制的链接，且抓取结果只回灌给本地模型、不外发，攻击者拿不到回显。已在 `web-fetch.js` `assertSafeUrl()` 注释与 `design.md` D2 记录，后续若接入自动抓取（非用户指定 URL）必须先补齐。

## 建议（非阻塞）

- 若后续用户反馈正文提取在部分站点残留导航，再评估引入 `@mozilla/readability` + `linkedom`（design D5 已留升级路径），本轮维持零新增依赖。
- 目前无抓取结果缓存，同一 URL 在多轮对话中会重复抓。当前单次 <1s，暂不优化；若出现同轮重复调用，`agent-loop` 的调用缓存已能收敛。
