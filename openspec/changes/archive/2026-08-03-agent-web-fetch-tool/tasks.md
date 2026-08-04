# Tasks: agent-web-fetch-tool

## 1. 抓取核心 `src/lib/web-fetch.js`

- [x] 1.1 新建模块骨架与常量：`DEFAULT_TIMEOUT_MS = 15000`、`MAX_BYTES = 2 * 1024 * 1024`、`MAX_REDIRECTS = 5`、`MAX_TEXT_CHARS = 120000`、常规 UA
      → spec: `agent-web-fetch` / Fetch is bounded by timeout and size
- [x] 1.2 实现 `isBlockedAddress(ip)`：IPv4/IPv6 双栈网段判定，覆盖 design D2 清单（含 `::ffff:` 映射地址还原成 IPv4 再判）
      → spec: URL validation blocks unsafe targets
- [x] 1.3 实现 `assertSafeUrl(rawUrl)`：协议白名单（http/https）→ 字面 IP 判定 → `dns.promises.lookup(host, { all: true })` 全解析地址判定，任一命中即拒绝，返回 `{ ok:false, code:'blocked_target'|'unsupported_scheme'|'invalid_url', message }`
      → spec: URL validation blocks unsafe targets（含 hostname 解析到私网场景）
- [x] 1.4 实现 `extractReadableText(html)`：整块剔除 `script`/`style`/`noscript`/`iframe`/`svg`/`nav`/`header`/`footer`/`aside`/`form`/HTML 注释；`h1-h6` → `#` 前缀、`li` → `- ` 前缀；复用既有实体解码与空白归并
      → spec: Only text-like content is returned / HTML page yields readable text
- [x] 1.5 实现 `fetchReadablePage()`：`redirect: 'manual'` 手动跟随，每跳前调 `assertSafeUrl()`，超 `MAX_REDIRECTS` 返回 `too_many_redirects`
      → spec: Redirects are re-validated
- [x] 1.6 在 `fetchReadablePage()` 中加 `AbortSignal.timeout()` 与外部 `signal` 合流（`AbortSignal.any`），超时映射为 `code:'timeout'`
      → spec: Slow page times out with a readable reason
- [x] 1.7 用 `response.body` reader 流式累计字节，超 `MAX_BYTES` 停止读取并置 `truncated: true`；MUST NOT 使用 `response.text()` 一次性读全
      → spec: Oversized page is truncated
- [x] 1.8 Content-Type 判定：仅接受 `text/html`、`text/plain`、`application/xhtml+xml`、`application/json`；其余返回 `unsupported_content_type` 并带上实际类型
      → spec: PDF link is refused with a clear reason
- [x] 1.9 错误信息中文化：为每个 `code` 提供 C 端可读 message（含 HTTP 状态码原文）
      → spec: Failures are reported honestly and actionably

## 2. 内容源路径复用（`src/lib/web-source.js`）

- [x] 2.1 `fetchPageSnapshot()` 内部改调 `webFetch.fetchReadablePage()`，保持函数签名、返回结构与 `web-sources/<hash>/` 目录布局不变
      → design: D1 / Migration
- [x] 2.2 抓取失败时把 `web-fetch` 的可读 message 透传给既有 `{ ok:false, error }` 契约，不改调用方 `sources-add-web`
      → design: D1

## 3. Agent 工具 `src/lib/agent-web-tools.js`

- [x] 3.1 定义 `FETCH_WEB_PAGE_TOOL`：单参数 `url`（string，required，`additionalProperties: false`），description 显式写明「任何用户粘贴的外部链接用本工具；feishu.cn / larksuite.com 链接改用 `feishu.read_doc`」
      → spec: Web page fetch tool is available to the agent / External URL does not fall back to connector search
- [x] 3.2 实现 `buildWebTools({ signal })` 返回 `{ definitions, handlers }`，与 `agent-plan-tools` / `agent-sandbox` 的工厂形状一致
      → design: Architecture / 模块职责
- [x] 3.3 handler 把成功结果格式化为含「标题 / 最终 URL / 是否截断 / 正文」的文本块，并在 `meta` 带 `finalUrl`、`title` 供 UI 使用
      → spec: Public article URL is fetched and usable
- [x] 3.4 handler 对失败返回 `{ ok:false, code, text }`，让既有 `agent-recovery` 错误分类能识别 `timeout`/`network_error` 为可重试
      → spec: Failures are reported honestly and actionably

## 4. 工具面接入

- [x] 4.1 `src/main.js`：`require` 新模块，在 `needsConnectorTools` 分支构造 `webTools`，加入 `mergeExtraTools(fileTools, sandboxTools, planTools, webTools)`（`main.js:3856`）
      → spec: Web page fetch tool is available to the agent
- [x] 4.2 `src/lib/agent-tools.js` `validateToolCall()`：为 `fetch_web_page` 增加分支，空 URL 返回 `invalid_args`，trim 后透传
      → spec: URL validation blocks unsafe targets
- [x] 4.3 `src/lib/agent-tools.js` `summarizeToolArgs()`：返回域名 + 路径缩写（超 80 字符省略）作为 UI 摘要
      → design: Architecture
- [x] 4.4 `src/main.js:4157` 工具标题映射与 `src/workspace-agent.js` `toolTimelineTitle()`：`fetch_web_page` → 「读取网页」
      → spec: Web page fetch tool is available to the agent

## 5. 提示词分流

- [x] 5.1 `src/lib/ai-assistant-context.js:19` 改写「外部资料」规则：外部 http(s) 链接 → `fetch_web_page`；feishu/larksuite 链接 → `feishu.read_doc`
      → spec: `ai-assistant` / External link tool routing guidance
- [x] 5.2 同处补一条：具备抓取工具时禁止声称无法访问外部网页，禁止未尝试就要求用户手动粘贴正文或提供飞书 token
      → spec: `ai-assistant` / No capability denial when a fetch tool exists

## 6. 测试

- [x] 6.1 新建 `tests/web-fetch.test.js`：`assertSafeUrl` 用例矩阵——`http://127.0.0.1:8080`、`http://localhost:3000`、`http://192.168.1.1`、`http://10.0.0.5`、`http://169.254.169.254`、`file:///etc/passwd`、`ftp://example.com`、`http://[::1]/` 全部拒绝；正常公网域通过
      → spec: Loopback / Private network / Non-HTTP scheme is rejected
- [x] 6.2 `tests/web-fetch.test.js`：起本地 `http.createServer` 覆盖重定向到 `127.0.0.1` 被拦、重定向超限、404 状态码透传、`application/pdf` 拒绝、超大响应截断
      → spec: Redirects are re-validated / Only text-like content / Oversized page is truncated
- [x] 6.3 `tests/web-fetch.test.js`：`extractReadableText()` 对含 `nav`/`footer`/`script` 的 HTML 只保留正文，标题转 `#`、列表转 `- `
      → spec: HTML page yields readable text
- [x] 6.4 扩充 `tests/agent-tools.test.js`：`fetch_web_page` 注册后 `isAllowedTool` 为真、空 URL 校验失败、`summarizeToolArgs` 输出域名摘要
      → spec: Web page fetch tool is available to the agent
- [x] 6.5 新增提示词断言：`ai-assistant-context` 输出包含外链/飞书分流指引
      → spec: `ai-assistant` / Prompt names the web fetch tool for external URLs
- [x] 6.6 跑既有 web-source / sources 相关测试确认无回归（D1 收紧校验的副作用）
      → design: Risks

## 7. 自测与门禁

- [x] 7.1 `npm test` 全绿
- [x] 7.2 `npm run lint` 无 error
- [x] 7.3 `npm start` 启动应用，粘贴 Anthropic 链接写 TechTalk：应用已启动无报错；真实抓取 + 工具面执行 PASS；真机 LLM 选工具记 ADVISORY（`acceptance.md`）
      → 验收标准第 1、2 条
- [x] 7.4 飞书链接分流：工具描述 + 提示词 + 单测覆盖；真机 LLM 再确认记 ADVISORY
      → spec: Feishu link still routes to the connector
- [x] 7.5 写 `evidence/dev-self-test.md`（test/lint 结果 + 实测记录）
- [x] 7.6 写 `qa-plan.md`（含 Smoke Scope）与 `code-review.md`
