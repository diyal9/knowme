## ADDED Requirements

### Requirement: Expert conversation exposes its working context

专家对话 MUST 以与通用助手一致的主栏对话（引导文案、Composer、快捷任务）呈现。专家多出的工作上下文（名称、来源/属性、职责或专业能力、已绑定技能与连接器状态、会话知识库范围）MUST 展示在对话主栏的右侧：工作台专家任务间使用右侧任务详情栏；助理专家会话使用对话卡右侧属性栏。用户 MUST 可在不离开对话的情况下调整可用知识库选择（Composer 工具栏）；选择变化 MUST 只影响该 Session 的后续检索。

#### Scenario: Expert task conversation opens

- **WHEN** 用户从工作台创建单专家任务并进入空对话
- **THEN** 左侧主栏呈现与助手一致的对话首屏（引导 + Composer 区 + 快捷任务），不堆叠属性卡
- **AND** 右侧任务详情展示当前专家身份、职责/专业能力、技能与连接器状态以及知识库范围
- **AND** Composer 邻近区域显示当前知识库范围和任务目标草稿

#### Scenario: Assistant expert conversation opens

- **WHEN** 用户在助理域打开专家 Session 空对话
- **THEN** 主栏保持助手式启动区，属性/能力/知识选择在对话框右侧栏展示

#### Scenario: Change knowledge selection in the conversation

- **WHEN** 用户在专家 Session 中打开知识库选择器并保存新的可用知识库
- **THEN** 当前 Session 的知识库范围立即更新并持久化
- **AND** 其他 Session 与全局默认知识库不受影响

#### Scenario: Knowledge catalog cannot be loaded

- **WHEN** 知识库列表暂时加载失败
- **THEN** 专家身份、技能和普通对话仍然可用
- **AND** 选择器显示可重试的受限状态而不是空白成功态
