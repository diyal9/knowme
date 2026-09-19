# Design

## Observation boundary

`brain-cognition` 只分析当前用户消息，采用保守、确定性的表达规则提取明确事实、偏好、目标、项目和决策。它不读取助手答案，不发送完整 Brain 或历史对话到远端。敏感字段、一次性会话、学习关闭和未授权 Agent 在入口处拒绝采集。

## Proposal identity and evidence

候选项由规范化内容、类型和范围生成稳定 fingerprint，并进一步生成稳定 Proposal、Evidence、Node 和 Claim ID。Evidence 只保存当前消息中的必要短句、session/run 引用与内容哈希。重复观察更新出现次数，不创建第二张卡片；rejected/confirmed 状态具有抑制作用。

## Memory bridge

弱偏好继续由 Product Memory 累计。`syncMemoryProposals` 只读取达到阈值且仍为 pending 的 pattern，投影成统一 BrainProposal。确认或拒绝时通过 Brain IPC context 回写 `accepted/dismissed`，避免 Memory 与 Brain 两处重复审核。

## Commit and undo

确认按 Evidence → Node → Claim 顺序提交。若用户修改摘要，提交前同步替换 Effects 中的 label、summary 与 claim value。提交完成后记录带 reverseEffects 的 Growth Ledger；撤销按逆序恢复或删除实体，并保留 reverted 审计记录。

## UI

待确认页按关于我、项目与决策、知识关系、冲突与过期、能力成长筛选。详情区使用产品语言展示“发现内容、为什么、来源、会影响什么”；底部展示最近确认项及撤销入口。操作完成后重新加载 Proposal、Growth Ledger 与 Brain Snapshot。
