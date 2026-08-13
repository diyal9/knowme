# 制作人体验验收报告

- Change：`enable-grounded-realtime-research`
- 验收人：制作人
- 日期：2026-08-07
- 结论：**PASS**

## 验收依据

| 来源 | 路径 | 用途 |
|------|------|------|
| 开发自测 | `evidence/dev-self-test.md` | 自动化、实网探针、冒烟摘要 |
| Electron 冒烟 JSON | `evidence/realtime-research-electron-smoke.json` | 8/8 检查项、0 console error |
| 时间线截图 | `evidence/screenshots/realtime-research-timeline.png` | C 端视觉与信息架构走查 |
| 规格 | `proposal.md`、`design.md`、`specs/`、`qa-plan.md` | 行为与体验标准对照 |
| 代码审查 | `code-review.md` | 架构边界与风险确认 |

开发门禁：`npm test` 1385/1385、lint PASS、OpenSpec strict PASS。

## 五维体验走查

### 1. 真实用户价值

| 检查项 | 结果 | 证据 |
|--------|------|------|
| 「今天 AI 资讯」不再误判为闲聊 | PASS | 意图/路由单测；fixture 用例输入同类问句 |
| 不再出现单项「飞书知识库」选择卡 | PASS | smoke `no-single-feishu-choice`；截图无 choice 卡 |
| 开箱可用、无需 API Key | PASS | 默认 Bing RSS provider；实网探针 `今天 AI 资讯` 返回 3 条 |
| 直接执行「搜索 → 读取 → 核验」闭环 | PASS | 时间线：网络搜索完成 → 网页读取完成 → 核验依据 |
| 答案可行动（摘要 + 快捷续问） | PASS | 截图含编号摘要与「继续追问细节 / 整理成行动项 / 生成同步消息」 |

### 2. 认知负担

| 检查项 | 结果 | 证据 |
|--------|------|------|
| 执行进度可理解、可折叠 | PASS | 「执行进度」折叠区 + 逐步打勾 |
| 主答案与工具轨分离 | PASS | 摘要在上、时间线在下，不抢占阅读焦点 |
| 无多余来源选择打断 | PASS | 默认公开资讯路径零选择卡 |
| 术语产品化（「搜索网络」「读取网页」） | PASS | smoke 事件 title 与截图一致 |
| 未知信息明确标注 | PASS | 第二条「发布时间：未知」+ 脚注说明无法验证 |

### 3. 来源可信度

| 检查项 | 结果 | 证据 |
|--------|------|------|
| 答案含可追溯 URL | PASS | smoke `source-links` count=2 |
| 区分发布时间 vs 检索时间 | PASS | smoke `publication-and-retrieval-time`；截图脚注「本次检索时间：… UTC」 |
| 核验步骤可见 | PASS | 时间线「核验依据 — 已保留来源链接、发布时间与检索时间」 |
| 搜索摘要 ≠ 原文结论 | PASS | design D2/D6；dev-self-test 说明摘要为发现线索 |
| 硬门禁：无搜索证据不输出时效事实 | PASS | task frame `requiredTools: ['search_web']` + OutputGate（code-review） |

### 4. 失败诚实降级

| 检查项 | 结果 | 证据 |
|--------|------|------|
| provider 失败返回真实原因、不编造 | PASS（逻辑） | 单测 mock 超时/HTTP/无结果/恶意 URL；design 稳定错误码 |
| 发布时间无法验证时标「未知」 | PASS（UI） | fixture 答案第二条 + 脚注 |
| 未启用来源不出现在计划/选择中 | PASS（逻辑） | spec「Connector is disabled」；路由从 Registry 发现 |
| provider 失败 UI 走查 | **未在本轮 fixture 覆盖** | 移交 QA Smoke Scope 第 3 项 |

### 5. 商业体验

| 检查项 | 结果 | 证据 |
|--------|------|------|
| 从「内部知识助手」扩展到「日常工作伙伴」 | PASS | proposal 商业化价值；核心场景直接交付 |
| 来源可追溯支撑专业信任 | PASS | URL + 双时间戳 + 核验轨 |
| 普通问候保持轻量 | PASS（逻辑） | spec「Greeting remains lightweight」；单测负例 |
| 视觉与现有 Agent 一致 | PASS | 截图：时间线、回答轨、模型选择器风格一致 |
| 无新增打扰弹窗或第二套研究 UI | PASS | design Non-Goals；复用 suggestion/choice 协议 |

## BLOCKING 发现

无。

## ADVISORY（移交测试）

1. **搜索 provider 失败 UI**：制作人验收基于单测与设计，未跑失败态 Electron 走查；QA 须按 qa-plan Smoke Scope 第 3 项验证。
2. **真实 LLM 是否少读原文**：fixture 不覆盖模型行为；依赖 Agent eval / grounding 回归；若线上仍常跳过 `fetch_web_page`，后续可考虑硬门禁（design 已记录 trade-off）。
3. **企业来源融合路径**：默认公开资讯路径已验；混合/内部范围追问需 QA 在已启用飞书/MCP 环境下补测。
4. **RSS provider SLA**：实网探针单次 PASS 不代表长期稳定；需监控限流/变更并保留 provider 可替换能力。

## Fixture 与真实 LLM E2E 边界

| 维度 | Electron fixture 冒烟 | 实网探针 / 单测 | 真实 LLM E2E |
|------|----------------------|-----------------|--------------|
| 环境变量 | `KNOWME_AGENT_OUTPUT_FIXTURE=1` | 无 fixture | 用户配置模型 + 实网 |
| 验证对象 | Renderer/IPC/Output Protocol 时间线与答案渲染 | `search_web` provider、意图路由、OutputGate | 模型工具调用策略与多轮对话 |
| 工具事件 | 脚本注入确定性 `search_web` / `fetch_web_page` / stage 事件 | mock 或单次 RSS 请求 | 模型自主选择与组合 |
| 答案内容 | 固定 fixture 文本（含示例 URL） | N/A | 依赖模型摘要质量 |
| 制作人本轮覆盖 | **是**（UI/信息架构/无单项选择） | **是**（开箱搜索可用） | **否**（移交 QA + 可选手工抽测） |

说明：fixture 模式 `mode: "electron-fixture"`（见 `realtime-research-electron-smoke.json`），**不得**将截图中的「示例模型更新」等内容表述为真实检索结果；真实 provider 能力由 dev-self-test 实网探针独立验证。

## 放行测试

制作人体验验收 **PASS**，可接入正式 QA，按 `qa-plan.md` 执行 Regression Scope 与 Anti-pattern Checks。
