## ADDED Requirements

### Requirement: Expert task Session persists its launch context

由工作台单专家任务创建的 Session MUST 持久化任务标识、初始目标和会话级知识库引用，并 MUST 通过安全 DTO 返回专家 persona、能力绑定、就绪状态和知识库投影。Session 恢复时 MUST 使用原专家快照与已保存的任务上下文。

#### Scenario: Create Session with task context

- **WHEN** 工作台为专家任务创建 Session 并提供目标、任务标识与知识库引用
- **THEN** Session 持久化这些字段并冻结专家 persona 与能力绑定快照
- **AND** Renderer 可读取经过裁剪的专家、技能、连接器和知识库展示信息

#### Scenario: Restart restores task context

- **WHEN** 应用重启后恢复该专家 Session
- **THEN** 原任务标识、目标和知识库引用保持不变
- **AND** 专家 persona 和绑定能力继续来自 Session 快照

#### Scenario: Unavailable knowledge reference is projected as limited

- **WHEN** Session 保存的某个知识库后来被删除或不可用
- **THEN** Session 仍可恢复和进行普通对话
- **AND** 该知识库在投影中标记为受限且不进入可执行检索范围
