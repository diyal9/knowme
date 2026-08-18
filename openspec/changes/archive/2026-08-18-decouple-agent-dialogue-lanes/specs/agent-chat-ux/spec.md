## ADDED Requirements

### Requirement: 工作台对话使用独立内核 session

工作台专家协作与工作流任务对话 MUST 使用独立于助理标签栏的 sessionId。该 session MUST NOT 出现在助理 open tabs。

#### Scenario: 专家对话不占用助理标签

- **WHEN** 用户在专家协作发送一条消息
- **THEN** generate payload 的 sessionId 以 `wb-expert-` 开头

### Requirement: 过程日志不是对话

任务对话 MUST 只渲染 `dialogueMessages`。管线 daemon 日志 MUST 留在执行过程面板。

#### Scenario: 启动管线后对话仍为空

- **WHEN** 用户在工作台开始运行且尚未在任务对话发过消息
- **THEN** 任务对话不展示 daemon 日志行作为助手气泡
