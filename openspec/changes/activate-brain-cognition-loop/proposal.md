# Why

Brain 已具备确认写入、Growth Ledger 和撤销能力，但对话观察、Memory pattern 与伙伴教学仍存在多条入口。部分明确教学会绕过 Brain 直接写长期记忆，待确认页也无法完整说明证据、影响和撤销结果，因此“懂你”还没有形成统一、可解释的认知闭环。

# What Changes

- 新增本地 Cognition Observer，从明确的用户事实、偏好、目标、项目和决策表达中生成候选观察。
- 弱偏好先进入 Memory pattern，重复达到阈值后再同步成 BrainProposal；明确表达可立即生成提案，但仍不直接写入 Brain。
- 将个人伙伴的明确“记住”教学改为 Brain 提案，不再绕过用户确认。
- 使用稳定 fingerprint 去重；拒绝或已确认的相同观察不重复生成。
- 确认前编辑必须同步改写真正提交到 Brain 的节点与关系内容。
- 确认、拒绝 Memory pattern 时同步其审核状态；确认后写 Growth Ledger，并可从待确认页撤销。
- 待确认页增加分类、证据、影响说明和最近确认记录，确认后即时刷新 Brain 图谱。

# Acceptance Criteria

- 明确偏好或目标不会在用户确认前成为 confirmed Brain Claim。
- 同一观察重复出现只保留一个提案；拒绝后不会重新弹出。
- Memory pattern 未达到重复阈值时不进入待确认，达到阈值后只出现一次。
- 修改提案内容后确认，Brain 中保存修改后的内容，而不是原始观察。
- 确认后图谱立即出现新节点，Growth Ledger 可撤销并移除相应节点与关系。
- 待确认卡片能说明发现内容、判断依据、来源证据和确认后的影响。
- 敏感内容、一次性对话、关闭学习或非个人 Agent 默认不产生认知提案。

# Non-goals

- 不使用远程 LLM 分析完整对话历史。
- 不自动确认任何长期认知。
- 不把外部 RAG 命中直接提升为长期 Brain。
- 不替换现有 Memory 文件或 Brain 原子 JSON 存储。
