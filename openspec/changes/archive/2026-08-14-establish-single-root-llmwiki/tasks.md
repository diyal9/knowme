## 1. Root Wiki Harness

- [x] 1.1 Implement a pure Node LLM Wiki Harness for idempotent root initialization, manifest/version checks and machine-readable health reports.
- [x] 1.2 Implement confined raw read/write operations with extension, size, traversal, symlink, expected-hash and atomic-write enforcement.
- [x] 1.3 Add a CLI/package script for running the Harness and unit tests for healthy, invalid, escape and stale-write scenarios.

## 2. Knowledge Runtime Integration

- [x] 2.1 Integrate Harness initialization with knowledge-os and route new ingest content into `raw/` while preserving legacy content readability.
- [x] 2.2 Add knowledge-os raw read/save orchestration that refreshes the index and cache only after successful mutations.
- [x] 2.3 Expose narrow main-process/preload IPC contracts for Harness status and raw save without renderer filesystem access.

## 3. User Knowledge Experience

- [x] 3.1 Collapse the default knowledge navigation to “我的知识”“待我确认”“来源” and remove internal architecture terms from the primary flow.
- [x] 3.2 Add home search, add-material actions, recent资料 and pending-review status to “我的知识”.
- [x] 3.3 Add visual raw Markdown/text editing with dirty state, save feedback and stale-content conflict handling.
- [x] 3.4 Keep Fabric, governance, remote providers and legacy files available through compatible non-default paths.

## 4. Verification and Evidence

- [x] 4.1 Update knowledge runtime/UI contract tests and run targeted tests.
- [x] 4.2 Run `npm test`, `npm run lint`, strict OpenSpec validation and the LLM Wiki Harness.
- [x] 4.3 Record development self-test evidence and leave producer acceptance/QA artifacts ready for the next gate.

## 5. Root Query Service and Understandable Operations

- [x] 5.1 Add a reusable root LLM Wiki service exposing query, ingest and lint with stable operation and retrieval-status envelopes.
- [x] 5.2 Route root query through the existing qmd adapter, correct the qmd CLI contract, synchronize a KnowMe-scoped collection and preserve observable lexical fallback.
- [x] 5.3 Make UI, IPC and Agent knowledge search consume the same root service while retaining compatibility aliases.
- [x] 5.4 Restore the left rail product entry to “知识网” and show a user-readable root structure before implementation details on “我的知识”.
- [x] 5.5 Add runtime, interface and UI contract tests; rerun lint, OpenSpec validation, Harness and Electron smoke verification.

## 6. Real Knowledge Index Home

- [x] 6.1 Replace the process-flow dashboard with a real root index tree built from indexed paths, while translating only root contract directory names.
- [x] 6.2 Make directories expandable, show descendant counts, preserve empty `raw`/`concepts` structure and open entries in the existing reader/editor.
- [x] 6.3 Keep search/add actions compact, move pending/recent/health information to supporting context, and verify the result with contract tests and Electron evidence.

## 7. Empty-Library First Touch

- [x] 7.1 在默认知识首页对空库分支：渲染以“添加第一份资料”为唯一主行动的居中欢迎引导，去除运维操作台与空目录树，文案不含实现术语。
- [x] 7.2 支持内联投喂（粘贴/输入文字直接添加），并抽出可复用的资料保存逻辑供欢迎引导与添加弹窗共用。
- [x] 7.3 首份保存成功后就地提供“让 AI 整理 / 以后再说”闭环，接入现有整理与“待我确认”流程；“连接来源”降为弱次级入口。
- [x] 7.4 补充空态样式与首触/闭环的契约测试，rerun `npm test` 与 `npm run lint` 至无报错。

## 8. Populated Home: Structure-First

- [x] 8.1 将有资料常态首页从 Query/Ingest/Lint 运维台改为真实索引树 + 醒目搜索，待确认做横幅、最近/整理/体检降为紧凑辅助。
- [x] 8.2 首页文案与操作名去实现术语（不出现 LLM Wiki/Query/Ingest/Lint 作为标题或操作名）。
- [x] 8.3 侧栏增加弱次级入口“知识关联”，按需打开既有 Fabric 关系视图，让“网”在有料后可感知（不作为默认一级页面）。
- [x] 8.4 更新受影响契约测试并 rerun `npm test` / `npm run lint` 至无报错。
