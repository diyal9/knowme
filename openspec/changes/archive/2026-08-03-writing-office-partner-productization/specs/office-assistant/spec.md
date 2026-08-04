# Delta Spec: office-assistant

## ADDED Requirements

### Requirement: Writing office partner exposes daily document tasks

系统 MUST 在写作模式空状态提供面向日常办公的文档任务入口，而不是仅提供抽象写作术语。

#### Scenario: View writing home

- **GIVEN** 用户处于写作模式且当前对话为空
- **WHEN** 渲染空状态
- **THEN** 用户能看到“写需求文档”“写办公文档”“按提纲成稿”“排版定稿”四类主任务
- **AND** 每个入口的标题和副标题都直接说明可交付结果

#### Scenario: Run a document task

- **GIVEN** 用户点击任一写作任务入口
- **WHEN** 系统发送意图给当前写作助手
- **THEN** 发送内容 MUST 面向文档任务目标、材料和交付格式
- **AND** MUST NOT 仅表现为提示词改写模板
