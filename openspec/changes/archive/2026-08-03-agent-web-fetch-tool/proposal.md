# Proposal: agent-web-fetch-tool

## Why

用户在办公助手里粘贴一条公开网页链接（`https://www.anthropic.com/engineering/harness-design-long-running-apps`）并要求「基于这个链接写一篇文章」，助手却去调用了飞书文档搜索，返回空后反过来要求用户「提供飞书文档 token 或手动复制粘贴文章内容」。对 C 端用户而言，这是一次彻底的能力失败：**最普通的「读一下这个网页」都做不到，还把锅甩回给用户**。

根因不是路由错误，而是**工具面缺失**：

1. **没有任何抓取网页的 Agent 工具**。全库工具清单里最接近「读外部内容」的只有 `feishu.search_docs` / `feishu.read_doc`，后者描述含 "token or URL"，于是模型在 `tool_choice: 'auto'`（`src/main.js:3980`）下只能矮子里拔将军。
2. **提示词把模型往飞书推**。`src/lib/ai-assistant-context.js:18` 要求「涉及飞书文档、知识库或**外部资料**时 MUST 先调用工具」，举例又只给了飞书工具，缺少「外部 HTTP 链接该用什么工具」的分流指引。
3. **抓取能力已存在却没接进 Agent**。`src/lib/web-source.js` 的 `fetchPageSnapshot()` 早已能抓网页，但只挂在「设置 → 内容源 → 添加网页资料」这条手动路径上。用户想读外链，必须先手动建内容源、设为活跃，再让 Agent 用 `read_file` 读缓存，绕三道弯。
4. **即便模型选对了 `feishu.read_doc` 也会被拒**。`src/lib/connectors/feishu-toolkit.js:37` 只放行 feishu/larksuite 域，非飞书链接直接 `invalid_args`。

「读链接 → 基于它写作」是 AI 工作伙伴的**基础期待**，也是 KnowMe「知识工作台」定位的底线能力。缺这一环，写作、调研、竞品分析等主线场景全部断链，用户会直接判定产品不可用。

## 目标用户

- 用飞书/微信收到公开文章链接，想让助手基于它写 TechTalk 稿、周报、总结的办公用户
- 做调研或竞品分析、需要助手直接消化多个网页来源的知识工作者
- 已配置飞书连接器、但日常大量资料来自公网而非飞书内网的用户

## What Changes

- **新增 Agent 工具 `fetch_web_page`**：接受 http/https URL，返回网页标题、最终 URL 与提取后的正文文本，供模型直接引用与写作。工具对所有意图层级（含 `chat` 之外的 `assist`/`retrieval`）在联网可用时投影。
- **SSRF 防护**：MUST 拒绝非 http/https 协议、localhost/环回、私有网段（10/172.16-31/192.168/169.254/`::1`/`fc00::/7` 等）、以及重定向后落入上述地址的请求；域名解析后校验，MUST NOT 仅凭字符串前缀放行。
- **超时与体积上限**：抓取 MUST 有独立超时（15s）与响应体上限，超限截断而非无限读取；非 HTML/文本类型（如 PDF、图片）MUST 明确拒绝并说明原因，MUST NOT 返回乱码。
- **正文提取加固**：在现有 `stripHtml()` 基础上剔除 `nav`/`header`/`footer`/`aside`/`form`/注释等噪声，保留标题层级与列表结构，不引入第三方依赖。
- **提示词分流**：`ai-assistant-context.js` MUST 明确「外部 http(s) 链接 → `fetch_web_page`；飞书/larksuite 链接 → `feishu.read_doc`」，并禁止在具备 `fetch_web_page` 时回答「无法访问外部网页」或要求用户手动粘贴正文。
- **失败可读**：抓取失败（超时/404/被拦截/非文本）MUST 返回 C 端可读原因与可行动建议，MUST NOT 抛系统级错误或伪装成「搜索无结果」。

## Capabilities

### New Capabilities

- `agent-web-fetch`: Agent 抓取公开网页并把正文作为工具结果回灌给模型的能力，含 URL 校验、SSRF 防护、超时与体积上限、正文提取与失败反馈。

### Modified Capabilities

- `ai-assistant`: 系统提示词新增「外部链接与飞书链接的工具分流规则」，并禁止在具备抓取工具时声称无法访问外部网页。

## Non-goals

- 不引入 readability / turndown / cheerio / jsdom 等第三方依赖（保持零新增依赖）
- 不做需要登录、付费墙或 JS 渲染的页面抓取（不启动无头浏览器）
- 不做网页搜索（本变更只解决「已给定 URL」，不解决「帮我搜一下」）
- 不改动「设置 → 内容源 → 添加网页资料」的既有手动流程与缓存目录结构
- 不改动飞书连接器的域名校验策略

## 验收标准

- 粘贴 `https://www.anthropic.com/engineering/harness-design-long-running-apps` 并要求写文章时，助手 MUST 调用 `fetch_web_page` 而非 `feishu.search_docs`，且能产出引用了原文实质内容的稿件
- 助手 MUST NOT 再出现「检索结果为空 / 请提供飞书文档 token / 请手动复制粘贴」这类把责任推回用户的回复
- 抓取 `http://127.0.0.1:8080`、`http://192.168.1.1`、`file:///etc/passwd` 等 MUST 被拒绝，返回明确的安全拦截原因
- 重定向到私有网段的 URL MUST 在重定向后被拦截
- 抓取超时 15s 内返回，失败原因对 C 端可读
- 飞书文档链接仍走 `feishu.read_doc`，不被 `fetch_web_page` 抢走
- `npm test` / `npm run lint` 全绿，无回归

## Impact

| 文件 | 变更 |
|---|---|
| `src/lib/web-fetch.js` | **新增**：URL 安全校验、带超时与体积上限的抓取、正文提取 |
| `src/lib/web-source.js` | 复用新模块的提取与校验，保持既有 `fetchPageSnapshot()` 契约 |
| `src/lib/agent-web-tools.js` | **新增**：`fetch_web_page` 工具定义与 handler |
| `src/lib/agent-tools.js` | `validateToolCall()` 增加 URL 校验分支；`summarizeToolArgs()` 增加 UI 摘要 |
| `src/main.js` | 在 `mergeExtraTools()` 处注册工具；时间线标题映射 |
| `src/lib/ai-assistant-context.js` | 提示词分流规则 |
| `src/workspace-agent.js` | `toolTimelineTitle()` 增加「读取网页」标题 |
| `tests/` | 新增 `web-fetch.test.js`；扩充 `agent-tools.test.js` |

依赖：无新增。网络出口：新增对任意公网 http/https 域的出站请求（受 SSRF 白/黑名单约束）。
