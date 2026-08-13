## ADDED Requirements

### Requirement: Expert can be added to the active workbench
Capability Hub SHALL 在 Expert 详情中提供“添加到工作台”动作，并通过受限宿主消息把 Expert 标识传给工作区；该动作 MUST 与“开始对话”并存。

#### Scenario: Add an available expert
- **WHEN** 用户在 Expert 详情点击“添加到工作台”
- **THEN** Hub SHALL 先确保 Expert 已安装且启用
- **AND** SHALL 请求宿主将该 Expert 绑定到当前工作模式
- **AND** 成功后 SHALL 显示当前工作模式名称与成功反馈

#### Scenario: Expert is already in current mode
- **WHEN** 当前 Expert 已绑定到当前工作模式
- **THEN** Hub SHALL 显示“已在工作台”状态
- **AND** 重复操作 MUST NOT 创建重复绑定

#### Scenario: Workbench binding fails
- **WHEN** 安装或启用已完成但工作台绑定失败
- **THEN** Hub SHALL 保留已完成的能力状态
- **AND** SHALL 显示可重试的绑定错误
- **AND** MUST NOT 错误提示已添加成功

### Requirement: Host validates workbench add intents
工作区宿主 MUST 只接受来自当前 Capability Hub frame 的添加意图，并校验消息类型、请求标识和 Expert 标识。

#### Scenario: Valid iframe intent
- **WHEN** 当前 Hub frame 发送合法添加意图
- **THEN** 宿主 SHALL 调用受控工作模式 API
- **AND** SHALL 将成功或失败结果回传给同一 frame

#### Scenario: Forged intent is ignored
- **WHEN** 非当前 Hub frame 或非法消息发送添加意图
- **THEN** 宿主 MUST 忽略该消息
- **AND** MUST NOT 修改工作模式或安装状态
