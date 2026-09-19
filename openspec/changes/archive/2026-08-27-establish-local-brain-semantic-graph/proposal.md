# Why

KnowMe 已具备本地 LLM Wiki、OKF、Memory、Knowledge Fabric 与远程 RAG，但它们分别表达资料、个人记忆、关系路由和外部检索。用户无法看到 KnowMe 对自己的整体理解，Agent 也缺少统一、可解释、可授权的 Brain 查询入口。

# What Changes

- 新增本地 BrainStore，以节点、事实、证据和提案统一投影 Knowledge、Memory、Fabric 与工作上下文。
- 新增联邦知识目录与查询层；外挂 LLM Wiki、文件夹、GitLab、RAGFlow 和远程 RAG 只同步目录/锚点并按需检索，不全量复制正文。
- 将稳定认知写入 Brain、行为变化写入伙伴 Profile、能力变化写入 Capability Hub；所有长期变化先进入统一确认队列。
- Agent 通过 Knowledge Policy 读取授权 Brain 范围与 Provider Collection，并获得带来源和解释的混合检索结果。
- 将知识网首页升级为 Brain 图谱，保留资料树作为二级视图，并在伙伴设置中只保留记忆/成长策略。

# Acceptance Criteria

- 旧 Fabric、Memory、Wiki/OKF 和 Provider 元数据可幂等迁移，失败时不破坏旧数据。
- 每条长期关系都有证据；推断不会被表达为确认事实；确认、拒绝、忘记均可追踪。
- 外部 Provider 正文默认不进入 Brain；外部命中带 Provider、Collection 和文档引用。
- Agent 只能检索 Knowledge Policy 授权范围；远程查询不携带完整个人 Brain 或对话历史。
- Brain 首页支持懂我、当前工作、知识版图三种视角，图谱/资料切换、节点解释和统一确认。
- Brain 或外部 Provider 不可用时，现有本地资料浏览和检索可降级继续工作。

# Non-goals

- 不引入原生图数据库、SQLite、3D 图谱或全量远程知识镜像。
- 不让 Agent 绕过用户确认直接写入长期认知。
- 不删除旧 Fabric、Memory 或知识文件。

