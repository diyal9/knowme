# Design

Brain 是本地认知中枢，不是知识正文仓库。正文继续位于用户绑定目录、LLM Wiki 或外部 RAG；Brain 在 `%APPDATA%\KnowMe\knowledge-os\brain\` 保存结构化节点、事实、证据引用、Provider 目录、布局与提案。

`BrainStore` 是唯一持久化边界，使用原子 JSON 文件；`BrainService` 负责旧数据投影、邻域、解释、提案和查询。现有 Fabric Retrieval 作为兼容检索器接入，Provider Adapter 统一 Collection 列表和查询。

关系使用有状态、有证据的 Claim 表达。`observed`/`inferred` 只作为弱上下文，`confirmed` 才能驱动稳定个性化。外部检索结果默认是短期 Evidence；收藏保存引用，沉淀生成 Proposal。

Renderer 只消费 Brain DTO。服务端邻域继续保留两跳、100 节点安全上限；首页使用 24 / 42 / 72 / 100 四档可视密度，将确认后的本地认知投影为稳定主题簇。懂我视角只突出人物、偏好、目标和工作关系；当前工作围绕项目；知识版图显示本地认知主题簇与外围 Provider/Collection。外挂知识库文档不参与 Brain 聚类，只有用户确认沉淀后的认知才会进入主题。

画布采用 Obsidian 式点线与聚焦语言，同时遵循 KnowMe 共享的浅色主题，不使用持续抖动的无约束力导向。节点位置由稳定哈希、主题簇和确定性环布局共同决定；默认只显示根、主题、外部入口与当前焦点标签。普通关系保持低对比，选中路径高亮，其余节点降噪。画布支持滚轮缩放、拖拽平移、点击空白清除聚焦以及主题面包屑返回。

知识版图提供“星图 / 归类”两种表达。星图默认使用 42 节点预算，强调关系探索；归类模式使用 100 节点预算，以 Brain 为中心，将主题社区排布在外围。每个社区包含半透明范围底图、稳定分类色、主题名称与资料数量，资料节点采用确定性螺旋密排。两种表达复用同一 Brain 节点和 Claim，不创建第二份知识数据，也共享选择、解释、缩放和主题钻取交互。

本地挂载 LLM Wiki 与 RAGFlow、remote-rag 一样属于联邦知识源，而不是 Brain 内容。Brain 只持久化它的 Provider、Collection、文档数量和引用元数据；正文、文档节点和向量不进入 Brain。迁移版本 3 会幂等移除 v1/v2 自动生成的 Wiki/OKF concept、contains Claim 和对应 Evidence，也会忽略 Fabric 早期从 Wiki 路径自动种子化的 concept；用户主动收藏的外部引用与确认沉淀的本地认知保持不变，旧源文件不修改。

Brain Query 使用词法相关性作为候选召回，再以 Claim 确认状态、来源权威度、时效、相对当前焦点的图距离和冲突状态重排。返回值携带关系节点、关系标签、Claim 状态与解释；双节点关系链使用有界 BFS，只沿有证据且未失效的 Claim 查找最短路径。知识图谱因此同时参与检索、上下文装配与“为什么这样理解”，而不是单纯的画布装饰。

所有成长确认写入统一 `growth-ledger.json`。Brain effect 由 BrainService 执行，伙伴行为 effect 由 Partner Profile handler 执行，能力 effect 由 Capability Hub handler 执行；Ledger 只记录本地可逆状态与审计摘要。明确的“请记住”视为用户在当前动作中已经确认，其他观察、推断与成长建议仍进入待我确认。

Agent Knowledge Policy 在生成前由 Session、Profile 与已解析 Provider 范围交集得到。主查询、指定库查询和文档读取共用该结果；专业或隔离 Agent 不会装配个人 Memory，未授权 Collection 不可通过工具参数猜测访问。远程查询只接收脱敏问题，不接收完整 Brain、Memory 或对话历史。
