# Why

KnowMe 已能在能力中心保存个人专家，但官方/精选 Agent 的上下架仍依赖源码目录、迁移白名单和固定测试；现有自建专家只保存基础 persona 与绑定，缺少完整执行路线、权限、风险、质量复核、版本审计和可回滚生命周期。未来由伙伴或能力管家创建专业 Agent 时，不应再修改 KnowMe 源码。

# Target users

- 希望在 KnowMe 运行时创建、迭代和退役私人专业 Agent 的用户。
- 需要通过受控工具维护 Agent 的伙伴或能力管家。
- 需要保留历史任务可读性和版本证据的团队管理员。

# What Changes

- 新增统一 Runtime Agent Registry，复用现有 Capability Hub、Expert Runtime、任务快照和审批机制。
- 定义专业 Agent Definition：身份、Soul/SOP、Agentic 模式、Skill/Connector/知识绑定、输入输出、权限、风险、执行路线、交付合同与质量复核。
- 新增防陈旧 preview → confirm → commit 运维协议，支持 create、update、retire、restore、rollback。
- 保存不可变 revision 与审计记录；退役只阻止新任务并清理工作台/工作流引用，不破坏历史任务快照。
- 在主进程强制执行 lifecycle 门禁，Renderer 过滤不再是唯一防线。
- 提供受审批保护的 Agent Registry 工具和通用治理 Skill，伙伴或能力管家可复用。
- 能力中心“创建专家”收敛为结构化草稿入口，只采集职责、场景、边界、输入、交付和可选能力绑定，不在首屏暴露底层推理参数。
- 保存草稿后自动创建任务并进入 `能力管家` 协作房；后续定义调优、调试、评估、发布、回滚和下架沿用现有专家任务房与 Registry，不新建第二套执行引擎。
- 新增精选 `能力管家` 及当前配置资格题集；它也会主动判断需求应成为 Agent、Skill 还是工作流。
- KnowMe 版本升级到 0.5.0。

# Acceptance criteria

- 不修改 `src/catalog/experts/` 或 KnowMe TypeScript，即可通过运行时 API 创建一个包含完整专业合同的 Agent，并立即在工作台使用。
- Agent 变更必须先预览；防陈旧 token、显式批准、结构校验或依赖校验任一失败时不得写入。
- 退役 Agent 不再允许创建新任务或子 Agent Run，但既有任务仍可从冻结快照打开和继续查看。
- 更新会生成 revision；rollback 可恢复历史定义并再次生成审计记录。
- UI 创建、Agent 工具创建和导入后的 Agent 统一进入 Catalog Overlay、Install Store 和运行时目录。
- 草稿保存不得直接发布；只有在协作房完成验证、生成新预览并获得用户确认与宿主审批后才可 commit。
- 全量 `npm run check` 通过，新增注册表与工具测试覆盖创建、更新、退役、恢复、回滚、防陈旧和权限失败。

# Non-goals

- 不建设云端组织级 Agent 市场或跨设备同步。
- 不允许模型绕过用户审批发布高风险或有副作用的 Agent 变更。
- 不删除历史任务、任务快照或旧 revision。
- 不重写现有 Agent 执行器、Context Engine 或 Capability Hub。

# Product value

Agent 从“随应用发布的固定源码资产”升级为用户可运营、可验证、可回滚的运行时生产资料。KnowMe 可以在不发版的情况下持续增加专业角色，同时保留可信边界与历史可追溯性。
