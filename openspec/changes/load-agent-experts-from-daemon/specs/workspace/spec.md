## ADDED Requirements

### Requirement: Workbench loads Agent experts from Daemon

工作台在 Daemon 在线且专家目录可用时 MUST 以 Daemon 返回的 Agent 专家为当前目录，并在用户刷新时重新请求；Daemon 专家目录不可用时 MUST 回退当前内容源仓库中的本地专家。

#### Scenario: Online Daemon supplies expert catalog

- **WHEN** 用户打开或刷新工作台，且 Daemon 专家目录请求成功
- **THEN** 工作台 SHALL 展示 Daemon 返回的专家身份、名称、简介、模型与状态
- **AND** 专家 SHALL 按 Daemon 的显示顺序稳定排列

#### Scenario: Refresh reloads experts

- **WHEN** Daemon 专家目录发生变化后用户点击工作台刷新
- **THEN** 工作台 MUST 重新请求 Daemon 专家目录
- **AND** 专家卡片、专家数量与详情 MUST 使用新响应更新

#### Scenario: Daemon expert catalog is unavailable

- **WHEN** Daemon 离线、鉴权失败、超时或不支持专家目录接口
- **THEN** 工作台 MUST 继续展示当前内容源仓库可读取的本地专家
- **AND** 工作流与任务的既有可用性 MUST NOT 因专家目录请求失败而中断

#### Scenario: Renderer receives safe expert DTO

- **WHEN** 主进程向工作台 Renderer 返回 Daemon 专家
- **THEN** DTO MUST NOT 包含 Daemon 内部资产路径、密钥或完整任务明细
- **AND** Renderer MUST NOT 直接访问 Daemon 或 Node 文件系统
