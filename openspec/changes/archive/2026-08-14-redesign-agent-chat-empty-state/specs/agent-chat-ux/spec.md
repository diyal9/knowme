## ADDED Requirements

### Requirement: Agent conversation switches between launch and chat states

Agent 对话 MUST 根据当前 Session 是否存在消息或产物，在任务启动态与会话态之间确定性切换。任务启动态 MUST 使用同一个真实 Composer；进入会话态后 Composer MUST 回到底部，输入草稿、附件、模型选择与事件绑定 MUST 保持不变。

#### Scenario: Empty session uses launch state

- **WHEN** 当前 Agent Session 没有消息且没有产物
- **THEN** 页面 MUST 展示任务启动态
- **AND** Composer MUST 位于标题说明与快捷任务之间

#### Scenario: First send enters chat state

- **WHEN** 用户在任务启动态发送首条消息或触发会自动发送的快捷任务
- **THEN** 页面 MUST 切换为消息列表与底部 Composer 的会话态
- **AND** 用户输入、附件、模型选择和任务执行语义 MUST 与既有发送链路一致

#### Scenario: Composer controls stay visually consistent

- **WHEN** 用户比较任务启动态与会话态的 Composer
- **THEN** 附件与发送按钮 MUST 使用相同的图标、尺寸和中性按钮样式
- **AND** 任务启动态 MUST NOT 为发送按钮添加独立粉色底板

#### Scenario: Session switching restores the correct state

- **WHEN** 用户切换 Agent Session
- **THEN** 空 Session MUST 恢复任务启动态
- **AND** 有消息或产物的 Session MUST 保持会话态

### Requirement: Chat roles have clear visual alignment

会话态 MUST 将用户消息显示在右侧轻量气泡中，并将助手回复显示在左侧阅读轨道中。助手的执行过程、结构化结果、Markdown 和动作区 MUST 继续保持完整可读。

#### Scenario: User message is distinguishable

- **WHEN** 会话中渲染用户消息
- **THEN** 用户消息 MUST 右对齐
- **AND** 宽度 MUST 随内容收缩并设置合理的最大宽度

#### Scenario: Assistant message remains readable

- **WHEN** 会话中渲染助手回复
- **THEN** 助手回复 MUST 左对齐并使用稳定阅读轨道
- **AND** 长 Markdown、执行轨迹与结构化 UI MUST NOT 因角色对齐而被截断

### Requirement: New assistant menu exposes only built-in modes

顶栏“+”菜单 MUST 只展示通用、知识管家、写作和编程四个内置助手模式，MUST NOT 混入 Capability Hub 专家、能力包或其他动态目录项。

#### Scenario: User opens the new assistant menu

- **WHEN** 用户点击 Agent 顶栏“+”
- **THEN** 菜单 MUST 恰好展示四个内置助手模式
- **AND** 已安装专家与能力包 MUST NOT 出现在该菜单中

### Requirement: Built-in mode entries are executable without guesswork

四个内置助手模式的空态卡片与快捷菜单入口 MUST 全部可执行：每个入口 MUST 具备可发送的提示词，并 MUST 声明发送前的 preflight 条件。依赖用户材料的任务在输入为空时 MUST 先用一句话追问，MUST NOT 直接发送。

#### Scenario: Content-dependent quick task without material

- **WHEN** 用户在输入框为空时点击依赖材料的快捷任务
- **THEN** 系统 MUST 追问所需材料并保持任务待执行
- **AND** MUST NOT 在没有材料的情况下发起模型请求

#### Scenario: Knowledge steward entries stay wired

- **WHEN** 用户查看知识管家空态
- **THEN** 四个入口 MUST 全部对应已实现的知识管家动作

## MODIFIED Requirements

### Requirement: 办公搭档空态文案与对齐

系统 MUST 在默认 Agent 空态展示聚焦启动界面：简短说明、真实 Composer 与四个可执行任务入口按单一路径排列。说明 MUST 居中，任务卡片内容 MUST 左对齐，界面 MUST NOT 展示装饰性助手图标或“开始一个新任务”大标题。

#### Scenario: 启动页主动作

- **WHEN** 用户打开默认 Agent 空 Session
- **THEN** 简短说明 MUST 说明可把问题或任务交给 KnowMe
- **AND** 真实 Composer MUST 显示在快捷任务之前
- **AND** MUST NOT 显示装饰性助手图标或「开始一个新任务」大标题

#### Scenario: 会议总结卡片

- **WHEN** 用户查看会议总结入口
- **THEN** 标题为「会议总结」，小标题为「为我总结最近三天的会议」

#### Scenario: 相关聊天卡片

- **WHEN** 用户点击「分析跟我相关的聊天」
- **THEN** 系统触发飞书相关聊天分析流程，优先汇总 @我 的内容

#### Scenario: 快捷任务视觉层级

- **WHEN** 用户查看启动页的四个快捷任务
- **THEN** 每项 MUST 提供可区分的图标、任务标题与结果描述
- **AND** 窄窗口下 MUST 自动改为单列且不发生横向溢出
