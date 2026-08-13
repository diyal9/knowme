## 1. Grounding Runtime 核心模块

- [x] 1.1 新增 `agent-grounding-runtime` 模块：ReferenceState、EvidenceLedger、ToolLedger 数据结构与序列化
- [x] 1.2 实现 pendingSelection/option 绑定 API（含纯数字「2」1-based 绑定）与 task 切换 stale 清理
- [x] 1.3 实现 EvidenceLedger 追加：ok/fail/empty/truncated 与 provenance/digest
- [x] 1.4 实现 ClaimVerifier L0/L1（执行态、外部事实、requiredTools/Evidence 规则）
- [x] 1.5 实现 OutputGate：fail-closed、单次 regen 或 honest refusal 策略
- [x] 1.6 为 grounding runtime 添加单元测试（绑定、truncated、fail-closed、stale ref）

## 2. Executor 与 Ports 集成

- [x] 2.1 扩展 RunPorts：referenceState、evidenceLedger、toolLedger 读写
- [x] 2.2 在 `AgentRunExecutor` 增加 GROUND / VERIFY_CLAIMS（或 VERIFY 子阶段）并写入 runPhases
- [x] 2.3 最终文本 persist 前必须经过 OutputGate；emit grounding-status 元数据
- [x] 2.4 添加 feature flag `KNOWME_GROUNDING_RUNTIME=legacy|runtime` 与 legacy adapter 桥接
- [x] 2.5 扩展 executor 单测：verifier fail 阻断、truncated 拒答、requiredTools 未满足

## 3. Skill / Workflow 契约

- [x] 3.1 扩展 SKILL.md / Workflow manifest schema：`requiredTools`、`requiredEvidence`、`completionConditions`
- [x] 3.2 解析并写入 ReferenceState.taskFrame；缺字段保持 legacy 行为
- [x] 3.3 Workflow 候选输出改为写入 pendingSelection（非仅 Markdown 提示）
- [x] 3.4 添加 manifest 校验与单测（合法/非法 evidence 声明）

## 4. Connector 与飞书事故路径

- [x] 4.1 飞书会议候选：写入 ReferenceState options（minute_token/url/label）
- [x] 4.2 结构化选择 → deterministic `feishu.meeting_read` intent（禁止 read_doc 误路由）
- [x] 4.3 meeting_read 结果标记 empty/truncated 结构化字段供 ledger 消费
- [x] 4.4 迁移/薄化 `feishu-grounding.js`：规则迁入 runtime，保留 scope/auth adapter
- [x] 4.5 迁移 `conversation-grounding.js` 中与选择/证据相关逻辑到 runtime adapter

## 5. UI 诚实状态与 Provenance

- [x] 5.1 IPC/stream 增加 grounding-status（verified/pending/blocked/failed、sources、claims）
- [x] 5.2 时间线展示 ok/fail/truncated/blocked 与「查看来源」（符合增量 DOM 更新 spec）
- [x] 5.3 助手气泡：无 ledger 禁止「已读取」成功徽章；blocked 展示下一步
- [x] 5.4 候选 UI 点选/序号与 ReferenceState 绑定事件打通

## 6. Conversation Eval Harness

- [x] 6.1 新建 `tests/fixtures/agent-conversation-eval/` 目录结构与 schema 文档
- [x] 6.2 实现 sessionScript 多轮注入与 ReferenceState 种子 replay
- [x] 6.3 实现分层 scorer（toolChoice、factFaithfulness、refusalWhenUnmet 等）与 baseline v1
- [x] 6.4 添加事故 fixture：`feishu-meeting-pick-2-no-tool`（必须 fail）与 happy path
- [x] 6.5 添加边界 fixtures：numeric deixis、task switch stale、tool budget、thin-body title-only、skill requiredTools
- [x] 6.6 扩展 `tests/agent-eval-harness.js`：dimensions、threshold、JSON+Markdown 报告
- [x] 6.7 添加 `scripts/agent-eval.js` CLI 与 `npm run test:agent-conversation-eval`（hard suite 纳入 `npm test`）
- [x] 6.8 可选：脱敏 replay adapter 接口 stub（不阻塞 hard gate）

## 7. Harness Gate 与证据

- [x] 7.1 跑通 `npm test` + `npm run lint`；conversation hard suite 全绿
- [x] 7.2 写入 `evidence/dev-self-test.md`（命令、关键 scenario 结果摘要）
- [x] 7.3 写入 `evidence/eval-report.json` 与 `evidence/eval-report.md`（baseline v1）
- [x] 7.4 评估 `.cursor/scripts/harness.js` gate 是否读取 eval-report 阈值（可选硬/软项）
- [x] 7.5 本地 Electron 冒烟：会议候选→选 2→无工具不得出现编造总结；happy path 展示来源（`grounding-meeting-e2e.json`：eval executor + feishu readonly probe + Electron GroundingUI 截图）

## 8. 文档与 OpenSpec 同步

- [x] 8.1 实现完成后核对 delta specs 与行为一致；更新 tasks 勾选
- [x] 8.2 准备 `evidence/code-review.md` 与测试阶段 `evidence/test-report.md` 占位说明
- [x] 8.3 制作人验收前自测无控制台报错；提交 acceptance 所需截图至 `evidence/screenshots/`（`workspace-load.png`、`meeting-blocked.png`、`meeting-verified.png`；details 展开状态见 `grounding-ui-fixture-smoke.json`）
