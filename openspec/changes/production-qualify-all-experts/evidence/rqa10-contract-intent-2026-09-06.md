# RQA10：正式执行契约与飞书快捷意图边界

日期：2026-09-06。结论：本轮限定范围的调用前修复已完成，定向测试通过；可由 main 重启隔离 QA，对原 MS01 任务真实 retry。本文不宣称真实 Qwen 调用或任务全链路通过。

## 复现依据与设计评审

- 原任务：`task-mtoqv2bt-dglkt`；原 run：`expert_task-mtoqv2bt-dglkt_mtoqv2ge`（main 提供的现场标识，本轮未访问真实用户 app/profile）。
- 输入：同目录 `professional-batch2-inputs.json` 中 MS01 的完整 `content`，测试直接读取冻结文件，不删改“今天”“不要发送消息”等原文。
- 冻结文件 SHA256：`8564F03B86A3531ADD6307888C222C0A68794F53611A564BA5AAB9150AD95286`，本轮前后相同。
- 根因在宿主：prepare 对混有 SOP、材料和否定句的整段 prompt 使用聊天关键词分类，额外生成 `feishu.related_chats` 必需工具；tool-surface 又独立扫描同一原文。工具可用性预检因此能在模型调用之前失败，不能归因于模型主动调用飞书。

采用正式契约权威、聊天语义独立的共享解析方案：

1. `conversationMode === 'expert-execution'` 时，飞书核验意图只投影结构化声明，不扫描 prompt、SOP、材料、URL、否定句或专家 ID。没有声明时返回空意图，不回退到聊天猜测。
2. 投影读取 `requiredTools`、`requiredEvidence[].tool`、`completionConditions[].tool`，识别已声明的飞书操作；只生成核验标志，不新增工具要求，不反向扩展会议候选或文档读取前置步骤。
3. prepare 保留能力装配的结构化 grounding contract 与 payload executionContract 的合并。正式执行不再自动生成 direct-doc/related-chats 契约；其当前契约（包括空契约）取代上一任务的义务，不删除引用与选择锚点。
4. evidence-only / completion-only 声明也传递到 task frame，不能因 `requiredTools` 为空而丢失。工具可用性、成功调用、正文长度、截断限制及完成条件核验不放宽。
5. 普通聊天继续使用原 `detectFeishuIntent`。tool-surface 对已解析的候选文档使用 `contextDraft.prompt`，保留原始用户消息，不改写持久化输入。

未使用专家 ID 特判、简单“不要”正则或放开外部工具权限来绕过问题。工具暴露/授权与执行义务是不同层，本轮只修复意图与契约边界。

## 影响分析与并行边界

修改前使用 GitNexus debugging/impact-analysis 流程查询 `prepareAgentGenerate` 和 `buildRunToolSurface` 的上下游。此端 FTS 降级，impact 返回 UNKNOWN、partial/lower-bound，零命中不能解释为无调用方；源码/context 确认二者被 `executeAgentGenerate` 调用。

main 随后补充其核查：prepare impact LOW，直接 `executeAgentGenerate`，间接 `runAgentGenerate` / IPC，context 涉及 `proc_159/160/282/283`。接受该局部范围结论，同时因它是共享执行入口保留双入口回归，不据降级查询宣称全图完整。

结束前 `gitnexus_detect_changes(scope=all)` 返回：296 个 changed files、538 个 changed symbols、160 个 affected processes，整体 CRITICAL。它覆盖整个已有脏工作区及并行任务，不是本补丁的独立风险评级；已向 main 报告，不对无关变更扩改或提交。

本轮实际编辑范围：

- `src/lib/agent-execution-intent.ts`：新增共享解析/声明投影函数。
- `src/lib/agent-generate-prepare.ts`：接入共享意图；限制聊天推导契约；保留完整结构化义务；当前正式任务不继承旧任务义务。
- `src/lib/agent-generate-tool-surface.ts`：仅新增意图模块导入、替换末尾意图解析。
- `tests/agent-execution-intent.test.js`：新增定向测试。
- 本报告。

快照核对确认 prepare 除上述预期意图/契约补丁外保持一致，未改上下文组装、历史消息合并、用户输入锚点、当前轮消息去重及持久化代码。tool-surface 的非意图区出现并行变化：`IMAGE_PROVIDER_ADAPTER` 和 `requiresCapabilityImportTools` 接入；这些变化全部保留，本轮未改其适配器、权限或注册逻辑。未声称已通过另一个任务的独立通信协调，实际采用预先告知、窄补丁、并行差异检查。

`expert-task-runtime.ts`、`agent-generate-execute.ts`、冻结 QA 输入三项前后 SHA256 均一致；未修改 capability package、UI、原始 QA 输出或既有断言，未使用真实 API、fullcheck、commit。

## 红绿验证

首轮有效红测：16 项，10 pass / 6 fail。失败点分别为完整 MS01 输入误加外部工具、tool-surface 重扫原文、旧任务义务残留、仅证据/完成条件的契约丢失，以及尚未实现的两个共享函数测试。先记录这些失败，再应用生产修复。

修复后原 16 项全部通过；随后增加严格正文证据、正式任务引用 URL 的覆盖，并将普通候选绑定延伸检查到 tool-surface。扩测时曾暴露测试替身缺少 `classifyResearchIntent`，补齐无 I/O 的替身后重跑，并非放宽生产断言。

最终合并命令（仅定向测试）：

```powershell
node -r ./scripts/register-ts.js --test tests/agent-execution-intent.test.js tests/feishu-tool-surface-routing.test.js tests/feishu-grounding.test.js tests/agent-grounding-runtime.test.js tests/agent-generate-tool-surface.test.js tests/agent-calculation-tools.test.js
```

最终结果：116 tests / 116 pass / 0 fail / 0 skipped，进程 exit 0。其中本轮新增 18 项；既有相关测试最初单跑 97 项通过，最后合跑包含并行加入的 RQA04 测试，所以相关项变为 98。RQA04 测试及实现不归本轮所有。测试启动器末尾额外打印的 0-test 包装进程摘要不计为测试覆盖。

关键断言：

- 冻结 MS01 原文在旧检测器中确实触发 related-chats；真实 prepare/surface 函数在隔离替身环境下不再推导该必需工具，两处均无错误早退。
- 正式任务里的飞书关键词、会议词、今日优先级、引用 URL 和否定句均不能添加义务；任意专家身份相同处理。
- 显式声明 `feishu.related_chats` 即使原文含“不要发送消息”仍严格要求可用工具；缺工具预检失败并关闭连接器运行时，不虚报执行成功。
- 显式 `read_doc` 成功回执本身不能代替正文：缺失、empty、truncated、fail、过短、错误工具来源全部核验失败；符合声明的正文证据才通过。
- evidence-only、completion-only 及能力装配的结构化声明保留，缺回执仍失败，不静默丢弃。
- 普通会议总结、昨日消息、今日优先级、文档/知识库、纠正性飞书获取、直接 Docx URL、上轮候选数字选择均通过定向断言。
- 原文、上轮用户/助手上下文、本轮 noteContext、引用 activeRefId 与当前用户消息持久化锚点保留。

测试执行真实 prepare/surface 主体与意图/契约合并/引用绑定/消息身份/证据评估模块；环境服务为内存替身，未调用 LLM、真实连接器或读取真实用户数据。它证明本轮调用前边界，不替代现场端到端验收。

## 剩余风险与 main retry 交接

范围外的 `src/lib/agent-generate-execute.ts:134` 仍通过 displayPrompt 的关键词控制飞书后处理；随后在 `:168` / `:174` 将原始 prompt 交给飞书 hint 构造函数。因此，即使本轮调用前误判已消除，若正式任务标题/目标触发该后处理条件，仍可能在模型答复之后遇到关键词误判。该文件不在本轮授权范围，保持原样，没有通过修改用户 prompt 或关闭证据核验来绕过。正式契约被声明时的最终核验也应由 main 在真实 retry 中观察，不能仅凭本轮 surface 意图标志判定全链路契约一致。

共享入口还存在其他路由（如 research）和最终答案证据门禁，本轮不宣称它们全部遵循新的飞书意图规则，也未修改其非意图区。若 retry 暴露后处理/其他路由的问题，应依据具体阶段和原始证据另定范围。

main 可重启隔离 QA，使用冻结 MS01 与原任务 retry，核对：不再于调用模型前报未声明的 `feishu.related_chats`；实际是否进入模型调用；最终答复是否仍被范围外 hint 改写；工具调用/证据记录与任务状态是否一致。真实 retry 及专业验收由 main 执行，本轮未运行或覆盖现场结果。

## 追加：已授权的 execute 后处理修复

日期：2026-09-06。本节记录后续独立只读核查及 main 明确授权后的实现，更新上文“execute 后处理未修复”的历史状态；上文原测试记录、输入与现场证据不覆盖。

### 现场事实与独立反例分开记录

main 已报告 MS01 实际 UI retry `expert_task-mtoqv2bt-dglkt_mtos0ilf` 进入 review，无工具调用，最终纪要未被后处理改写；这是调用前修复对该实际入口有效的现场结果，不是本轮新运行。main 指出正文新增“陈琳组织复核会”等未明确认领事项及失败必顺延条件，专业资格另评，本报告不将 review 或工程通过等同于专业通过。

后续只读核查用真实 execute hook、真实旧 hint 与核验函数，环境依赖为内存替身，复现了不同入口的四类反例：

1. 正式执行、空契约、冻结 MS01 原文，展示标题“整理会议纪要”：runtime/legacy 均把模型答复改为请求调用 `feishu.related_chats`。
2. 展示标题中性但没有 `workbenchTaskId`：同样触发；有 task ID 且标题中性则不触发。
3. 已声明 `read_doc` 且合格正文/成功回执齐全，但 SOP 示例含会议纪要：仍被要求补充会议特征证据及检索。
4. 候选查询后已完成合格 `read_doc`：旧逻辑只认 `meeting_read`，把最终答案覆盖为候选列表。

这些反例未修改结构化 requiredTools，却改变了语义上的完成前提及答案。第一例的错误拒绝文本还通过了真实 verifyClaims、validateExecutionCompletion 和 OutputGate，得到 verified，说明仅检查 gate 标志无法检出任务未完成。

### 设计与实际变更

main 授权边界为 execute、必要 adapter、相关测试及本报告；不改 prepare、UI、current input 或持久化代码。

- `agent-generate-execute.ts` 的后处理直接以 `conversationMode === 'expert-execution'` 划分正式执行，不再用展示标题、task ID 或任何飞书关键词决定正式任务的旧 hint。正式执行不做飞书 hint 的连接器探测；不会因已声明某个飞书工具又重扫 SOP。
- 正式 runtime 仍进入既有独立 GROUND/契约核验，未关闭或改动该门禁。计划未完成提示保留，规划/讨论阶段仍不做飞书后处理。
- 红测额外确认 legacy 原先跳过统一 GROUND 核验。为避免仅移除 hint 后放过缺失证据，adapter 新增 `assertDeclaredExecutionEvidence`：只合并已有结构化声明，复用既有台账质量/来源绑定检查及 `validateExecutionCompletion`，在提交答案之前拒绝不满足的契约。没有新的文字分类或专家特判，缺工具、evidence-only、conditions-only 均严格；合格回执通过。该保护仅由正式 legacy 后处理调用，不改普通聊天的模式策略。
- adapter 新增普通聊天 `buildChatPostProcessHint`。只对当前会议选择流程、真实待选状态或本轮具体候选定位信息、尚无读取尝试且没有合格正文的情形展示候选列表。合格正文判定覆盖 `read_doc` / `get_wiki_node` / `meeting_read`，并复用台账的正文质量与来源绑定检查，不将传输 done 当作合格读取。
- 已选候选后的读取失败/空白/截断/错文档不再被候选列表遮住。普通非会议聊天也不因遗留候选而被覆盖；数字输入使用已经解析的文档定位 prompt，仅用于核验，不改原始用户消息。
- 成功的明确零候选回执作为“检索无结果”事实保留，不伪装成没有调用；它不是等待用户选择的候选列表。真实查询失败及读取授权失败保留原因/授权提示。为防止旧 hint 内部的候选分支再次覆盖，传入其的是仅用于展示的副本；原始工具回执、台账和引用状态不变。

生产变更只在 `agent-generate-execute.ts` 的后处理块以及 `agent-grounding-feishu-adapter.ts` 的新增函数/导入/导出；既有 adapter 函数原样保留。测试只新增 `tests/agent-execution-postprocess.test.js`，没有改既有断言。

### 红绿与回归证据

先写测试、再实现。首轮 44 项：19 pass / 25 fail，真实复现四类反例、计划提示被遮蔽、普通候选误覆盖及 legacy 缺回执不失败。生产修复后 44/44 通过。

随后扩展至 62 项，发现本轮候选过滤使“明确零结果”和“真实查询失败原因”退化，runtime/legacy 各两项，合计 4 fail；修复后 62/62 通过。最后补充 evidence-only/conditions-only 合格回执正向断言及 legacy 必须在 canonical commit/persist 之前停止的断言，新增测试共 66 项。

最终合并定向命令：

```powershell
node -r ./scripts/register-ts.js --test tests/agent-execution-postprocess.test.js tests/agent-execution-intent.test.js tests/agent-run-executor-grounding.test.js tests/agent-execution-contract.test.js tests/agent-grounding-runtime.test.js tests/feishu-grounding.test.js tests/feishu-meeting-selection.test.js tests/agent-terminal-persistence.test.js tests/agent-runtime-transcript-persistence.test.js
```

结果：165 tests / 165 pass / 0 fail / 0 skipped，exit 0（本轮 66 项 + 相关既有 99 项）。覆盖两种 grounding 模式的四反例、空/截断/失败/错误工具/错误文档证据、部分契约正反例、普通快捷/URL/数字选择、候选与零结果、真实查询错误/403 提示、规划讨论和计划提示。

新测试运行真实 execute 与真实 GROUND/PERSIST 主体，prepare/tool-surface/模型调用和外部环境均为替身；断言最终 canonical commit、内存 persist 文本及错误终态/缺证据失败，不仅断言 hint 字符串。legacy 缺义务必须是明确契约错误，committed/persisted 均为 null，避免把其他 TypeError 当作安全拒绝。未运行真实 LLM/API/隔离 QA，也未改当前输入、旧消息或原始 QA 数据。

### 风险、范围核对与交接

修改前重新执行 execute 上游 impact，并对既有 adapter 入口查询 impact；结果 UNKNOWN、partial/lower-bound，context 确认直接调用方 `runAgentGenerate`。main 已知并授权共享出口风险。收尾 `gitnexus_detect_changes(scope=all)` 覆盖整个脏工作区，报告 297 文件、540 符号、160 affected processes、CRITICAL；已明确报告，不能把全仓并行差异当成本次独立影响，也不能据此宣称全仓安全。

编辑前后快照对照通过：execute 的后处理块之外逐字一致；adapter 原有函数代码一致，仅新增函数/导入/导出。prepare、tool-surface、phases-ground-persist、expert-task-runtime 和冻结 professional-batch2-inputs.json 的 SHA256 前后全部相同。定向 `git diff --check` 通过。未碰 UI、capability package、其他 agent 的实现、消息持久化或当前输入锚点。

main 已启动整仓 check session40634，并自行记录源码/测试 hash。本 agent 未运行 fullcheck、真实 QA/API 或 commit，不将 main 正在执行的检查计为本轮通过证据；在收到该消息后没有再改源码或 tests，只追加本节报告。最终三个文件的 SHA256 随交接消息提供，由 main 判断其检查是否覆盖最终版。

本轮完成的是已授权的后处理契约边界与候选展示修复。正式任务仍须满足独立契约；这既不修复模型新增的业务责任/条件，也不证明所有专家专业合格。新增代码的实际 QA 重试与全仓检查结果仍由 main 验收。
