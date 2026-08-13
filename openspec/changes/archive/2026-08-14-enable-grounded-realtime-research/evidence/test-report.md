# 测试报告: enable-grounded-realtime-research

- 测试人：Tester（正式 QA）
- 日期：2026-08-07
- 前置：开发自测 PASS + 制作人验收 PASS（见 `acceptance.md`、`evidence/producer-acceptance.md`）

## 门禁

| 级别 | 检查项 | 结果 | 证据 |
|------|--------|------|------|
| 硬 | `npm test` | PASS | `node .cursor/scripts/harness.js gate --json` |
| 硬 | `npm run lint` | PASS | 同上 |
| 软 | qa-plan Smoke Scope | 已执行 | 本文 Smoke 节 |
| 软 | code-review.md | 已完成 | `code-review.md` |
| 软 | OpenSpec strict | PASS | `openspec validate enable-grounded-realtime-research --strict` |

## 测试边界说明

| 维度 | 方式 | 验证对象 | 本轮 |
|------|------|----------|------|
| **Electron fixture（成功路径）** | `KNOWME_AGENT_OUTPUT_FIXTURE=1` + IPC 注入 | Renderer/时间线/来源链接/双时间戳/无单项选择 | ✅ 8/8 |
| **Electron fixture（失败路径）** | 同上，注入 `tool.failed` + 诚实降级答案 | provider 失败 UI、不编造资讯 | ✅ 8/8（QA 新增） |
| **实网探针** | 直接调用 `webSearch.searchWeb('今天 AI 资讯')` | Bing RSS provider 开箱可用、URL 解包 | ✅ 3 条结果 |
| **单元/集成 mock** | `node --test` 聚焦套件 | 路由、OutputGate、SSRF、契约、错误码 | ✅ 151 项聚焦通过 |
| **真实 LLM E2E** | 需用户配置模型 + 实网多轮 | 模型是否少读原文、多轮工具策略 | ⚠️ 未在本轮执行（见 ADVISORY） |

**重要**：fixture 截图中的「示例模型更新」等为确定性占位文本，**不得**表述为真实检索结果。

## Smoke 结果

| 用例 | 结果 | 证据 |
|------|------|------|
| 「今天 AI 资讯」直接走搜索→读取→核验，无单项飞书选择 | PASS | `realtime-research-electron-smoke.json`（8/8）；`no-single-feishu-choice` |
| 答案含可追溯 URL，区分发布时间/检索时间 | PASS | smoke `source-links` count=2；`publication-and-retrieval-time`；截图 `realtime-research-timeline.png` |
| provider 失败返回真实原因、不编造资讯 | PASS | 新增 `realtime-research-failure-fixture-smoke.json`（8/8）；截图 `realtime-research-search-failure.png` |
| 普通问候轻量、URL/飞书路由正确 | PASS | `research-routing.test.js`（你好→chat）；`ai-assistant-context.test.js`（fetch_web_page / feishu read_doc 路由） |

## Regression 结果

| 范围 | 结果 | 命令/文件 |
|------|------|-----------|
| Tool Registry v1/legacy 契约 | PASS | `tests/tool-contract-registry.test.js`（16）；`tests/harden-tool-surface.test.js`（52） |
| Agent v2 输出/时间线/OutputGate | PASS | `tests/agent-run-executor-grounding.test.js`（7）；Electron fixture 冒烟 |
| 连接器/MCP 投影 | PASS | `tests/connectors.test.js`（12） |
| SSRF/重定向/超时/体积 | PASS | `tests/web-fetch.test.js`（29）；`tests/web-search.test.js` 私网过滤与去重 |

## 聚焦测试执行摘要

```
node .cursor/scripts/harness.js gate --json          → ok
node --test tests/research-routing.test.js ...       → 54/54 pass
node --test tests/tool-contract-registry.test.js ... → 68/68 pass
node --test tests/web-fetch.test.js                  → 29/29 pass
node evidence/realtime-research-electron-smoke.js    → 8/8 pass, console error 0
node evidence/realtime-research-failure-fixture-smoke.js → 8/8 pass, console error 0
实网探针 → evidence/realtime-research-network-probe.json（bing-rss, 3 条, firstUrl 已解包）
```

## 反模式发现

### BLOCKING

无。

### ADVISORY

1. **真实 LLM 多轮 E2E 未覆盖**  
   - **反模式风险**：模型可能只读 RSS 摘要、跳过 `fetch_web_page`，或失败时自行编造。  
   - **现状**：OutputGate 硬门禁可阻止无搜索证据的时效结论（单测已验）；但「少读原文」仅为提示词/回归要求，非硬计数。  
   - **建议**：上线后抽测真实模型配置，或纳入 Agent eval 回归。

2. **企业来源融合路径未在已启用飞书环境实测**  
   - **反模式风险**：混合公开/内部范围时仍可能出现不当选择卡。  
   - **现状**：默认公开资讯路径与 disabled connector 逻辑由单测覆盖；未在飞书已授权桌面环境做手工走查。  
   - **建议**：Story 归档前或下一迭代在启用飞书连接器的环境补测「查最新项目动态」范围选择。

3. **RSS provider 长期 SLA**  
   - **反模式风险**：Bing RSS 限流/变更导致实网间歇失败。  
   - **现状**：QA 实网探针单次 PASS；失败降级 UI 与稳定错误码已由 mock + fixture 验证。  
   - **建议**：保留 provider 可替换能力并监控失败率。

4. **fixture 失败路径答案文本为注入占位**  
   - 失败 fixture 中的降级文案由测试脚本注入，代表 Output Protocol 期望形态；真实 LLM 措辞可能略有不同，但须满足 spec「说明真实失败原因、不输出今日资讯」。

## 结论

- [x] **通过，可 `/story-done`**
- [ ] 不通过，打回开发

**正式 QA 结论：PASS**

核心 Smoke、Regression 与反模式清单均已覆盖；无 BLOCKING 缺陷。已知边界（真实 LLM E2E、企业融合手工路径）已记为 ADVISORY，不阻断归档。

证据目录：`evidence/screenshots/`  
- `realtime-research-timeline.png`（成功路径）  
- `realtime-research-search-failure.png`（失败路径，QA 新增）
