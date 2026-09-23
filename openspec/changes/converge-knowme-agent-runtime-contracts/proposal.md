# KnowMe 通用 Agent 链路契约收敛

## 目标用户

- 在伙伴对话中直接完成知识工作的用户。
- 通过专家协作提交正式委托、确认计划和验收交付物的用户。
- 运行本地工作流、人工节点和 Agent 节点的用户。
- 维护 Agent Runtime、工作台和恢复机制的开发与测试人员。

## Why

专家协作已经暴露出同一类底层问题：规划阶段的宿主指令可能进入后续执行材料，同一回答可能由 Session message、任务事件和注意事项重复投影，计划确认、工具批准和成果验收容易混为一个“确认”，恢复与迟到事件也缺少跨场景的一致判定。

KnowMe 已经具备 Context Engine、AgentRunExecutor、Agent Output Protocol V2、稳定消息 ID、Run checkpoint、工具执行凭证和工作流父子 Run。本变更在这些能力上补齐公共契约，并以专家协作作为首个完整接入场景。伙伴和工作流继续保留各自的产品语义，但公共契约发生变化时必须同步通过兼容回归。

## 产品价值

- 用户确认专家计划后，Agent 能进入真实执行，不再重复规划阶段话术。
- 同一回答在刷新、恢复和事件重放后仍只显示一次。
- 用户能区分“同意计划”“批准具体操作”和“接受交付成果”。
- 取消、重试和应用重启后不会盲目重放外部副作用。
- 公共能力在伙伴、专家和工作流之间保持一致，减少场景各自打补丁造成的漂移。

## What Changes

### 通用运行契约

- 明确 Task、Turn、Run、工作流 node attempt 和消息 ID 的关系；扩展现有 DTO，不替换现有 Session 与 Run Store。
- 让规划、执行、讨论等宿主控制块按现有 `ContextBlock.appliesTo.phases` 生效，并禁止宿主控制文本被持久化为用户事实。
- 为 V2 事件 reducer 定义可判定的处理结果；重复、迟到、终态后和无效事件不能再通过 legacy fallback 改写正文。
- 明确 Session message、Run event、Task、Artifact 与 host approval 的事实源；派生视图只能引用权威记录。
- 将规划策略、执行权限/批准和完成策略分开建模。
- 在现有 checkpoint、事件日志和工具执行凭证上补齐重试 lineage、取消围栏、迟到回执与不确定结果恢复。

### 专家首批接入

- 新规划轮次产出经主进程校验的结构化规划结果；解析或校验失败时保持待澄清，不能显示确认入口。
- 将用户确认的任务合同与 Agent 可调整的内部执行计划分开；只有目标、范围、交付物、验收、外部目标或风险变化才使计划确认失效。
- 计划确认继续使用短时、一次性、host-issued receipt；具体外部写入继续使用工具草稿批准。
- 专家任务房使用 Session message 作为回答正文事实源，任务事件和等待卡只引用消息或呈现动作。
- 修复目标截图中的重复回答、标题/侧栏溢出以及确认后仍停留在规划状态的问题。

### 其他 lane 的兼容

- 伙伴继续使用直接对话与可选工具循环，不强制创建正式 Task 或确认计划。
- 工作流继续使用图、父子 Run、节点 attempt、人工节点和 gate；不套用专家委托生命周期。
- 公共字段和 reducer 行为变化必须对伙伴和工作流增加回归，确保 lane 隔离与现有执行结果不变。

## 验收标准

- 规划阶段的宿主指令不会出现在 Task facts、用户材料或正式执行 prompt 中；用户真实约束仍被保留。
- 同一 `assistantMessageId` 的流式、最终提交、恢复和任务引用只产生一个回答气泡。
- V2 重复、迟到、终态后或无效事件被明确忽略，不会触发正文 fallback。
- 待澄清规划不会获得确认凭证；结构化且经 host 校验的计划才能确认。
- 用户合同未变化时，Agent 调整内部步骤不要求再次确认；范围、交付物、验收、外部目标或风险变化时必须重新确认。
- 计划确认不能授权具体工具写入，工具批准也不能自动接受成果。
- 取消后不再派发新模型或工具工作；已经发生的外部操作回执仍可保存并标为已执行或待核实，不能改变已冻结的用户可见终态。
- 重启恢复校验 checkpoint 与事件日志一致，未知结果的非幂等操作不会自动重放。
- 伙伴直接回答、专家正式委托、工作流父子 Run 和人工 gate 的专项回归全部通过。
- 目标桌面场景只显示一条回答，长标题和右侧信息完整可读；刷新与重启后保持一致。
- `npm run check`、`npm run typecheck:lib`、专项 OpenSpec gate 与真实 Electron 桌面验收通过。

## Non-goals

- 不重写 Context Engine、AgentRunExecutor、Run Store 或 Workflow V2 Runtime。
- 不强制伙伴、简单只读请求或工作流节点都经过专家式规划确认。
- 不建立一套覆盖所有场景的统一产品生命周期状态机。
- 不新增独立规划模型调用、远程语义服务或图数据库。
- 不在本变更中重做历史摘要/检索算法；只保证现有压缩和 checkpoint 不丢关键身份、约束与回执引用。
- 不按正文相同批量删除历史消息，不破坏性迁移 `%APPDATA%\KnowMe\` 数据。
- 不改变新专家委托当前默认 `completionPolicy=review` 的产品决定。
- 不以模拟回执替代真实桌面展示验收，也不在未授权资源上执行真实外部写入。

## 依赖与冲突处理

- 复用 `establish-context-engine` 的 ContextBlock、权限和预算契约。
- 复用 `unify-agent-capability-context-runtime` 的执行治理、checkpoint 与不确定写入规则。
- 复用 `harden-expert-plan-confirmation` 的短时一次性确认凭证，在此基础上分离用户合同与内部执行步骤。
- 复用 `fix-agent-display-contracts` 当前的 review 默认策略和专家房显示约定；本变更不采用早期 automatic 默认。
- 复用 `complete-workflow-v2-runtime-and-collaboration` 的工作流父子 Run、node attempt 与 gate，不改变其编排语义。

## Definition of Ready

本变更进入 `/opsx:apply` 前必须满足：设计决策无待选项；每项任务不超过两小时；每项任务标注对应 requirement；文件影响和测试入口明确；旧数据兼容、回滚方式、故障注入和真实桌面验收都有可执行步骤。
