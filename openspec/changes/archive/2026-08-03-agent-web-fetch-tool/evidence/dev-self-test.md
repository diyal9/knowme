# 开发自测：agent-web-fetch-tool

日期：2026-08-03 · 环境：Windows 10 · Node v24.14.0（测试）/ Electron 31（运行）

## 硬门禁

| 项 | 命令 | 结果 |
|---|---|---|
| 单元/集成测试 | `npm test` | **PASS** — 798 pass / 0 fail / 135 suites |
| Lint | `npm run lint` | **PASS** — `lint ok` + `script-scope ok` |

新增用例：`tests/web-fetch.test.js` 29 条（单独跑 `node --test tests/web-fetch.test.js` → 29 pass / 0 fail），另在 `tests/agent-tools.test.js`、`tests/ai-assistant-context.test.js` 各补断言，并修复 `tests/sources.test.js` 的失真 mock。

## 真实网页抓取（本 Story 的原始故障链接）

```
node -e "require('./src/lib/web-fetch').fetchReadablePage('https://www.anthropic.com/engineering/harness-design-long-running-apps')"
```

| 指标 | 值 |
|---|---|
| 耗时 | 714 ms |
| ok | true |
| title | `Harness design for long-running application development \ Anthropic` |
| 响应字节 | 248479 |
| 提取正文字符 | 33393 |
| 实体残留 | 无（`&#x..;` / `&..;` 匹配结果为空数组） |

正文首段抽样，确认是文章实质内容而非导航噪声：

```
# Harness design for long-running application development
Published Mar 24, 2026
Harness design is key to performance at the frontier of agentic coding. Here's how we pushed
Claude further in frontend design and long-running autonomous software engineering.
Written by Prithvi Rajasekaran, a member of our Labs team.
```

### 自测中发现并修复的缺陷

首轮真实抓取输出为 `Here&#x27;s how we pushed`——`decodeEntities()` 只处理了十进制字符引用 `&#39;`，漏了十六进制 `&#x27;`。已补 `codePointOrSpace()` 统一处理两种形式，并新增用例 `decodes hex character references`（覆盖 `&#x27;` `&#x2014;` `&#x4E2D;`）。修复后实体残留为空。

## 工具面端到端接线

通过 `buildConnectorToolSurface(userData, { extraTools: buildWebTools() })` 走完整执行器：

```
registered tools: ["search_knowledge","fetch_web_page"]
isAllowedTool(fetch_web_page): true

--- 正常抓取 ---
ok: true | toolName: fetch_web_page
argsSummary: www.anthropic.com/engineering/harness-design-long-running-apps
truncated: true | text chars: 24000   ← 命中 MAX_TOOL_RESULT_CHARS 二级截断，符合设计
preview: 标题：Harness design for long-running application development \ Anthropic
         来源：https://www.anthropic.com/engineering/harness-design-long-running-apps

--- SSRF 拦截 ---
ok: false | code: blocked_target
text: 未能读取该网页（http://127.0.0.1:8080/admin）：出于安全考虑，不能访问本机或内网地址（127.0.0.1）。
```

## 应用启动冒烟

```
powershell 清理残留 electron → killed 80312, 84880
npm start → 2026-08-03T12:41:16.389Z INFO system/app-start KnowMe 主进程启动
Get-Process → 14188 electron  MainWindowTitle=KnowMe
```

主进程启动无 uncaught error，窗口正常。

## 未由本次自测覆盖的部分

**实时会话中模型是否真的选中 `fetch_web_page`**，取决于运行时 LLM 与用户的模型配置，无法在无 API Key 的自测环境中确定性验证。已验证的是：工具确实出现在送模工具列表里、描述已写死与飞书工具的边界、提示词已给出分流规则、执行链路可跑通。该项留给制作人在应用内实测确认（见 `acceptance.md`）。
