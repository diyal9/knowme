## ADDED Requirements

### Requirement: Studio graph check is a dry-run with animation

工作室「检查流程」SHALL 仅对当前画布 Graph 做静态检查并播放预览动画，SHALL NOT 保存工作流，SHALL NOT 启动 Team Run / Daemon 任务。

#### Scenario: Check walks from start to end with animation

- **WHEN** 用户点击「检查流程」且图可通过检查
- **THEN** 从开始节点高亮，沿边方向依次检查到结束节点
- **AND** 边有方向性流转动画，全程不发起真实运行

#### Scenario: First failing node stops and reports

- **WHEN** 某节点未通过检查标准（如未绑定专家、不可达、悬挂边）
- **THEN** 该节点进入失败态并提示错误
- **AND** 后续节点不再继续动画检查

### Requirement: Graph inspection standard is reusable

系统 SHALL 提供可复用的 Graph 检查接口，至少覆盖：空图、起终点、可达性、悬挂边、专家/模型/工具/知识库绑定缺失，并返回有序 walk 与带 `nodeId` 的 issues。

#### Scenario: Inspector reports structured issues and walk order

- **WHEN** 调用 Graph 检查
- **THEN** 返回 `{ ok, issues[], walk[] }`
- **AND** `issues` 含可读 `message` 与可选 `nodeId`
