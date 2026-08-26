# Why

KnowMe 当前把产品身份、场景规则、专家 persona、工具协议、记忆与检索结果分散在多条拼接链路中。结果是基础提示词持续膨胀、专家身份可能被通用“工作伙伴”覆盖、讨论阶段的禁用工具主要依赖提示词表达，且无法解释每轮上下文为何被纳入或丢弃。

# Target Users

- 使用普通工作伙伴、专家协作、知识检索与工具执行的 KnowMe 用户。
- 需要新增专家、Skill、连接器、语言包和上下文来源的产品开发者。

# What Changes

- 新增统一 Context Engine，以结构化 ContextBlock 表达指令、persona、任务事实、记忆、检索与用户输入。
- 按场景、阶段、工具权限和 token 预算渐进加载提示词与上下文，并输出可观测 manifest。
- 将内置系统提示词迁移到版本化 `zh-CN` 注册表，精简重复身份、工具和输出规则。
- 将专家 persona 与执行权限解耦；专家规划/成果讨论保留专家身份，但在运行时强制空工具面。
- 保持用户原始消息为 user 消息；只有可信控制规则进入 system，检索、记忆、附件与 Renderer 事实投影统一进入低权限 user 数据区。
- 为可选规则、Skill、记忆和知识保留词面/向量混合选择接口，复用已有 semantic-index；无 embedding 时稳定降级。
- 接入 OpenAI-compatible Embedding API 作为可插拔语义选择器；知识检索重排与 Context Engine 选择独立开关，支持继承主模型凭据或单独配置。
- 对候选向量做内容哈希缓存、请求合并、短超时、熔断和 shadow 模式，且默认不向独立 Embedding 服务发送敏感上下文正文。
- 升级消息裁剪，对关键控制块实行不可截断预算与 fail-closed，并记录裁剪或拒绝原因。
- 增加字节受限向量缓存、输入/响应上限、取消隔离、聚合 SLO、黄金评测和双 Provider canary。

# Acceptance Criteria

- 办公专家被问“你有什么能力”时，以“办公协作专家”身份回答，不自称通用工作伙伴。
- 专家规划和成果讨论即使出现 Slash Skill 也不装配任何工具。
- 普通助手、正式专家执行、知识检索和连接器执行保持原有能力。
- chat 基础提示词不超过 1200 字符；带工具基础提示词不超过 2200 字符。
- 每轮可获得 ContextManifest，包含身份、执行策略、纳入/丢弃 block、估算 token 与冲突。
- 内置提示词支持 locale fallback；缺少语言包时回退 `zh-CN`。
- 上下文选择、权限隔离、消息裁剪和专家协作均有自动化回归测试。
- Embedding 不可用、超时、熔断或返回非法向量时，本轮 MUST 使用确定性词面结果继续执行。
- shadow 模式 MUST 只记录匿名比较结果，不改变实际入选 block；active 模式也不得影响身份、权限与必选 block。
- 不可信正文 MUST NOT 以 system role 发送；关键身份、权限和场景规则预算不足时 MUST 拒绝请求而非静默截断。
- Context Engine MUST 提供匿名聚合指标，并由黄金身份/权限/注入评测作为自动化硬门禁。

# Non-goals

- 本轮不捆绑新的本地 embedding 模型或原生推理运行时。
- 不把内置提示词迁移到数据库或开放远程热更新。
- 不自动翻译用户自定义专家、知识库或附件内容。
- 不改变正式专家任务、工作流和管线服务的业务状态模型。

# Impact

主要影响主进程请求准备、Agent Session、工具面、消息预算与专家协作渲染调用。通过兼容 facade 保留现有 `buildSystemContent`、`assembleCorePrompt` 等公共接口，降低迁移爆炸半径。
