# Code Review: refactor-agent-multistage-output-pipeline

- **Reviewer**：独立工程代码审查
- **日期**：2026-08-06
- **范围**：仅审查 proposal/specs/design/tasks/qa-plan、指定 Agent 输出实现、对应 tests 与 evidence
- **方法**：源码逐行走读、生产路径与规格交叉核对、隔离负例复现、全量测试、lint、OpenSpec strict validate、既有 Electron IPC smoke 证据复核
- **产品代码修改**：无

## 结论

**BLOCKED** — 发现 7 项可复现 BLOCKING。正常 happy path 的单调 seq、工具轮 prose 缓冲、canonicalization 前置、重复/迟到事件幂等、滚动与 pending review 基础行为已实现；但生产 IPC 仍保留第二正文来源，异常路径不能保证 terminal，Renderer 仍可展示 thinking JSON，固定 DOM shell 的正文节点身份断言存在假阳性，结构化 UI 持久化会丢失 `open_link`，工具事件会把完整结果投影到 Renderer，未知协议版本也被前置过滤。当前不应进入制作人验收、正式 QA 或归档。

## BLOCKING

### B1：生产 invoke 仍返回正文并保留 typewriter 回退，形成第二正文来源

- **位置**：
  - `src/main.js:4438-4450`
  - `src/workspace-agent.js:4938-4952`
  - `tests/agent-output-ipc.test.js:61-64`
  - `tests/agent-stream-repaint.test.js:50-53,73-80`
- **原因**：kernel `ai-generate` 返回值仍包含 `text: kernelResult.text`。Renderer 在未观察到 `answer.committed` 时读取该正文，并调用 `revealTypewriter()` 伪造逐字输出；现有测试还把该 fallback 固化为期望行为。
- **违反规格**：
  - `agent-run-executor/spec.md` 要求 invoke 结果不得携带可覆盖 Renderer 的另一正文版本。
  - `design.md` 与 `qa-plan.md` 要求正文唯一来源为 `answer.committed`，并明确禁止 invoke 覆盖与伪造 provider 打字速度。
- **影响**：事件监听丢失、订阅时序或 IPC 异常时，Renderer 会绕过 v2 answer lane 重新提交正文；canonical 单一来源、DOM 稳定性和“完成后不重放”均无法成立。
- **最小修复建议**：从 kernel invoke projection 删除 `text`；协议 v2 Run 未收到 `answer.committed` 时收敛为可读错误态，不调用 `revealTypewriter()`，并把现有 fallback 测试改为断言“无正文返回、无重放”。

### B2：postprocess/persist 等抛异常时没有唯一 terminal

- **位置**：
  - `src/lib/agent-run-executor.js:738-822`
  - `src/main.js:4426-4463`
- **原因**：Executor 只处理显式 `{ error }` 返回；`postProcess`、grounding、canonicalize、session persist 或 emitter 抛异常时会直接 reject。Main 只有 `try/finally`，没有发送 v2 `run.failed` 的 catch。
- **隔离复现**：令 `ports.session.persist()` 抛出 `Error('persist boom')`；结果为 `answerCommits:1`、`terminals:[]`，Promise 直接抛错。
- **违反规格**：`agent-output-protocol` 与 `agent-run-executor` 均要求 completed/cancelled/failed 三者恰好一个；持久化不可恢复错误必须发送 `run.failed`。
- **影响**：Renderer 可能已经看到 canonical answer，但永远收不到 terminal；busy/冻结状态依赖 invoke catch 收尾，协议事件流本身不闭合。
- **最小修复建议**：在拥有同一个 `outputEmitter` 的 Executor 内为完整管线增加兜底 catch，并通过现有 `fail()` 只发送一次 `run.failed`；补充 postProcess、persist、clone/emit 抛错注入测试，断言 terminal 恰好一个且结果可 `structuredClone`。

### B3：工具完成事件会把完整工具结果原文发送并渲染到时间线

- **位置**：
  - `src/lib/agent-run-executor.js:588-605`
  - `src/lib/agent-output-protocol.js:163-181`
  - `src/workspace-agent.js:2664-2683`
- **原因**：`resultEvent.summary` 使用 `result.preview || result.text`；没有 preview 时，完整工具结果进入 v2 payload，随后 Renderer 在 `<pre>` 中完整展示。该字段也没有长度上限或敏感内容投影白名单。
- **隔离复现**：mock 工具返回 `text:'FULL_PRIVATE_TOOL_RESULT'`，收到的 `tool.completed.payload.summary` 与该原文完全相同。
- **违反规格**：`agent-thinking-timeline/spec.md` 要求产品化工具摘要；`qa-plan.md` 要求 UI 不展示敏感工具原文。
- **影响**：飞书文档、会议、知识库或文件工具的完整内容可能跨 IPC 进入时间线，同时扩大 clone/DOM 负载。
- **最小修复建议**：tool lane 只接受工具契约生成的 display-safe、定长 preview；无 preview 时展示通用完成摘要，完整 `result.text` 仅保留在模型上下文/受控持久化中。增加“无 preview 的敏感结果不进入事件/DOM”测试。

### B4：Renderer 仍主动识别并展示 thinking/reasoning JSON

- **位置**：
  - `src/workspace-agent.js:2188-2251`
  - `src/workspace-agent.js:2328-2351`
  - `tests/workspace-agent.test.js:287-291`
- **原因**：非流式消息会通过 `parseThinkingBlocks()` 识别 thinking/reasoning/analysis JSON，再由 `renderThinkingBlock()` 以展开的“思考过程”卡片原样显示。新 v2 Assembler 虽会剥离部分 thinking fence，但旧会话、旁路或未命中的协议文本仍会在 Renderer 泄漏；现有测试反而要求该 UI 存在。
- **违反规格**：proposal、design、`agent-chat-ux/spec.md` 和 qa-plan 均明确禁止展示 provider reasoning、thinking JSON 或内部协议字段，并要求用户可见时长为 0。
- **影响**：旧会话恢复和非 v2 完成路径可以直接展示模型内部推理结构，零泄漏目标不成立。
- **最小修复建议**：删除 Renderer 的 thinking JSON 展示路径；legacy hydration 只剥离并记录安全诊断，不渲染原始 JSON。将现有测试改为 fenced/bare/incomplete thinking 在恢复与完成路径均不可见。

### B5：正文容器不是固定 shell，Electron smoke 的节点身份检查存在假阳性

- **位置**：
  - `src/workspace-agent.js:3147-3157`
  - `src/workspace-agent.js:3364-3383`
  - `src/workspace-agent.js:5645-5674`
  - `openspec/changes/refactor-agent-multistage-output-pipeline/evidence/agent-output-electron-smoke.js:256-263`
- **原因**：初始 v2 waiting bubble 没有 `[data-assistant-body="1"]`；首次 `answer.committed` 到来时 `upgradeThinkingBubble()` 才新建正文容器。fixture 的 `sameBodyNode` 在 `bodyBefore` 或 `bodyAfter` 缺失时仍返回 true，因此“正文节点身份保持不变”会假通过。
- **违反规格**：`agent-chat-ux/spec.md` 要求每条实时助手消息从开始即有固定执行、正文、结构化 UI 与动作区域，并在 answer commit 前后保持正文容器身份。
- **影响**：现有 Electron PASS 不能证明 body `isSameNode`；首次提交仍是创建节点而不是在固定区域局部更新。
- **最小修复建议**：mount 时始终创建空的 response body/structured UI 容器，answer/ui 只 patch 内容；fixture 必须要求 before/after 节点都存在且严格 `===`，缺任一节点直接失败。

### B6：合法 `open_link` 选择在 session normalize/compact 后丢失

- **位置**：
  - `src/lib/agent-output-assembler.js:118-131`
  - `src/lib/agent-sessions.js:71-93`
  - `src/lib/agent-run-kernel-adapter.js:141-144`
- **原因**：Assembler 会保留已解析 choice 的 action（现有 suggestion 对应测试也明确覆盖合法 `open_link`），但 `normalizeStructuredUi()` 的持久化白名单只有 `fill/send/copy/open_knowledge`。生产 persist 会立即 `compactSession()`，因此合法 `open_link` UI 被删除；canonical text 已剥离 suggestion 后，重载时也无法惰性恢复该按钮。
- **隔离复现**：对含 `protocolVersion:2` 与 `open_link` choice 的 assistant message 执行 `normalizeSession()`，输出只剩 `{"role":"assistant","text":"ok","protocolVersion":2}`。
- **违反规格**：新会话必须持久化结构化 `ui`，旧/重载会话必须继续显示结构化选择。
- **影响**：链接型 suggestion 当前轮可见，保存或重启后消失，hash/text 与 UI 组合不再可恢复。
- **最小修复建议**：协议解析、session normalize 与 Renderer dispatcher 共用同一 action allowlist；加入 `open_link` round-trip（parse → canonicalize → compact/save → load → render）测试。

### B7：Renderer 在 reducer 之前过滤未知版本，无法收敛到可读错误态

- **位置**：
  - `src/workspace-agent.js:2077-2084`
  - `src/workspace-agent.js:4855-4860`
  - `src/lib/agent-message-state.js:107-139`
- **原因**：Reducer 已实现 unsupported-version → failed/frozen，但生产 listener 先执行 `if (event.version !== 2) return`，`applyV2StreamEvent()` 也再次拒绝，因此该状态迁移永远不可达。
- **违反规格**：`agent-output-protocol/spec.md` 要求未知协议版本被忽略正文 payload，同时当前 Run 收敛到可读错误态。
- **影响**：版本错配时助手气泡可能持续 running，直到 invoke 旁路收尾；协议门控没有按规格工作。
- **最小修复建议**：runId 命中后让带版本的事件进入 reducer，由 reducer决定失败/冻结；仅对明确的无版本 legacy 事件走有界兼容或忽略。增加真实 listener 级 unsupported-version 测试。

## 已通过的实现核对

- 正常 Executor 路径使用单个 Run emitter，v2 seq 严格递增，happy path 的 answer/ui 位于 terminal 之前。
- 工具轮 cumulative snapshot 只进入 Assembler；带 tool call 的轮内 prose 会被丢弃，不产生 `answer.committed`。
- postProcess、runtime grounding、claim verification、output gate、必要 regen、normalize 与 suggestion 提取均位于正常 answer commit 之前。
- Assembler 对合法、非法、半截 suggestion 以及新 v2 thinking fence 的剥离有单测；answer hash 与持久化正文在正常路径一致。
- Reducer 对 duplicate/late/gap、terminal freeze、answer once 与 pending review 有基础覆盖。
- Workspace 不订阅 `ai-stream-chunk`；progress/tool/answer/ui/terminal 的正常更新主要走局部 patch。
- 滚动 stick 状态与 pending review 展开在既有 Electron 场景中通过。

## 测试与证据

- Preflight：**PASS**，`needs_fix=false`
- 全量 `npm test`：**PASS，1245/1245**
- `npm run lint`：**PASS**（`lint ok`、`script-scope ok`）
- `npx openspec validate refactor-agent-multistage-output-pipeline --strict`：**PASS**
- 既有 Electron IPC smoke 报告：**PASS，18/18 IPC dispatches**，`mode:"electron"`、`ipcPathVerified:true`、无 limitations

Electron smoke 确实通过 fixture handler、真实 `ipcRenderer.invoke` / Main `webContents.send` / preload subscription 回到 Renderer，不只是纯 DOM fixture；但它注入的是手工 v2 事件，没有经过生产 `ai-generate`、AgentRunExecutor、postprocess/persist、工具结果投影或 session round-trip。因此它不能覆盖 B1、B2、B3、B6、B7；B5 的 body 身份断言还因“缺节点也算相同”而假通过。为遵守“只允许更新 code-review.md”，本次未重跑会覆盖 JSON/截图的 smoke 脚本，仅复核现有脚本与报告。

## 门禁状态

- `tasks.md` 的 6.3、6.4、6.5 仍未勾选，qa-plan Smoke Scope 仍未签收。
- 自动化全绿不消除以上规格级负例；修复 B1–B7 并补齐对应测试后，需要重新执行独立复审。

## 修复后复审（2026-08-06）

### 复审结论

**BLOCKED** — B1、B3、B5、B6、B7 已验证为 **RESOLVED**；B2、B4 仍有可复现阻断。全量测试、lint 与 OpenSpec strict validate 虽然通过，但现有自动化没有覆盖下面记录的 terminal emitter 异常和 bare/半截 thinking 负例，因此不得宣称复审通过，也不应进入制作人验收、正式 QA 或归档。

### B1：RESOLVED — invoke 第二正文来源已移除

- `src/main.js:4406-4438` 的 kernel invoke projection 不再返回 `kernelResult.text`，只返回协议版本、hash、terminal 与非正文元数据。
- `src/workspace-agent.js:4904-4922` 仅为 legacy 路径保留 `finalText`/`revealTypewriter()`；当前 Run 在 mount 时即标记 `protocolVersion: 2`，v2 未收到 `answer.committed` 时显示“未能收到完整答复，请重试”，不会用 invoke 返回值提交或重放正文。
- `tests/agent-output-blocking-fixes.test.js` 与 `tests/agent-output-ipc.test.js` 已覆盖“kernel 无 text”和“v2 无 typewriter fallback”；定向复跑通过。

### B2：仍阻断 — terminal emitter 抛错仍可产生零 terminal

- `src/lib/agent-run-executor.js:853-869` 已能把 postProcess、persist 等普通管线异常收敛为一个 `run.failed`；对应 postProcess/persist 注入测试通过。
- 但 `src/lib/agent-output-protocol.js:129-136` 在调用实际 `emitFn` 前先设置 `terminalEmitted = true`。若 `run.completed` 的 `emitFn`/`webContents.send` 抛错，Executor catch 在 `src/lib/agent-run-executor.js:854` 看到 `terminalEmitted` 为真后直接返回，不再发送 `run.failed`。
- 独立负例向 `run.completed` 注入 `Error('terminal emit boom')`，结果为：
  - `resultTerminal: "DONE"`
  - `resultError: "terminal emit boom"`
  - `seenTerminals: []`
- 这仍违反“每个 Run completed/cancelled/failed 恰好一个”的协议要求；现有 `agent-output-blocking-fixes.test.js` 只覆盖 postProcess/persist，没有覆盖原审查要求的 terminal emit 异常。

### B3：RESOLVED — 工具事件不再投影完整结果

- `src/lib/agent-run-executor.js:590-607` 使用 `buildToolDisplaySummary()` 构建用户可见摘要，不再回退到 `result.text`。
- `src/lib/agent-tool-display.js:3-18` 只接受显式 `displaySafe === true` 的定长 `displayPreview`（最多 240 字符）；否则使用通用成功/失败摘要。
- 敏感 `FULL_PRIVATE_TOOL_RESULT` 注入测试证明完整工具正文不会进入 `tool.completed.payload.summary`，定向复跑通过。

### B4：仍阻断 — bare 与半截 bare thinking 仍会泄漏

- Renderer 的 `renderThinkingBlock()`/thinking JSON 卡片已删除，fenced thinking 和带多个识别字段的完整 bare JSON 可以被剥离。
- 但 `src/lib/agent-suggestion.js:272-315` 对 bare JSON 仅在 JSON 可完整解析且命中较严格 marker 规则时剥离；半截 bare JSON无法解析，单字段 `thinking`/`reasoning` 也因 marker 数不足而保留。
- 独立负例的实际输出仍等于输入，秘密字段可进入正文：
  - `正文\n{"type":"reasoning","steps":["secret"`（半截 bare）
  - `正文\n{"thinking":"secret"}`（单字段 bare）
  - `正文\n{"reasoning":"secret"}`（单字段 bare）
- 现有名为“bare trailing and incomplete”的测试实际只覆盖“完整多 marker bare + 带显式 reasoning fence 的半截块”，没有覆盖半截 bare 或单字段 bare。proposal 的所有流式/完成路径 0 ms 泄漏与 qa-plan 的 bare/半截 JSON 零泄漏仍未满足。

### B5：RESOLVED — v2 固定 body/UI shell 与节点身份成立

- `src/workspace-agent.js:3105-3122` 在 waiting mount 时即创建 `[data-assistant-body="1"]`；v2 通过 `renderStructuredUiRegion(..., true)` 同时创建空的 `[data-structured-ui="1"]`。
- answer 更新复用 body，choice 更新只写 structured UI 容器的 `innerHTML`，terminal 继续局部 patch；`src/workspace-agent.js:5629-5647` 对 body/UI 均要求 before、after 存在且严格同一节点，不再把缺节点视为通过。
- 在不写回仓库 evidence 的临时隔离 Electron smoke 中，把身份断言扩展到 `answer.committed`、`choice.ready`、`run.completed` 三个阶段后仍通过；body、structured UI、bubble 与历史节点均保持身份稳定。

### B6：RESOLVED — `open_link` 可持久化 round-trip

- `src/lib/agent-sessions.js:71-95` 复用 `agent-suggestion` 的统一 `ALLOWED` action 集合，其中包含 `open_link`。
- `normalizeSession()` 与 canonicalize → normalize 两条测试均证明 `open_link` choice 保存后仍存在，定向复跑通过。

### B7：RESOLVED — 未知版本可进入 reducer 并收敛失败态

- `src/workspace-agent.js:2086-2110,4820-4829` 只过滤无版本 legacy 事件，带未知版本的事件会进入 reducer。
- `src/lib/agent-message-state.js:107-139,235-255` 将未知版本收敛为 frozen/failed，并在未提交 answer 时显示“输出协议不受支持”。
- reducer、message projection 与真实 listener 源码契约测试均通过。

### 额外核对

1. **bare/半截 thinking 协议零泄漏：BLOCKING**  
   fenced 与部分完整 bare 已处理，但上述半截 bare、单字段 bare 仍原样返回，不能满足零泄漏。

2. **v2 structured UI 从 mount 存在且 answer/choice/terminal 节点身份稳定：PASS**  
   源码固定 shell 与严格 before/after 判断成立；扩展到 choice 阶段的隔离 Electron 动态检查通过。

3. **Electron smoke 独立 userData 且不因已有 KnowMe 实例降级：PASS**  
   `src/main.js:12-21` 在 `requestSingleInstanceLock()` 前按 `KNOWME_TEST_SEAM` 设置 `KNOWME_TEST_USER_DATA_DIR`。复审时已有使用 `C:\Users\Administrator\AppData\Roaming\KnowMe` 的 KnowMe Electron 实例；隔离重跑仍以 `mode: "electron"`、`limitations: []`、独立临时 `userDataDir` 完成 18/18 IPC dispatch，没有降级到 Chromium fixture。

4. **截图证据不影响 scroll-drift：PASS**  
   screenshot helper 只追加 `position: fixed` 的气泡 clone，截图后立即移除，不进入聊天滚动容器布局。包含三次截图的隔离 Electron 重跑中，`scrollBefore = 3516`、`scrollAfter = 3516`、`scrollDriftPx = 0`。

### 本次验证

- Preflight：**PASS**，`needs_fix=false`
- 定向复审测试：**PASS，54/54**
- 全量 `npm test`：**PASS，1269/1269**
- `npm run lint`：**PASS**（`lint ok`、`script-scope ok`）
- `npx openspec validate refactor-agent-multistage-output-pipeline --strict`：**PASS**
- 隔离 Electron smoke：**PASS**，`mode:"electron"`、18/18 IPC、无 limitations、scroll drift 0；输出仅写入系统临时目录，未覆盖仓库 evidence

### 最终结论

当前修复使 7 个原阻断中的 5 个关闭，但 **B2 与 B4 仍阻断**。必须先保证 terminal 发送回调异常不会留下零 terminal，并补齐/修复半截 bare 与单字段 bare thinking 的显示剥离和自动化负例，之后才能再次申请复审。

### 最终复审更新（2026-08-06）

#### B2：RESOLVED

- `src/lib/agent-output-protocol.js:129-136` 现已在 `emitFn` 成功返回后才设置 `terminalEmitted`。因此 `run.completed` 发送失败时不会提前冻结 emitter，Executor catch 可继续调用 `fail()` 发送唯一 `run.failed`。
- 新增集成测试 `completed emitter throw falls back to one run.failed terminal` 覆盖原阻断路径。
- 独立复现向 `run.completed` 注入 `Error('terminal emit boom')`，实际结果为：
  - `resultTerminal: "ERROR"`
  - `resultError: "terminal emit boom"`
  - `seenTerminals: ["run.failed"]`
- 原“零 terminal 且结果仍为 DONE”的负例已关闭。

#### B4：RESOLVED

- `src/lib/agent-suggestion.js:272-327` 现将 `thinking`、`reasoning`、`thought` 等强字段视为单字段协议；对 trailing 半截 bare JSON，也会按强字段或 `type/kind/stage/category` 的 thinking marker 保守剥离。
- 新增测试覆盖前次复审列出的三个精确负例，并验证普通单字段 `analysis` JSON 仍保留。
- 独立负例复测结果：
  - `正文\n{"type":"reasoning","steps":["secret"` → `正文`
  - `正文\n{"thinking":"secret"}` → `正文`
  - `正文\n{"reasoning":"secret"}` → `正文`
  - `正文\n{"analysis":"public data"}` 保持原样
- 原 bare/半截 thinking 用户可见泄漏路径已关闭，且未把普通 analysis 数据一并删除。

#### 最终总结果

**PASS / APPROVED** — B1–B7 均已验证为 **RESOLVED**，本次独立代码复审不再有 BLOCKING。

- 定向复审命令：`node --test tests/agent-output-blocking-fixes.test.js tests/agent-output-protocol.test.js tests/agent-run-executor.test.js`
- 结果：**PASS，34/34**
- 该结论仅关闭本次 B1–B7 独立代码复审阻断，不替代 qa-plan、制作人验收或 Tester 正式 QA 等后续流程门禁。
