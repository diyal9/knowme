# agent-thinking-timeline Specification

## Purpose

定义 Agent 推理与工具执行时间线的信息层级、增量更新、证据状态、审批步骤和子 Run 摘要，避免过程块淹没对话并确保执行结果可追踪、可核验。
## Requirements
### Requirement: 时间线降噪

系统 MUST 在推理过程中突出当前动作，并默认折叠工具原始结果。执行过程 MUST 在运行时默认展开，并在回答完成且无 pending 或 pending_review 步骤时原地折叠；存在待确认步骤时 MUST 保持审批入口可见。

#### Scenario: 执行中

- **WHEN** Run 仍有 pending 步骤
- **THEN** 总摘要显示「执行进度」，当前步骤高亮，已完成步骤紧凑弱化
- **AND** 执行过程默认展开

#### Scenario: 工具结果

- **WHEN** 工具步骤含详细结果
- **THEN** 结果默认折叠，提供「查看结果」类入口

#### Scenario: 完成后

- **WHEN** 回答完成且无 pending 或 pending_review 步骤
- **THEN** 时间线在现有节点上自动收起为「执行过程」
- **AND** 用户可再次手动展开查看

#### Scenario: 完成后仍有待确认步骤

- **WHEN** 回答生成结束但工具步骤仍为 pending_review
- **THEN** 时间线 MUST 保持展开
- **AND** 批准与拒绝入口 MUST 继续可见

### Requirement: Execution timeline updates in place instead of rebuilding

系统 MUST 在流式过程与完成收尾时以增量方式更新「执行过程」时间线，MUST NOT 每次进度事件、计时 tick 或回答完成都整棵替换 `<details class="agent-execution">`。

#### Scenario: Elapsed timer ticks each second

- **GIVEN** 一条 assistant 消息正在流式输出且已有执行过程时间线
- **WHEN** 计时器每秒刷新一次耗时
- **THEN** 系统 MUST 只更新耗时文本节点
- **AND** 已存在的 trace 行 DOM 节点 MUST 保持同一节点身份（不被替换）
- **AND** 呼吸球 / pulse 动画 MUST NOT 重新开始播放

#### Scenario: New tool step arrives

- **GIVEN** 时间线已渲染 N 行
- **WHEN** 新增一个工具步骤或已有步骤状态由 pending 变为 done
- **THEN** 系统 MUST 只新增或替换受影响的那一行
- **AND** 其余未变化的行 MUST 保持原节点不变

#### Scenario: User expanded a tool detail during streaming

- **GIVEN** 用户在流式过程中展开了某个工具步骤的详情
- **WHEN** 后续进度事件或计时 tick 刷新时间线
- **THEN** 该步骤 MUST 保持展开状态

#### Scenario: User collapsed the execution card during streaming

- **GIVEN** 用户手动折叠了「执行过程」卡片
- **WHEN** 后续进度事件刷新时间线
- **THEN** 系统 MUST NOT 强制重新展开

#### Scenario: Run completion collapses in place

- **GIVEN** 执行过程时间线与最终回答均已显示
- **WHEN** Run 完成且无待确认步骤
- **THEN** 系统 MUST 在同一时间线节点上更新完成摘要并移除展开状态
- **AND** 最终回答及历史消息节点 MUST 保持不变

### Requirement: Run phase metadata on stream events

Stage 与 tool 流式事件 SHOULD 携带可机器读取的 Run 阶段标识（如 `runPhase`），其值 MUST 与执行内核阶段枚举一致；C 端展示文案 MUST 保持既有 title/summary，不得因新增字段而改变用户可见文案。

#### Scenario: Stage event includes runPhase

- **WHEN** 内核进入 `CONTEXT` 并 emit stage 事件
- **THEN** 事件 payload 含 `runPhase: 'CONTEXT'`（或等价字段）
- **AND** `title` 仍为既有本地化阶段标题

#### Scenario: Tool event includes runPhase

- **WHEN** 内核进入 `TOOL` 并 emit tool 事件
- **THEN** 事件 payload 含 `runPhase: 'TOOL'`

#### Scenario: UI text unchanged

- **WHEN** 渲染进程展示时间线
- **THEN** 仅使用 `title`/`summary` 等既有字段
- **AND** 不展示 `runPhase` 给用户（除非未来 Story 明确要求）

### Requirement: Timeline shows evidence and verification status

执行过程时间线 MUST 展示工具/evidence 状态：ok、fail、empty、truncated、blocked、pending_review、cancelled，并提供来源 provenance 入口（工具名、refId、evidenceId、auditId）。MUST NOT 在 ledger 无 ok 证据时将工具步骤显示为已成功读取。

#### Scenario: Truncated tool shows truncated badge

- **WHEN** tool result 被标记 truncated
- **THEN** 时间线该步骤 MUST 显示 truncated 状态
- **AND** 默认摘要 MUST NOT 写「已读取全文」

#### Scenario: Pending review not shown as success

- **WHEN** 写工具 draft 仍 pending_review
- **THEN** 步骤 MUST NOT 显示为已成功写入外部系统

#### Scenario: Blocked verify shows blocked step

- **WHEN** ClaimVerifier 拦截最终输出
- **THEN** 时间线 MUST 增加 blocked/核对依据 步骤
- **AND** 用户可查看 blocked 原因摘要

#### Scenario: Provenance expand preserves streaming behavior

- **WHEN** 用户展开某 evidence 来源详情
- **THEN** 须符合既有「流式增量更新、不重建整树」要求
- **AND** 展开状态保持

### Requirement: Grounding status stream metadata

Stage/tool 事件 MUST 可携带 grounding-status 元数据（status、sources、claims），供时间线渲染；C 端 title/summary 文案 MUST 保持中性诚实，不得虚假「已读取」。

#### Scenario: Emit grounding status on verify

- **WHEN** VERIFY_CLAIMS 完成
- **THEN** emit MUST 含 grounding-status verified|blocked|failed
- **AND** 机器字段 MUST NOT 改变用户 Markdown 正文结构

### Requirement: Approval and draft steps in timeline

时间线 MUST 展示审批类工具步骤：状态 pending_review/approved/rejected/applied；展开详情 MUST 含 preview 摘要与审批入口（若仍 pending）。

#### Scenario: Pending approval visible

- **WHEN** 工具返回 requiresApproval 与 draftId
- **THEN** 时间线该步骤标记为「待确认」且可跳转审批卡

### Requirement: Orchestration and sub-run summary

当 Run 含子 Agent 委派时，时间线 MUST 展示 delegation 行，含 expert 名、子 Run 状态与结果摘要链接。

#### Scenario: Sub-run completed

- **WHEN** 子 Run 成功完成
- **THEN** 父时间线 delegation 步骤显示 done 与 summary 首行

### Requirement: toolTimelineTitle readable summaries

工具时间线步骤 title MUST 通过 `toolTimelineTitle`（或等价）生成可读摘要：write/patch → 文件名；move → `源 → 目标`；飞书 → 类型+标题；mkdir 直建 → 路径 +「低风险直建」。

#### Scenario: Move shows arrow summary

- **WHEN** move_path 工具完成
- **THEN** 时间线 title 含 `a.txt → b.txt` 形式摘要

#### Scenario: Mkdir direct create label

- **WHEN** 低风险 mkdir 直建成功
- **THEN** title 含「低风险直建」与相对路径

### Requirement: Timeline is driven only by progress and tool lanes

执行过程时间线 MUST 只消费 progress 与 tool lane；answer 与 ui 事件 MUST NOT 新建、覆盖或删除工具步骤。用户可见时间线 MUST 展示产品化的阶段标题、工具摘要、证据状态和待确认动作，MUST NOT 展示原始 provider reasoning 或内部协议字段。

#### Scenario: Model round is buffered

- **WHEN** 工具可用模型轮正在生成但尚未确定是否调用工具
- **THEN** 时间线显示可读的生成/处理阶段
- **AND** 不展示该轮原始 prose、reasoning 或 JSON

#### Scenario: Tool lifecycle updates

- **WHEN** 同一工具依次产生 started 与 completed/failed 事件
- **THEN** 系统在同一时间线步骤上更新状态
- **AND** 不因事件 lane 分离而创建重复工具行

#### Scenario: Answer commits after tools

- **WHEN** canonical answer 提交并且无 pending review
- **THEN** 时间线在原节点上收敛为完成摘要并折叠
- **AND** 最终回答正文保持原位

### Requirement: Pending review remains actionable across terminal state

Run 已提交答案或进入 completed 时，仍处于 pending_review 的工具步骤 MUST 保持展开且批准/拒绝入口可见；terminal 事件 MUST NOT 把该步骤误标为普通 done。

#### Scenario: Draft waits for approval

- **WHEN** 写工具返回待确认 draft 且 Run 已完成回答
- **THEN** 时间线保持展开
- **AND** 批准与拒绝入口仍指向原 draft

#### Scenario: Approval resolves later

- **WHEN** 用户批准或拒绝 draft
- **THEN** 只更新对应步骤与结构化动作状态
- **AND** 已提交回答正文不被重新渲染

### Requirement: Timeline tolerates duplicate and late events

执行过程 MUST 按 Run 序号幂等消费事件；重复或迟到的 progress/tool 事件 MUST NOT 重播动画、复位用户展开状态、覆盖新状态或改变滚动位置。

#### Scenario: Duplicate tool completed event

- **WHEN** 同一 seq 或同一已完成工具事件重复到达
- **THEN** 时间线 DOM 与状态保持不变

#### Scenario: Late pending event

- **WHEN** completed 之后到达较旧的 pending 事件
- **THEN** 工具步骤保持 completed
- **AND** 用户展开状态不变
