# Delta Spec: agent-chat-ux

## ADDED Requirements

### Requirement: Task cards run a deterministic preflight before invoking the model

系统 MUST 在四模式任务卡片发送前做确定性准入判断；当必需内容缺失时 MUST 用一句固定文案询问，MUST NOT 在缺内容时调用 LLM 生成回答。

#### Scenario: Missing material for writing or coding task

- **GIVEN** 用户处于写作或编程模式且输入框为空、未选附件
- **WHEN** 用户点击需要素材的任务卡片（如"写办公文档""解释代码"）
- **THEN** 系统 MUST 在聊天区推送一句话询问所需素材
- **AND** MUST NOT 调用 LLM，也 MUST NOT 产出任何任务结果
- **AND** MUST 暂存该任务，聚焦输入框

#### Scenario: Missing Feishu authorization for connector task

- **GIVEN** 飞书连接器未启用或 user 身份未授权
- **WHEN** 用户点击依赖飞书的通用任务卡片（会议总结 / 今日优先级 / 查文档知识库 / 分析相关聊天）
- **THEN** 系统 MUST 一句话提示前往"设置 → 连接器"授权飞书
- **AND** MUST NOT 调用 LLM

#### Scenario: Resume task after providing material

- **GIVEN** 系统因缺素材已一句话询问并暂存了某任务
- **WHEN** 用户在输入框补齐素材后直接发送
- **THEN** 系统 MUST 自动带上原任务指令继续执行，无需再次点击卡片
- **AND** 用户提供的素材 MUST 被并入任务 prompt

#### Scenario: Preconditions satisfied

- **GIVEN** 素材已就绪或飞书已授权
- **WHEN** 用户点击对应任务卡片
- **THEN** 系统 MUST 走增强执行路径直接开工，不做多余追问

### Requirement: Empty-state cards and quick menu share one preflight path

系统 MUST 让空态卡片与快捷菜单在触发同一任务时，走一致的准入与执行路径。

#### Scenario: Quick menu triggers a known task

- **GIVEN** 用户通过 `Ctrl/Cmd+K` 快捷菜单触发某个已登记任务
- **WHEN** 该任务命中 preflight 配置
- **THEN** 系统 MUST 复用与空态卡片相同的一句话询问与增强执行逻辑
