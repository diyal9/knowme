# 制作人体验验收: refactor-agent-multistage-output-pipeline

## 前置门禁

| 项 | 状态 | 证据 |
|---|---|---|
| 开发自测 | PASS | `evidence/dev-self-test.md` |
| 独立 code review | PASS / APPROVED | `code-review.md`（B1–B7 均已 RESOLVED） |
| OpenSpec strict validate | PASS | dev-self-test |
| Harness gate | PASS | dev-self-test |
| Electron IPC 冒烟 | PASS 18/18 | `evidence/agent-output-electron-smoke.json` |

## 核心路径

- [x] **运行中（progress/tool）**：工具轮与阶段更新只写入执行进度区，最终回答区不出现临时 prose、thinking 或 JSON。  
  → 截图 `screenshots/running-progress.png`：仅见「执行进度」折叠区与阶段行（内容整理完成 ✓、写入文件 ✓、进度更新 1 ●），底部 waiting 指示与输入区正常；无 raw JSON / fence。
- [x] **canonical answer 提交**：经 `answer.committed` 一次性提交正文，提交后长度与 hash 稳定，无清空、缩短或 invoke 第二来源覆盖。  
  → smoke `canonical-hash-stable`、`history-bubble-body-same-node`（rollbackCount=0）；截图 `screenshots/canonical-choice.png` 正文为完整 Markdown 句，无回滚痕迹。
- [x] **结构化选择零 JSON 泄漏**：合法 suggestion 直接进入「下一步」按钮区，正文已剥离协议块。  
  → smoke `visible-raw-json-zero`（0 ms）、`choice-in-structured-ui`；截图可见「1 继续分析」可点选项，未见 ````suggestion` 或 bare JSON。
- [x] **过程 vs 答案层次**：同一气泡内自上而下为「回答正文 → 结构化 UI → 执行进度」，区域职责清晰、不互相覆盖。  
  → 截图 canonical / terminal 两态均符合 design 固定 skeleton；code-review B5 固定 body/UI shell 已 RESOLVED。
- [x] **完成态 + pending review**：Run terminal 后，待确认写入步骤仍展开，批准/拒绝入口可用，不误标为普通 done。  
  → smoke `pending-review-timeline-open`（timelineOpen、approveVisible、rejectVisible 均为 true）；截图 `screenshots/terminal-pending-review.png` 展开时间线，「写入文件」行保留「查看预览」。
- [x] **上滑不抢滚动**：用户主动离开底部后，后续 10 次 lane 事件不强制回底。  
  → smoke `scroll-drift-under-8px`（scrollBefore=3516、scrollAfter=3516、drift=0 px）；截图 helper 使用 fixed clone，不污染 scroll 容器（code-review 已核对）。
- [x] **幂等与 terminal 收敛**：重复/迟到事件不额外 DOM 更新；每个 Run 恰好 1 个 terminal；未知协议版本可读失败态。  
  → smoke `terminal-once-no-duplicate-late-dom`；code-review B2/B7 负例已关闭并有定向测试。
- [x] **真实 Electron IPC 路径**：fixture 经 preload 订阅 + Main `webContents.send` 回到 Renderer，非纯 DOM 假路径。  
  → smoke `mode=electron`、`ipcPathVerified=true`、`limitations=[]`、独立 userDataDir。

## 体验标准（C 端用户视角）

| 标准 | 结论 | 依据 |
|---|---|---|
| 多阶段输出稳定，不闪烁/回滚 | **通过** | rollbackCount=0；三截图状态连贯；DOM 身份 smoke 全绿 |
| 过程与答案层次清晰 | **通过** | 固定 skeleton：正文 / 下一步 / 执行进度分区明确 |
| 结构化选择直接显示，无 JSON | **通过** | 按钮化「继续分析」；raw JSON 0 ms |
| 上滑后不抢滚动 | **通过** | drift 0 px（定量门槛 < 8 px） |
| pending review 持续可见、可操作 | **通过** | DOM 断言 + terminal 截图时间线展开 |
| 错误/取消可读收敛 | **通过（证据间接）** | B2 terminal emit 失败 → 唯一 `run.failed`；B7 不支持版本 →「输出协议不受支持」；取消/错误未单独截图，由 code-review + blocking-fixes 测试覆盖 |
| 视觉与现有工作台一致 | **通过** | 卡片圆角、侧栏、模型 pill、输入区与既有 Agent 工作台风格一致；无新框架感 |

## 证据清单

- 规格：`proposal.md`、`design.md`、`specs/agent-output-protocol/spec.md`、`specs/agent-chat-ux/spec.md`、`specs/agent-thinking-timeline/spec.md`、`specs/agent-run-executor/spec.md`
- QA：`qa-plan.md` Smoke Scope 12 项（本验收按同等条目核对）
- 自动化：`evidence/agent-output-electron-smoke.json`（10/10 checks PASS）
- 截图：
  - `evidence/screenshots/running-progress.png` — 运行中阶段与时间线
  - `evidence/screenshots/canonical-choice.png` — canonical 正文 + 结构化选择
  - `evidence/screenshots/terminal-pending-review.png` — 完成态 + 展开 pending review
- 审查：`code-review.md` 最终 PASS / APPROVED

## 发现

### BLOCKING

无。

### ADVISORY

1. **冒烟为受控 fixture 场景，非 live LLM 全链路**  
   Electron smoke 手工注入 v2 事件序列，未经过生产 `ai-generate` → AgentRunExecutor → 真实模型/工具。制作人验收基于 fixture UX + IPC 契约 + 1271 单测与 code-review 负例。建议 Tester 在 qa-plan Regression 中补一条「真实写工具 pending_review 批准/拒绝」真机路径。

2. **首个可见正文较旧 typewriter 更晚（设计取舍）**  
   稳定优先缓冲策略下，running 截图仅见执行进度、不见逐字正文。符合 proposal/design，但需在真实任务中确认阶段文案足够安抚等待感。

3. **fixture 中 10 条「进度更新 N」略显重复**  
   为 scroll/幂等压测而设，不代表生产阶段命名。Tester 应关注真实 Run 是否出现无意义重复 stage 标题。

4. **取消/错误终态无制作人截图**  
   逻辑与测试已覆盖；正式 QA 建议各采 1 张 cancelled / failed 截图归档。

5. **旧会话惰性兼容未在本轮截图验证**  
   `agent-suggestion` round-trip 与 `open_link` 持久化已有单测；Tester 回归需含重载旧会话。

## 验收结论

- [x] **通过**
- [ ] 不通过

**结论说明**：从 C 端用户视角，多阶段输出在运行中、canonical 提交、结构化选择与 pending review 完成态均表现稳定；过程与答案分区清晰；协议 JSON 零泄漏；上滑滚动不被抢回；视觉与现有工作台一致。前置开发自测与独立 code review 均已 PASS，Electron IPC 冒烟 18/18 且无 limitation。无 BLOCKING 发现，**放行 Tester 按 `qa-plan.md` 执行正式 QA**。

- 验收人：制作人
- 日期：2026-08-06
