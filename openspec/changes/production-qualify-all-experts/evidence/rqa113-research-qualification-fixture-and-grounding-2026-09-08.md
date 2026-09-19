# RQA113 — research qualification fixture and generic web grounding

时间：2026-09-08

## 目的

补齐研究分析师的通用运行时验证，并修复回归中暴露的两个平台问题：

1. 质量复核的第二次模型调用必须遵守严格 JSON 合同，不能被测试夹具误判成新的研究请求。
2. “已读取官方页面”应由通用 `fetch_web_page` 成功回执支撑，不能只识别 Feishu 读取工具。
3. “不要联网”不能因“联网”子串而误命中公开网络路线。

## 结果

- `RQA74` 本地同构 LLM + web fixture：`4/4` lifecycle pass，`0` runtime failure，`0` needs_input，覆盖：
  - RA05 提供材料且明确不联网：命中 `provided-material`，无网络调用；
  - RA06 取消后重试：真实经历 cancel → retry，成功调用 `search_web`、`fetch_web_page`，并保留 3 条证据；
  - RA07 退回修改：真实经历 changes requested → revision，生成新版本并链接旧版本；
  - RA08 验收后重开：真实经历 completed → reopen → revision，保留版本链。
- `agent-grounding-runtime` 及相关回归：`57/57` pass。
- `expert-execution-profile`：`13/13` pass，新增负向路由回归。
- 本轮夹具使用 `example.com` 映射到本地服务器，仅证明平台编排、工具收据、证据绑定和生命周期闭环；不证明真实联网 Provider 可用，也不证明研究结论的专业质量。
- `professionallyQualified=0` 仍保持，必须由独立评审确认断言质量后才能提升。

## 修改

- `src/lib/agent-grounding-ledger.ts`：将 `fetch_web_page` 纳入通用页面读取声明的受支持工具集合。
- `src/catalog/experts/research-analyst/capability.manifest.json`：为公开网络路线增加负向条件，避免“不要联网”误命中；同时收紧提供材料路线的外部检索否定词为完整短语。
- `scripts/qualification-research-fixture-server.js`：增加质量复核 JSON 分支、按声明路由决定是否联网的确定性行为。
- `tests/agent-grounding-runtime.test.js`、`tests/expert-execution-profile.test.js`：增加对应回归。

## 结论

研究分析师的通用运行时闭环已有可重复的本地证据，但仍不能宣称生产级合格。真实公开网络 Provider、远程授权、独立专业评审仍是当前目标的未完成项。
