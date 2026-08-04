# Design: agent-web-fetch-tool

## Context

现状（探索证据）：

| 事实 | 位置 |
|---|---|
| 工具面由 `createToolSurface({ extraDefinitions, handlers })` 组装 | `src/lib/agent-tools.js:186` |
| `extraTools` 通过 `mergeExtraTools(...)` 合并后传入连接器工具面 | `src/main.js:1315`、`src/main.js:3856-3858` |
| 工具选择完全交给模型（`tool_choice: 'auto'`） | `src/main.js:3980` |
| 提示词只举飞书工具为「外部资料」示例 | `src/lib/ai-assistant-context.js:19` |
| 已有网页抓取但只服务内容源 | `src/lib/web-source.js:39`、IPC `sources-add-web`（`src/main.js:1535`） |
| 飞书 `read_doc` 只放行飞书域 | `src/lib/connectors/feishu-toolkit.js:37` |
| 无 axios/node-fetch/undici，统一用 Node 全局 `fetch` | `package.json:35-40` |

因此本变更是**补一块缺失的工具**，而非重构工具链。设计目标是最小侵入：沿用既有 `buildXxxTools()` → `mergeExtraTools()` 的注入模式，不改工具循环、不改预算逻辑、不加依赖。

## Goals / Non-goals

**Goals**

- 模型能一步读到公开网页正文，无需用户预建内容源
- 抓取路径默认安全：SSRF 不可绕过，超时与体积有硬上限
- 失败信息对 C 端可读，且模型不会因失败转而编造内容

**Non-goals**

- 无头浏览器 / JS 渲染 / 登录态抓取
- 网页搜索（无 URL 时的「帮我搜」）
- 引入 readability、turndown、cheerio、jsdom

## Decisions

### D1. 新建 `src/lib/web-fetch.js` 作为单一抓取实现，`web-source.js` 改为其消费者

**决策**：把 URL 安全校验、带超时与体积上限的抓取、HTML 正文提取集中到新模块 `web-fetch.js`；`web-source.js` 保留 `fetchPageSnapshot()` 对外契约不变，内部改调 `web-fetch`。

**理由**：目前 `web-source.js` 的 `fetch(url, { redirect: 'follow' })` 无超时、无体积上限、无 SSRF 校验，本身就是隐患。与其复制一份加固逻辑给 Agent 用，不如让两条路径共用一份，顺带把内容源路径的安全洞一起补上。

**代价**：`web-source.js` 的既有行为会变严（内网地址不再能加为网页内容源）。这属于合意的安全收紧，在 tasks 中显式验证既有内容源测试不回归。

### D2. SSRF 采用「解析后校验 + 手动跟随重定向」

**决策**：不使用 `redirect: 'follow'`，改为 `redirect: 'manual'` 自行跟随，每跳都执行一次 `assertSafeUrl()`；`assertSafeUrl()` 先做协议与字面 IP 校验，再用 `dns.promises.lookup(hostname, { all: true })` 拿到全部解析地址，任一地址落入禁止网段即拒绝。

**理由**：只校验初始 URL 是经典 SSRF 绕过点——`http://evil.com` 302 到 `http://169.254.169.254/` 就能打到云元数据服务。`fetch` 的自动跟随不给校验中间跳的机会，所以必须手动跟随。

**已知残余风险**：DNS rebinding（校验时解析到公网 IP、实际连接时解析到内网）。Node 的 `fetch`（undici）不暴露「用已解析 IP 连接」的钩子，彻底封堵需要自定义 dispatcher。本轮**接受该残余风险**并在代码注释中标注，理由是攻击面仅限于「用户主动粘贴恶意链接」，且不返回响应给攻击者控制的通道。若后续要封堵，方案是 undici `Agent({ connect: { lookup } })` 固定 IP。

**禁止网段清单**（IPv4/IPv6 双栈）：

```
0.0.0.0/8  10.0.0.0/8  100.64.0.0/10  127.0.0.0/8  169.254.0.0/16
172.16.0.0/12  192.0.0.0/24  192.168.0.0/16  198.18.0.0/15  224.0.0.0/4
::  ::1  fc00::/7  fe80::/10  ::ffff:0:0/96（按映射出的 IPv4 再判一次）
```

### D3. 体积上限用流式读取实现，不用 `response.text()`

**决策**：通过 `response.body` 的 reader 逐块累计，超过 `MAX_BYTES`（2 MB）即停止读取并标记 `truncated`。

**理由**：`await response.text()` 会把整个响应读进内存后才有机会判断大小，对一个 500 MB 的响应等于自杀。先判 `Content-Length` 只能挡住诚实的服务器，chunked 编码下拿不到。

### D4. 超时用 `AbortSignal.timeout(15000)`，与工具执行 45s 超时分层

**决策**：抓取自身 15s；外层 `main.js` 的 `TOOL_EXEC_TIMEOUT_MS = 45000` 保持不变作为兜底。

**理由**：15s 远小于 45s，抓取超时会以工具结果（可读原因）返回给模型，让它有机会说明或换策略；如果只靠 45s 兜底，用户要多等 30 秒才看到一句失败。

### D5. 正文提取在 `stripHtml()` 基础上做减法，不引入解析库

**决策**：新增 `extractReadableText(html)`——先删 `script`/`style`/`noscript`/`iframe`/`svg`/`nav`/`header`/`footer`/`aside`/`form`/HTML 注释整块，再把 `h1-h6` 转成 `#` 前缀、`li` 转成 `- ` 前缀，最后走既有的标签剥离与实体解码。

**理由**：`Non-goals` 明确不加依赖。正则方案在恶意嵌套 HTML 上不完美，但本场景是「读公开文章供 LLM 消化」，LLM 对少量噪声容错很高；引入 jsdom 会让打包体积和启动时间付出不成比例的代价。

**取舍记录**：如果后续用户反馈提取质量不够（例如大量站点残留导航），再评估引入 `@mozilla/readability` + `linkedom`。

### D6. 工具命名 `fetch_web_page`，描述里显式写明「非飞书链接用这个」

**决策**：工具名 `fetch_web_page`；description 明确 “Fetch a public http/https web page and return its readable text. Use this for ANY external link the user pastes. For feishu.cn / larksuite.com links use feishu.read_doc instead.”

**理由**：模型的工具选择只看名字和描述。既然故障就出在「描述里谁看起来更像能读 URL」，就在描述层面直接把边界写死，这比在提示词里绕弯更有效。

### D7. 工具始终随 `needsConnectorTools` 一起投影，不加设置开关

**决策**：在 `main.js:3856` 的 `mergeExtraTools(fileTools, sandboxTools, planTools, webTools)` 中加入，条件与其他工具一致（`needsConnectorTools`）。不新增设置项。

**理由**：「读用户自己粘贴的链接」是基础能力，不是需要用户显式授权的高风险动作（对比 `run_shell` 有 `agentScriptsEnabled` 开关，那是本机代码执行）。多一个开关就多一个「为什么不работает」的支持成本。沙箱的 `allowNetwork` 开关管的是「模型自己写代码去联网」，与本工具正交，不复用。

## Architecture

### 进程边界

全部在**主进程**。渲染进程不直接发起抓取——`workspace.html` / `workspace-agent.js` 只消费 `tool.*` 事件做时间线展示。这与既有工具一致，也避免渲染进程绕过 SSRF 校验。

```
渲染进程                    主进程
─────────                  ────────────────────────────────
workspace-agent.js
  toolTimelineTitle()  ←── emit('tool.start'/'tool.end')
                            │
                            ai-generate handler (main.js:3490)
                              └ toolExecutor.executeToolCall()
                                  └ handlers['fetch_web_page']
                                      └ agent-web-tools.js
                                          └ web-fetch.js
                                              ├ assertSafeUrl()  ← dns.lookup
                                              ├ fetchWithLimits() ← global fetch
                                              └ extractReadableText()
```

### 模块职责

| 模块 | 职责 | 不负责 |
|---|---|---|
| `src/lib/web-fetch.js` | URL 校验、安全网段判定、限时限量抓取、正文提取 | 工具 schema、结果格式化 |
| `src/lib/agent-web-tools.js` | `fetch_web_page` 定义与 handler，结果转 `{ ok, text, meta }` | 网络细节 |
| `src/lib/web-source.js` | 内容源快照落盘（复用 web-fetch） | 安全校验（下沉到 web-fetch） |

### 关键契约

```js
// web-fetch.js
assertSafeUrl(rawUrl) -> { ok: true, url: URL } | { ok: false, code, message }
fetchReadablePage(rawUrl, { timeoutMs, maxBytes, maxRedirects, signal })
  -> { ok: true, title, finalUrl, text, truncated, contentType, bytes }
   | { ok: false, code, message }

// code 取值：invalid_url | blocked_target | unsupported_scheme
//           | unsupported_content_type | http_error | timeout
//           | too_many_redirects | network_error
```

handler 返回的 `text` 交给 `agent-tools.js` 的 `truncateText()` 按 `MAX_TOOL_RESULT_CHARS = 24000` 二次截断，避免撑爆上下文预算。

## Performance & Memory

- **启动性能：零影响**。`web-fetch.js` 只被 `agent-web-tools.js` 与 `web-source.js` 在调用时 `require`，无顶层副作用，不参与主进程启动路径。
- **内存**：流式读取 + 2 MB 硬上限，单次抓取峰值内存有界；正文再截到 120k 字符、工具结果截到 24k 字符，两级收敛后进上下文的量可控。
- **并发**：模型单轮可能并发调多个 `fetch_web_page`。既有 `maxToolCalls` 预算已限制单轮工具调用总数，不额外加并发闸；每个调用独立 15s 超时，最坏情况被外层 45s 兜住。

## Risks / Trade-offs

| 风险 | 缓解 |
|---|---|
| DNS rebinding 绕过（D2 已知残余） | 接受；代码注释标注；后续可上 undici 固定 IP dispatcher |
| 正则提取在复杂站点残留噪声 | LLM 容错；保留 D5 的升级路径 |
| 收紧校验导致既有「网页内容源」用例回归 | tasks 中显式跑既有 web-source 相关测试 |
| 模型仍偶发误选飞书工具 | 双保险：工具 description 写死边界（D6）+ 提示词分流（specs/ai-assistant） |
| 站点反爬返回 403 | 设置常规 UA；失败按 `http_error` 如实回报，不重试绕过 |

## Migration

无数据迁移。`web-source.js` 的 `fetchPageSnapshot()` 签名与返回结构保持不变，缓存目录 `userData/web-sources/<hash>/` 布局不变，已添加的网页内容源不受影响。
