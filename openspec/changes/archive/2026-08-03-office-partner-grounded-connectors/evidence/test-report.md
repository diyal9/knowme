# 测试报告: office-partner-grounded-connectors

## 环境

- 日期：2026-08-03
- Change：`office-partner-grounded-connectors`
- 执行：测试角色（依据 qa-plan + dev-self-test + code-review 文书验收）
- 说明：**未执行独立 Electron 实机 UI 截图**；冒烟项依据自动化门禁、定向单测与开发自测签字通过，**未编造 screenshots**

## 门禁

| 项 | 结果 |
|----|------|
| [硬] `npm test` | **PASS**（739/739，2026-08-03） |
| [硬] `npm run lint` | **PASS** |
| [软] qa-plan Smoke Scope | 已对照执行（见下表） |
| [软] code-review | 已完成（PASS） |

## 定向单测

| 套件 | 结果 |
|------|------|
| `tests/connectors.test.js` + `tests/feishu-grounding.test.js` | PASS |
| `tests/sources.test.js` + `tests/writing-workflow.test.js` | PASS |
| `tests/feishu-cli.test.js` + `tests/agent-tool-failure-hint.test.js` + `tests/agent-recovery.test.js` | PASS |

## Smoke Scope（qa-plan）

| # | 用例 | 结果 | 依据 |
|---|------|------|------|
| 1 | 飞书连接器关闭时，提示指向「启用连接器」 | PASS | `feishu-grounding.test.js` 门控分支 + 制作人验收 |
| 2 | 飞书已启用但 user 未授权，提示指向 user 授权 | PASS | grounding auth 分支单测 + 验收 |
| 3 | 飞书已授权但 allowlist 未放行，提示指向 allowlist 缺口 | PASS | `projectedAllowlist` / allowlist 提示单测 |
| 4 | 飞书文档链接先读正文再润色，不直接编造 | PASS | grounding 反编造规则 + read 链路单测 |
| 5 | 可新增并浏览 GitHub 仓库内容源，读取文本文件 | PASS | `sources.test.js` github 记录 + clone 路径；UI 待实机 ADVISORY |
| 6 | 可新增并浏览网页内容源，读取抽取正文 | PASS | `sources.test.js` web 记录 + `web-source` HTML 抽取单测 |
| 7 | 润色改写利用知识库/RAG/active source 增强上下文 | PASS | `writing-workflow.test.js` polish_rewrite + retrieval 提示 |
| 8 | 长文仍可进入右侧审阅并生成飞书文档草稿 | PASS | `writing-workflow.test.js` review artifact 用例；飞书草稿链路回归 |

## Regression（qa-plan）

| 项 | 结果 | 备注 |
|----|------|------|
| 现有本地目录与 GitLab 内容源不受影响 | PASS | `sources.test.js` 既有 local/gitlab 用例全绿 |
| 现有飞书 doc_kb_suggest / search_docs / read_doc 链路不回退 | PASS | `feishu-grounding.test.js` 回归用例 |
| 现有远程 RAG / MCP 连接器投影仍可工作 | PASS | connectors 单测未破坏投影路径 |
| 普通短文润色不被强制提升为重型多源检索 | PASS | writing-workflow 任务分类逻辑 |

## 反模式发现

| 级别 | 项 | 结果 |
|------|-----|------|
| — | 不把「工具未授权」与「缺少正文证据」混成同一句 | PASS（AP 单测 + 验收） |
| — | 不把网页/GitHub 检索片段直接写成已确认事实 | PASS（grounding 阻断 + 写作 guidance） |
| — | 润色后不因去 AI 味丢失术语/边界/出处 | PASS（humanizer guidance 单测） |
| ADVISORY | 设置页 GitHub/网页添加与同步的实机 UI | 未截图；代码与单测覆盖，无 BLOCKING 风险 |

## 结论

- [x] **通过，可 story-done**
- [ ] 不通过，打回开发

证据目录：`evidence/`（本报告 + `dev-self-test.md`；**无 screenshots/**，未编造截图）
