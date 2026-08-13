## Purpose

工作模式把 Agent、专业能力、工作流与执行提供方组织为可持久化的个人工作空间，让不同岗位在同一工作台中安全组队、切换场景并继续既有工作。

## ADDED Requirements

### Requirement: Workbench provides built-in professional work modes
系统 SHALL 提供日常办公、软件研发和视觉创作三类内置工作模式，并为每个模式声明名称、用途、图标、专业能力、建议 Agent 角色与执行提供方。

#### Scenario: First launch selects a usable default
- **WHEN** 用户首次打开工作台且没有工作模式数据
- **THEN** 系统 SHALL 创建版本化的内置工作模式集合
- **AND** SHALL 默认激活日常办公模式
- **AND** MUST NOT 删除或覆盖其他用户数据

#### Scenario: Engineering is a professional mode
- **WHEN** 用户切换到软件研发模式
- **THEN** 系统 SHALL 将现有 Daemon Agent 与编码工作流呈现为软件研发专业能力
- **AND** MUST NOT 将 Daemon 描述为整个工作台的唯一运行方式

#### Scenario: Mode without runnable workflows is honest
- **WHEN** 当前工作模式没有已接通的可运行工作流
- **THEN** 工作台 SHALL 展示添加 Agent、安装能力或创建工作流的下一步
- **AND** MUST NOT 展示虚假的可运行流程或完成状态

### Requirement: Current work mode is persistent
系统 MUST 在用户数据目录持久化当前工作模式与用户绑定，并在重启后恢复；Renderer MUST NOT 直接访问该文件。

#### Scenario: Restart restores current mode
- **WHEN** 用户切换工作模式后重启应用
- **THEN** 工作台 SHALL 恢复上次激活的工作模式
- **AND** SHALL 恢复该模式的用户 Agent 绑定

#### Scenario: Corrupt state falls back safely
- **WHEN** 工作模式持久化数据损坏、版本未知或引用不存在的模式
- **THEN** 系统 SHALL 回退到默认内置模式
- **AND** MUST NOT 阻止主窗口启动

### Requirement: Users can bind experts to a work mode
系统 SHALL 允许用户将一个已安装且可用的 Expert 绑定到当前工作模式，并保存来源、职责摘要、绑定时间和可用状态。

#### Scenario: Add an expert to current mode
- **WHEN** 用户从 Capability Hub 选择“添加到工作台”
- **THEN** 系统 SHALL 将该 Expert 绑定到当前工作模式
- **AND** 工作台团队视图 SHALL 立即显示该成员

#### Scenario: Duplicate binding is idempotent
- **WHEN** 用户重复将同一 Expert 添加到同一工作模式
- **THEN** 系统 SHALL 返回已存在状态
- **AND** MUST NOT 创建重复成员

#### Scenario: Remove a user binding
- **WHEN** 用户从团队视图移除一个用户添加的 Expert
- **THEN** 系统 SHALL 仅删除当前模式中的绑定
- **AND** MUST NOT 卸载 Expert、删除 Session 或影响其他工作模式

#### Scenario: Built-in role is protected
- **WHEN** 工作模式包含由专业能力包提供的内置角色
- **THEN** 团队视图 SHALL 标明其来源
- **AND** MUST NOT 将其作为用户绑定直接删除

### Requirement: Work mode DTO is bounded and safe
工作模式 IPC MUST 只返回渲染所需的结构化 DTO，并限制标识、字符串长度与绑定数量。

#### Scenario: Invalid binding input is rejected
- **WHEN** Renderer 提交非法 Expert 标识、未知模式标识或超限字段
- **THEN** 主进程 MUST 拒绝写入并返回可读错误
- **AND** MUST 保持原持久化状态不变

#### Scenario: Disabled expert remains explainable
- **WHEN** 已绑定 Expert 后来被禁用或卸载
- **THEN** 工作台 SHALL 保留该绑定的可解释占位
- **AND** SHALL 提供前往能力中心修复或移除绑定的操作
