# 设计

## 决策摘要

1. 公共层统一上下文边界、执行身份、事件判定、批准语义和恢复保障；各 lane 保留自己的产品编排。
2. 复用现有模块，采用增量 DTO 和兼容 reader，不建设平行 Runtime。
3. Session message 是用户/助手正文事实源；Run event 负责过程，Task 负责业务生命周期，Artifact 负责交付，host receipt 负责确认和批准。
4. 新专家规划使用结构化结果并由主进程校验；旧任务继续使用现有文本分析器，只作为兼容 reader。
5. 用户确认的任务合同与 Agent 内部执行计划分别版本化，避免每次步骤调整都重新确认。
6. V2 事件一旦被识别，reducer 的拒绝结果是终局判定；只有真正的 legacy 输入才能进入 legacy fallback。
7. 取消冻结用户可见 Run 投影，但不丢弃已经发生的外部操作回执。

## 现有能力复用

| 关注点 | 现有事实源 | 本变更动作 |
|---|---|---|
| 模型/工具循环 | `agent-generate-runner.ts`、`agent-run-executor.ts` | 不替换；补充身份、阶段与恢复输入 |
| 上下文 | `context-engine/*`、`agent-context-finalize.ts` | 约束 phase 适用和持久化边界 |
| 输出协议 | `agent-output-protocol*.ts` | 保持 V2；增加可判定 reducer 结果及引用字段 |
| 消息投影 | `agent-message-state.ts`、`domain/agent-v2-runtime.ts` | 阻止被拒绝 V2 事件进入 fallback |
| 消息身份 | `AgentTurnIdentity`、`conversationMessageId` | 增量补充 task/root/parent/retry 关联 |
| Checkpoint | `agent-run-store.ts`、`agent-run-manager/recovery.ts` | 补齐 lineage、合同版本和 pending decision 引用 |
| 外部操作凭证 | `tool-execution-receipts.ts`、Run Store receipt | 统一恢复判定，不盲目重放 uncertain |
| 专家任务 | `expert-task-runtime.ts` | 接入结构化规划合同与消息引用 |
| 工作流 | `workflow-v2-runtime.ts`、`agent-team-workflow-runner.ts` | 保留 node attempt 和图语义，适配公共 identity/event 字段 |

## Lane 与公共内核

```text
Partner lane ─── direct turn / optional tools ─┐
Expert lane  ─── planning / task / review ─────┼─ AgentRunExecutor
Workflow lane ─ graph / node / gate / attempt ─┘  Context Engine
                                                   Output Protocol V2
                                                   Run Store / Receipts
```

公共内核不决定每个请求是否必须规划、是否存在正式 Task 或是否需要成果验收。lane adapter 负责把场景数据映射到公共执行身份、上下文 phase、权限 envelope 和输出协议。

## 执行身份

在现有 DTO 上增量提供以下关联，不要求每个 lane 填写所有字段：

```ts
interface AgentExecutionIdentity {
  lane: 'partner' | 'expert' | 'workflow'
  taskId?: string
  turnId?: string
  rootRunId?: string
  parentRunId?: string
  runId: string
  retryOfRunId?: string
  workflowNodeId?: string
  nodeAttempt?: number
  userMessageId?: string
  assistantMessageId?: string
}
```

约束：

- 普通伙伴对话可以没有 `taskId`。
- 纯工具或 gate 节点可以没有用户/助手消息 ID。
- 专家重试创建新 `runId` 并以 `retryOfRunId` 关联旧运行，不复用旧事件序号。
- 工作流继续使用 `rootRunId + workflowNodeId + nodeAttempt` 标识节点尝试；子 Run 使用 `parentRunId` 关联。
- 同一 Run 的 `seq` 单调；跨 Run 不比较序号。

## 单一事实源

| 事实 | 权威存储 | 允许的派生投影 |
|---|---|---|
| 用户与助手正文 | Agent Session message | 专家 feed、任务摘要、工作台时间线引用 message ID |
| Run 阶段与工具状态 | Run event log | 气泡执行过程、工作流节点状态 |
| 专家委托生命周期 | Expert Task Store | 首页卡片、任务房状态栏 |
| 工作流图和节点状态 | Workflow Run Store | 工作流时间线、任务区域 |
| 交付物正文与版本 | Artifact/Deliverable store | 摘要卡和验收列表 |
| 计划确认与工具批准 | 主进程 receipt/draft record | 确认按钮、审批卡状态 |

Task event 可以保存 `messageId`、摘要和审计元数据，但不能再保存一份可独立渲染的完整助手正文。兼容 reader 只根据 provenance/引用关系合并旧记录；相同文本不是删除依据。

## 上下文与阶段隔离

继续使用现有 `ContextBlock.kind/authority/sourceTrust/appliesTo`：

- 规划提示是 `scene_instruction`，仅适用于 planning phase。
- 正式执行重新装配 Context Draft，不复用规划轮的 system/scene prompt。
- Session 历史只持久化用户和助手可见消息及结构化引用，不持久化 host control block 正文。
- Task Store 只持久化由用户原始输入、用户补充和 host 校验结构生成的 task facts。
- 执行上下文包含原始目标、确认后的任务合同、最新用户修正、当前内部计划、有效权限、成果引用和未决事项。
- 附件、检索正文以及附件内的命令保持不可信 data，不可升级为控制指令。

ContextManifest 记录 block ID、phase、来源和省略原因，不记录敏感正文。若执行期出现 planning-only block，装配必须 fail closed 并记录诊断。

## 三个独立策略轴

```ts
type PlanningPolicy = 'direct' | 'confirm_plan'
type CompletionPolicy = 'automatic' | 'review'

interface ExecutionAuthorization {
  executionPolicy: 'no-tools' | 'read-only' | 'governed-tools'
  allowlist: string[]
  denylist: string[]
  resourceScopes: string[]
  approvalRequiredTools: string[]
}
```

- `planningPolicy` 决定是否在正式执行前形成并确认用户合同。
- `ExecutionAuthorization` 由 host 解析有效能力、范围和具体操作批准。
- `completionPolicy` 决定满足交付合同后自动结束还是等待成果验收。
- 任何一个轴的状态都不能推导另外两个轴已经满足。

伙伴默认由场景选择 direct；专家正式委托使用 confirm_plan；工作流由 package/node 契约决定是否有 gate。新专家委托继续默认 review。

## 结构化专家规划

新规划轮次使用版本化控制 envelope：

```ts
type ExpertPlanningOutcome =
  | {
      version: 1
      state: 'clarifying'
      displayText: string
      question: string
      missingFields: string[]
    }
  | {
      version: 1
      state: 'ready'
      displayText: string
      contract: ExpertCommissionContract
      internalPlan: ExpertExecutionPlan
    }
```

模型返回的是候选。主进程必须完成 schema、缺项、能力、交付合同和权限预检。解析失败、字段冲突、仍含未决问题或预检失败时，一律得到 `clarifying/blocked`，不能签发确认 receipt。`displayText` 作为唯一助手消息正文，控制 envelope 不进入 Markdown。

若 Provider 不支持原生结构化输出，运行时使用同一 JSON envelope 文本协议；只允许一次有界格式修复。修复仍失败时保存可读错误并保持待澄清，不回退为“从正文猜测 ready”。旧任务读取时继续使用 `analyzeExpertPlanningReply`，但重新规划后写入 v1 envelope。

## 用户合同与内部执行计划

```ts
interface ExpertCommissionContract {
  id: string
  version: number
  goal: string
  scope: string[]
  deliverables: DeliverableContract[]
  acceptanceCriteria: string[]
  externalTargets: string[]
  materialRefs: string[]
  riskClass: string
  fingerprint: string
}

interface ExpertExecutionPlan {
  version: number
  contractFingerprint: string
  steps: Array<{ id: string; title: string; status: string }>
  assumptions: string[]
  updatedAt: string
}
```

确认 receipt 只绑定 `taskId + expertId + contractFingerprint + policyVersion`。内部步骤、顺序和实现方法可以在同一合同下更新；目标、范围、交付物、验收条件、外部目标、材料边界或风险等级变化时必须生成新合同版本并重新确认。

计划确认只允许正式执行开始。具体写入继续绑定工具、参数 hash、目标资源、身份、有效期和当前范围；成果验收只改变 deliverable acceptance，不反向授权工具。

## V2 事件判定与消息归并

Reducer 返回明确 decision：

```ts
type ReductionDecision =
  | 'applied'
  | 'duplicate'
  | 'late'
  | 'frozen'
  | 'invalid'
  | 'unsupported_version'
```

- `applied`：使用 reducer state 更新同一个 assistant message。
- `duplicate/late/frozen/invalid`：记录有界诊断，不再进入正文 fallback。
- `unsupported_version`：进入可读协议错误态，未知 payload 不渲染。
- 只有没有 V2 envelope 的 legacy event，或 v2 reducer 模块确实不可用且输入来自声明的 legacy 通道时，才允许 legacy fallback。
- `answer.committed` 按 `runId + assistantMessageId + hash` 幂等提交；同一消息的恢复只执行 upsert。
- invoke 返回值只确认终态和标识，不携带第二份正文覆盖消息。

专家 attention/choice 只渲染动作；任务时间线引用 `assistantMessageId`，不再次生成相同正文气泡。

## 取消、重试与恢复

- 取消后禁止发起新模型、工具或子 Run；Run 用户可见投影冻结在 cancelled。
- 取消前已经派发的外部操作若返回迟到回执，host 继续保存 receipt，并标记 `executed/not_executed/uncertain`；该回执不能把 cancelled Run 改为 completed。
- 非幂等 `uncertain` 操作先查询 Provider 或请求人工核实，禁止盲目重试。
- Checkpoint 继续使用现有 `lastSeq` 校验，并增加 execution identity、合同版本、internal plan 版本、pending decision/draft refs 和 receipt refs。
- 恢复时以事件日志为准校验 checkpoint；不一致则进入 `resume_unsafe`，不自动继续。
- 专家重试使用新 Run 和 retry lineage；工作流节点重试继续使用 node attempt 和已有 side-effect guard。

## Partner 与 Workflow 适配

Partner adapter：

- 保留无正式 Task 的直接 turn。
- 继续使用现有 `AgentTurnIdentity` 和 assistant message upsert。
- 公共上下文和 reducer 改动必须通过普通聊天、工具回答、取消和恢复用例。

Workflow adapter：

- 保留 graph、root/child Run、node attempt、human/gate 和 checkpoint。
- Agent node 使用公共 Run identity 与 output events；LLM-only/tool-only 节点不虚构消息。
- gate approval 不映射为专家计划确认；node side-effect confirmation 不映射为成果验收。
- 子 Run 终态和迟到事件按 parent/child identity 投影，不能覆盖 root Run 或其他 node attempt。

## Electron、IPC 与持久化边界

- `src/shared/api.ts` 是新增 DTO 的唯一来源。
- Renderer 只能提交用户动作、原始输入和稳定 ID；不能提交“已批准”“已确认”来建立权限。
- 主进程生成和验证 planning outcome、receipt、event decision 所需权威数据。
- Preload 只暴露增量、可克隆 DTO；不传函数、AbortSignal、凭据或原始内部异常。
- 新字段保持 optional，旧 reader 保持确定性默认；新 writer 写入 contract/version 标记。

## 兼容、发布与回滚

1. 先交付 V2 reducer 判定修复和 phase 隔离，保持旧专家规划 writer。
2. 增加 `planningContractVersion=1` writer；旧任务按 legacy parser 读取，新规划轮次升级为结构化记录。
3. 专家 feed 改为 message reference 投影；旧事件继续通过 provenance 兼容合并。
4. Partner 与 Workflow 仅适配公共 optional 字段并运行回归，不改变各自 UX。
5. 观察稳定后移除专家新任务的正文 ready 推断；旧记录 reader 长期保留。

运行时提供短期本地开关回退新专家 planning writer，但安全边界、V2 重复事件拒绝和工具批准不能被开关撤销。所有新记录保留旧 reader 可读的 `displayText`、plan 摘要和原有状态字段，回滚不会使任务不可打开。

## 性能与内存

- 不增加额外模型调用；结构化格式修复最多一次且仅在专家规划解析失败时发生。
- 事件仅增加有界 ID 和 decision 元数据；不复制正文。
- checkpoint 只保存引用、版本和有界状态，不嵌入完整历史或 Artifact 正文。
- 工作流 event/checkpoint 继续遵守现有 500 事件和节点状态边界。
- 记录规划解析失败率、V2 被拒事件计数、重复消息抑制计数、恢复拒绝原因和 uncertain 操作数，不记录正文或凭据。

## 主要风险与控制

| 风险 | 控制 |
|---|---|
| 公共 reducer 修复影响普通聊天 | 同批运行 partner/expert/workflow reducer 回归 |
| 结构化规划被模型格式错误阻断 | 一次有界格式修复；失败保持可继续讨论的 clarifying |
| 合同 fingerprint 改变导致旧确认失效 | 只对新 planning contract 使用新算法；旧 receipt 不跨进程恢复 |
| 迟到外部回执被完全丢弃 | host receipt 独立保存；用户可见终态保持冻结 |
| 工作流被套用专家生命周期 | lane contract 测试禁止该映射 |
| 历史文本去重误删真实重复发言 | 只按 ID/provenance/reference 合并，不按纯文本 |

## 预计代码影响

- Shared/Domain：`src/shared/api.ts`、`src/shared/expert-planning-contract.ts`、`src/domain/agent-v2-runtime.ts`、`src/domain/expert-collab-plan.ts`、`src/domain/expert-collab-feed.ts`。
- Runtime：`src/lib/context-engine/*`、`src/lib/agent-message-state.ts`、`src/lib/agent-output-protocol*.ts`、`src/lib/agent-run-store.ts`、`src/lib/agent-run-manager/*`、`src/lib/expert-task-runtime.ts`、`src/lib/tool-execution-receipts.ts`。
- Lane adapters：`src/lib/agent-generate-*`、`src/lib/agent-team-workflow-runner.ts`、`src/lib/workflow-v2-runtime.ts`。
- Renderer：专家任务房、助手 store/stream reducer 和相关布局样式。
- Tests：消息协议、上下文 phase、专家计划确认、任务恢复、伙伴生成、工作流父子 Run 和 Electron 专家房 E2E。

开发修改任一函数前按仓库规则执行 GitNexus upstream impact；HIGH/CRITICAL 必须在实施记录中先报告再修改。
