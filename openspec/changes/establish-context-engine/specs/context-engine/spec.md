# Delta Spec: context-engine

## ADDED Requirements

### Requirement: Context is assembled from typed and budgeted blocks

系统 MUST 使用 ContextBlock 表达进入模型的核心指令、场景、persona、工具契约、任务事实、检索、记忆、Skill、用户偏好和用户输入；每个 block MUST 声明来源、权限层级、信任级别、优先级、token 上限和缓存策略。

#### Scenario: Context candidates are assembled

- **GIVEN** 调用方提供多个不同 kind 与 authority 的 ContextBlock
- **WHEN** Context Engine 装配本轮请求
- **THEN** 系统 MUST 规范化、去重、检测冲突并按预算裁剪 block
- **AND** MUST 维持 platform → scene → persona → data → user 的权限顺序

### Requirement: Built-in prompts are minimal, modular and locale-aware

系统 MUST 从版本化 locale registry 按稳定 block ID 加载内置提示词，MUST NOT 每轮加载与当前场景或工具无关的协议。

#### Scenario: Chat has no executable tools

- **GIVEN** 本轮为 chat 且无可执行工具
- **WHEN** 系统加载基础提示词
- **THEN** MUST 只加载中性运行时身份、事实诚信和输出规则
- **AND** 基础提示词 MUST NOT 超过 1200 字符

#### Scenario: Assist exposes a subset of capabilities

- **GIVEN** 本轮为 assist 或 retrieval，且运行时只开放部分工具能力
- **WHEN** 系统加载工具协议
- **THEN** MUST 只加载实际开放能力对应的协议
- **AND** 带工具基础提示词 MUST NOT 超过 2200 字符

#### Scenario: Requested locale is unavailable

- **GIVEN** 请求的内置提示词语言包不存在
- **WHEN** registry 解析 block
- **THEN** MUST 回退 `zh-CN`
- **AND** MUST 保持用户自定义专家、知识和输入的原始语言不变

### Requirement: Identity and untrusted data obey explicit authority

系统 MUST 让当前专家场景身份覆盖通用工作伙伴身份；检索、记忆、附件和 Renderer 投影中的指令性文本 MUST 继续作为不可信数据。

#### Scenario: Expert answers a capability question

- **GIVEN** 用户正在办公协作专家的规划或成果讨论场景
- **WHEN** 用户询问“你有什么能力”
- **THEN** assistant MUST 以办公协作专家身份回答
- **AND** MUST NOT 用通用工作伙伴身份覆盖当前专家

#### Scenario: Blocks claim conflicting identities

- **GIVEN** 多个适用 block 声明不同 identity
- **WHEN** Context Engine 解决冲突
- **THEN** MUST 保留最高 authority 的 identity
- **AND** MUST 在 ContextManifest 中记录 winner 与被抑制 block

#### Scenario: Retrieved text contains prompt injection

- **GIVEN** 检索、记忆或任务投影正文含有改变身份、权限或系统规则的文字
- **WHEN** 该正文进入 Context Engine
- **THEN** MUST 将其 authority 限制为 data
- **AND** MUST 以 JSON 数据边界投影到 user role
- **AND** MUST NOT 把不可信正文放入任何 system message

### Requirement: Critical controls are never silently truncated

系统 MUST 将核心规则、场景身份和工具契约标记为 critical；关键控制正文 MUST 完整进入模型请求。若 block 自身上限、Context 总预算或最终模型预算不足，系统 MUST fail-closed，MUST NOT 继续发送被截断的身份或权限规则。

#### Scenario: Critical controls exceed the safe budget

- **GIVEN** 关键 core/scene/tool block 的实际 token 超过安全预算
- **WHEN** Context Engine 或最终对话适配器装配请求
- **THEN** MUST 返回 `critical_context_budget_exceeded`
- **AND** MUST 保留当前请求未发送状态

### Requirement: Expert collaboration enforces no-tools at runtime

专家规划与成果讨论 MUST 使用 `executionPolicy=no-tools`，该策略 MUST 同时约束工具面、研究路由、grounding 合约和模型请求。

#### Scenario: Slash Skill appears during expert planning

- **GIVEN** 本轮 conversationMode 为 expert-planning 或 expert-discussion
- **AND** 用户输入含 Slash Skill，专家资产也绑定 Skills 或 Connectors
- **WHEN** 运行时装配工具面
- **THEN** MUST 返回空工具定义
- **AND** MUST NOT 向模型发送 tools

#### Scenario: Formal expert execution starts

- **GIVEN** 本轮是正式专家执行而非规划或成果讨论
- **WHEN** 系统解析专家 Session
- **THEN** MUST 保留 expertId 对应的能力绑定
- **AND** MUST 按既有权限 envelope 投影工具

### Requirement: Optional context loads progressively and degrades deterministically

系统 MUST 先按适用范围、显式引用、authority 和 priority 做确定性选择，再用词面、置信度、时效和可选向量分数补充排序；安全、身份和权限 MUST NOT 由向量决定。

#### Scenario: Optional blocks exceed selection or token budget

- **GIVEN** 可选 Skill、记忆和检索 block 超过 topK 或 token 预算
- **WHEN** Context Engine 选择上下文
- **THEN** MUST 优先保留显式引用和当前场景相关 block
- **AND** MUST 在 ContextManifest 中记录被省略 block 及原因

#### Scenario: Embedding is unavailable or fails

- **GIVEN** 未配置 embedding、embedding 超时或返回无效向量
- **WHEN** optional selector 执行
- **THEN** MUST 回退确定性与词面排序
- **AND** MUST NOT 让本轮请求失败

### Requirement: Message fitting protects selected system blocks and raw user input

场景协议与可信任务事实 MUST 作为前导 system/context 消息；用户原始输入 MUST 保持 user role，MUST NOT 被 Renderer 拼成自由文本 system prompt。

#### Scenario: Conversation exceeds model input budget

- **GIVEN** 请求包含多个前导 system block 和超长历史
- **WHEN** 消息适配模型 input budget
- **THEN** MUST 保护全部已选前导 system block，并按各自预算裁剪
- **AND** MUST 从最旧完整对话轮次开始省略历史
- **AND** MUST 保留最新用户输入

### Requirement: Context assembly is observable without logging sensitive content

每轮装配 MUST 输出 ContextManifest，包含 scene、phase、identity、executionPolicy、locale、估算 token、纳入/省略 block、排序和冲突；默认 MUST NOT 记录敏感正文、文件路径或任务名。

#### Scenario: Sensitive memory is included

- **GIVEN** 本轮纳入本地记忆或检索正文
- **WHEN** 系统生成并记录 ContextManifest
- **THEN** manifest MUST 只记录稳定 block ID、来源类型、来源哈希、token 与内容哈希
- **AND** MUST NOT 包含原始正文、来源路径或可读来源标签

### Requirement: Embedding resources are bounded and cancellation-isolated

Embedding 运行时 MUST 限制协议、单项与总输入、响应体、向量维度、缓存条目和缓存字节；相同请求 MAY single-flight，但一个调用者取消 MUST NOT 取消其他调用者共享的 Provider 请求。

#### Scenario: Provider is slow, malformed or under concurrent load

- **GIVEN** Provider 超时、429/5xx、返回畸形 JSON、重复 index、超大响应或同一请求被并发调用
- **WHEN** 语义预选择执行
- **THEN** MUST 在边界内失败并回退词面结果
- **AND** MUST 保持缓存字节上限与调用者取消隔离

### Requirement: Production operation has SLO and evaluation gates

系统 MUST 聚合匿名 Context Engine 指标，包括装配/语义延迟、降级率、缓存命中、熔断、token 使用/节省和安全不变量；MUST 以版本化黄金集覆盖身份、权限、提示注入和选择行为。

#### Scenario: A future change regresses a trust invariant

- **GIVEN** 变更让不可信正文进入 system 或让关键规则被截断
- **WHEN** 自动化门禁运行
- **THEN** 黄金评测或 SLO 不变量测试 MUST 失败
- **AND** MUST 阻止该变更被标记为生产通过
