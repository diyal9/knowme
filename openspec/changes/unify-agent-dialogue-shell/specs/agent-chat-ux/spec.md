## ADDED Requirements

### Requirement: 工作台对话订阅同一套 v2 流式归约

工作台专家协作与工作流任务对话 MUST 在生成中把 `ai-stream-event` 归约到当前助手气泡（时间线/正文），MUST NOT 只在 invoke 结束后整段替换。

#### Scenario: 工作流对话看到内容整理完成

- **WHEN** 用户在工作台任务对话发送一条消息且主进程发出 stage「上下文准备完成」
- **THEN** 当前助手气泡执行进度出现「内容整理完成」

### Requirement: 工作台生成可停止且不假 streaming

停止生成后工作台助手气泡 MUST 结束 streaming。

#### Scenario: 停止后不再转圈

- **WHEN** 工作台对话生成中点击停止
- **THEN** 该助手消息 `streaming` 为 false
