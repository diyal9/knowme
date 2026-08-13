## ADDED Requirements

### Requirement: Session context update may override capability bindings

Session 上下文更新接口 MUST 允许在既有 `knowledgeRefs` 之外，更新本 Session 的技能与连接器绑定覆盖。覆盖 MUST 仅作用于该 Session 快照投影，MUST NOT 默认写回专家包磁盘。写入的 skill / connector id MUST 经主进程校验为已注册目录中的标识；未就绪项 MUST 以受限状态投影，不得静默授权或安装。

#### Scenario: Patch skill and connector bindings

- **WHEN** 客户端对某专家 Session 提交技能与连接器绑定覆盖
- **THEN** Session 持久化该覆盖并在后续 DTO / 工具装配中使用新绑定
- **AND** 专家包 EXPERT.md 保持不变

#### Scenario: Reject unknown capability ids

- **WHEN** 绑定覆盖包含未注册的 skill 或 connector id
- **THEN** 更新失败或忽略非法 id 并返回可理解错误/结果
- **AND** MUST NOT 把未知 id 当作已就绪能力暴露给工具面

#### Scenario: KnowledgeRefs patch remains supported

- **WHEN** 客户端仅更新 `knowledgeRefs`
- **THEN** 行为与既有 Session 知识范围更新一致

### Requirement: Session snapshot freezes Soul SOP and AgenticType

新建或绑定专家的 Session 快照 MUST 冻结该专家的 Soul、SOP（或兼容映射的 systemPrompt）与 `agenticType` 及其模式配置。Hub 内后续编辑 MUST NOT 静默改变已打开 Session 的上述快照内容。

#### Scenario: Snapshot includes agentic profile

- **WHEN** 用户以含 Soul、SOP、`agenticType=planning` 的专家创建协作 Session
- **THEN** 快照包含 Soul、SOP 与 planning 类型
- **AND** 之后在 Hub 修改该专家 SOP 不影响本 Session 已冻结内容
