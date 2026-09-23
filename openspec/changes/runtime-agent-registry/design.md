# Design

## Authority boundary

主进程拥有 Agent Registry、包写入、revision、生命周期与审批状态。Renderer 只能提交定义并展示预览；模型提供的 `confirmed`、风险级别或 lifecycle 字段不构成授权。Agent 工具继续复用 Tool Contract Registry 的主机审批。

## Data flow

```text
UI / Partner / 能力管家
  → saveAgentDraft(structured attributes)
→ 能力治理任务房（调优 / 调试 / 评估）
  → previewAgentChange(definition/action)
  → schema + professional quality + dependency + risk validation
  → opaque change token bound to current Agent hash
  → explicit user approval
  → commitAgentChange(token)
  → Expert package + capability sidecar
  → Install Store + Catalog Overlay + revision journal
  → Workbench projection / runtime lifecycle gate
```

运行时目录继续使用 `%APPDATA%/KnowMe/capabilities/experts/<id>/`。Registry revision 存放在 capabilities 下的独立 registry 目录，不进入应用源码。Catalog Overlay 保存展示和 lifecycle，Install Store 保存安装与启用状态。

草稿以 `agent-registry/<id>/draft.json` 保存，和应用源码、精选目录及已发布 revision 分离。草稿可反复更新且不需要发布审批；发布仍必须使用一次性 preview token。成功 create/update/rollback 后只更新草稿的发布状态和 revision 引用，不删除草稿。

创建弹窗只负责低认知成本的结构建档。保存后幂等安装 `agent-operations` 及其必需 Skill，再创建一个 `expertId=agent-operations` 的 draft 任务，并通过现有 `openExpertRoom` 打开协作房。安装或建房失败时已保存草稿保持可恢复。能力管家通过同一任务目标中的 draft id 读取草稿；房间、消息、任务状态、成果物和验收全部复用通用专家协作能力。

## Professional definition

专业定义包含：

- `id/name/description/version/avatar`
- `soul/sop/agenticType/agenticConfig`
- `skills/connectors/optionalConnectors/knowledgeRefs`
- `useCases/boundaries/inputs/outputs`
- `permissions/risk`
- `execution.strategy/routes/deliverables/qualityReview`
- `lifecycle.state/newTasks/successors`

质量门禁要求明确任务范围、边界、输入、输出、至少一条可读执行路线、依赖闭包、权限白名单和质量复核标准。结构合格不等于专业资格已认证；新建或实质更新后 qualification 标记为未验收。

## Lifecycle

- `active`：允许新任务。
- `deprecated`：可见但提示替代项；是否允许新任务由 `newTasks` 决定。
- `retired`：`newTasks=false`，主进程拒绝新任务与子 Run，保留包和历史快照。
- `restore`：恢复 active，但仍按当前依赖和 qualification 检查。

硬删除继续只用于用户明确删除自建 Agent；常规下架使用 retire。

## Revisions and rollback

每次成功 commit 保存不可变 revision，记录 action、definition、content hash、previous hash、时间与调用来源。rollback 本身也是新 revision，不覆盖审计历史。preview token 绑定当前 hash；提交前 hash 变化则返回 stale。

## IPC and tools

Capability Hub 暴露 draft get/save、preview、commit、verify、list revisions。Agent 工具只在任务执行合同声明对应 requiredTools，或用户显式启用运维 Skill 时投影。草稿更新是本地、可逆、未发布写入；commit 是发布副作用，必须进入现有审批机制。

## Agent evaluation

能力管家采用 DeepEval 的 test case / metric / dataset-run 模型，但评估控制面仍由 KnowMe 主进程持有：

- 评估集保存在 `capabilities/agent-registry/<id>/evaluations/suites/`，报告保存在 `runs/`，并绑定草稿或 revision 的 definition hash。
- 指标按端到端、组件和轨迹三种范围声明。当前运行时适配端到端与组件指标；没有真实 trace 时不得把消息历史伪装成 DeepEval trajectory。
- `text_assertions`、`tool_correctness`、`tool_permission` 可本地确定性运行；G-Eval、answer relevancy、faithfulness、hallucination、argument correctness 通过固定 Python bridge 调用真实 DeepEval。
- bridge 只接受 JSON 数据并执行 allowlist 指标，不接受代码或凭据；standalone `metric.measure` 默认只落本地报告，不要求 Confident AI 云端。
- DeepEval 缺失时语义指标 fail closed。用户明确批准后，`setup_agent_eval_runtime` 可在用户数据下创建隔离 venv 并安装 DeepEval；不修改 KnowMe 源码或系统 Python。
- `run_agent_eval` 可能调用外部裁判模型并消耗 token，因此必须经过宿主审批。凭据只来自本地运行环境，不进入工具参数、评估集或报告。
- 发布前的 scenario regression gate 要求 normal×2、edge、retry、revision、reopen 覆盖、当前配置 hash 一致、所有 required 指标通过且无 blocked；通过仍只表示冻结场景回归，不授予独立专业认证。

## Compatibility

现有 curated Agent 仍从 bundle 安装；Runtime Registry 可用 overlay 对其执行本地 retire/restore，不修改 bundle。现有个人 Agent 首次读取时按兼容默认值补全，编辑后写入 schema v3 sidecar。历史任务继续优先读取 session snapshot。
