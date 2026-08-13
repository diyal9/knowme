## ADDED Requirements

### Requirement: Daemon dialogue status bar shows purpose title only

当工作台处于 Daemon 运行审阅 task-room 时，通栏对话状态栏 MUST 仅以目的标题（`Daemon 阶段 · {目的}`）作为左侧身份文案。状态栏 MUST NOT 并排展示工作流短名、context 摘要或第二段「Daemon 阶段 · …」副标题。结论态（如已完成/失败）与返回控件 MAY 保留在右侧。

#### Scenario: Daemon top bar has single purpose title

- **WHEN** 用户打开 Daemon 管线任务审阅面
- **THEN** 通栏顶栏左侧身份为唯一目的标题
- **AND** 顶栏不出现工作流名或第二段 Daemon 阶段文案与标题并排抢位

#### Scenario: Expert and workflow rooms unchanged for title+meta pattern

- **WHEN** 用户处于专家协作或非 Daemon 工作流对话房
- **THEN** 既有标题/副文案规则不受本要求强制改为「仅标题」
