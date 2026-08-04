## Purpose

让 Agent 能直接读取用户给出的公开网页链接，把正文作为工具结果回灌给模型用于问答与写作，并在读取过程中强制 URL 安全校验、超时与体积上限，使「基于这个链接写点东西」成为无需用户手工搬运正文的一步操作。

## ADDED Requirements

### Requirement: Web page fetch tool is available to the agent

Agent 工具面 MUST 提供一个抓取公开网页的工具，接受单个 http/https URL，成功时返回网页标题、重定向后的最终 URL 与提取后的正文文本。该工具 MUST 在 Agent 具备工具调用能力的意图层级可用，MUST NOT 依赖用户预先把网页添加为内容源。

#### Scenario: Public article URL is fetched and usable

- **WHEN** 用户在对话中给出一个可公开访问的 http/https 文章链接并要求基于它写作
- **THEN** Agent 调用网页抓取工具，工具结果包含该页标题、最终 URL 与正文文本
- **AND** 助手基于返回正文作答，MUST NOT 要求用户手动复制粘贴正文

#### Scenario: External URL does not fall back to connector search

- **WHEN** 用户给出的链接是非飞书域的外部网页，且飞书连接器同时可用
- **THEN** Agent 使用网页抓取工具处理该链接
- **AND** MUST NOT 以该 URL 或其片段作为飞书文档搜索的查询词来「代替」抓取

#### Scenario: Feishu link still routes to the connector

- **WHEN** 用户给出的链接属于 feishu/larksuite 域且飞书连接器可用
- **THEN** Agent 使用飞书文档读取工具而非网页抓取工具

### Requirement: URL validation blocks unsafe targets

网页抓取 MUST 在发起请求前校验目标地址，并 MUST 拒绝以下目标：非 http/https 协议、环回地址（`localhost`/`127.0.0.0/8`/`::1`）、私有网段（`10.0.0.0/8`、`172.16.0.0/12`、`192.168.0.0/16`、`fc00::/7`）、链路本地地址（`169.254.0.0/16`、`fe80::/10`）以及未指定地址。校验 MUST 基于主机名解析结果判断，MUST NOT 仅凭字符串前缀放行。

#### Scenario: Loopback address is rejected

- **WHEN** 请求抓取 `http://127.0.0.1:8080/admin` 或 `http://localhost:3000`
- **THEN** 工具在发起网络请求前拒绝，返回明确的安全拦截原因
- **AND** MUST NOT 产生任何对该地址的出站请求

#### Scenario: Private network address is rejected

- **WHEN** 请求抓取 `http://192.168.1.1` 或 `http://10.0.0.5/config`
- **THEN** 工具拒绝并说明不允许访问内网地址

#### Scenario: Non-HTTP scheme is rejected

- **WHEN** 请求抓取 `file:///etc/passwd`、`ftp://example.com` 等非 http/https 地址
- **THEN** 工具拒绝并说明仅支持 http/https 链接

#### Scenario: Hostname resolving to a private address is rejected

- **WHEN** 目标主机名解析到私有网段或环回地址
- **THEN** 工具拒绝，MUST NOT 因为主机名看起来是公网域名就放行

### Requirement: Redirects are re-validated

抓取过程中发生的每一次重定向目标 MUST 重新经过与初始 URL 相同的安全校验；跳转链 MUST 有最大跳数限制，超限时 MUST 中止并返回可读原因。

#### Scenario: Redirect into private network is blocked

- **WHEN** 一个公网 URL 302 重定向到 `http://127.0.0.1/secret`
- **THEN** 抓取在跟随该重定向前中止，返回安全拦截原因
- **AND** MUST NOT 返回该内网地址的任何内容

#### Scenario: Redirect loop terminates

- **WHEN** 目标 URL 的重定向次数超过上限
- **THEN** 抓取中止并返回「重定向次数过多」一类可读原因

### Requirement: Fetch is bounded by timeout and size

抓取 MUST 受独立超时约束（不超过 15 秒），并 MUST 对响应体设置字节上限；超出上限时 MUST 截断已读取内容而非继续读取，且 MUST 在结果中标注已截断。

#### Scenario: Slow page times out with a readable reason

- **WHEN** 目标站点在超时窗口内未返回响应
- **THEN** 抓取中止，返回「网页响应超时」一类 C 端可读原因
- **AND** MUST NOT 使整轮 Agent 执行崩溃或长时间挂起

#### Scenario: Oversized page is truncated

- **WHEN** 目标网页正文超过体积上限
- **THEN** 工具返回截断后的正文并标注内容已截断

### Requirement: Only text-like content is returned

抓取 MUST 仅处理 HTML 与纯文本类响应；对二进制或非文本类型（PDF、图片、音视频、压缩包等）MUST 拒绝并说明暂不支持的类型，MUST NOT 返回乱码或二进制片段。

#### Scenario: PDF link is refused with a clear reason

- **WHEN** 目标 URL 返回 `application/pdf`
- **THEN** 工具返回「暂不支持该类型」并指明实际类型，不返回二进制内容

#### Scenario: HTML page yields readable text

- **WHEN** 目标 URL 返回 HTML
- **THEN** 工具返回去除脚本、样式、导航、页头页脚、侧边栏与表单后的正文文本

### Requirement: Failures are reported honestly and actionably

抓取失败 MUST 返回面向 C 端用户可读的原因（超时、HTTP 状态码、安全拦截、类型不支持、网络不可达），并 MUST NOT 伪装成「搜索无结果」或「没有权限」。助手在抓取失败后 MUST 如实说明失败原因，MUST NOT 编造网页内容。

#### Scenario: HTTP 404 is surfaced as such

- **WHEN** 目标 URL 返回 404
- **THEN** 工具结果说明该链接返回 404、页面可能已删除或地址有误
- **AND** 助手 MUST NOT 基于臆测内容继续写作

#### Scenario: No fabrication after failure

- **WHEN** 抓取因任意原因失败
- **THEN** 助手明确告知未能读取该链接及原因，MUST NOT 输出声称来自该网页的内容
