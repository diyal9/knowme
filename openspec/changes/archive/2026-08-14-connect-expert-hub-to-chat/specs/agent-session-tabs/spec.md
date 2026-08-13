## ADDED Requirements

### Requirement: Capability Hub opens a dedicated expert tab

工作区 MUST 接收来自当前 Capability Hub frame 的专家启动意图，创建并激活一个绑定该专家的独立普通 Session。消息 MUST 校验来源，且 Session 创建成功前 MUST NOT 丢失当前工作状态。

#### Scenario: Hub starts an expert tab

- **WHEN** 当前 Capability Hub frame 发送合法专家启动意图
- **THEN** 工作区创建绑定该 expertId 的 Session 并加入打开 Tab
- **AND** 关闭 Hub、激活新 Tab、展示专家身份并聚焦输入框

#### Scenario: Foreign message is ignored

- **WHEN** 非当前 Capability Hub frame 发送同名消息
- **THEN** 工作区忽略该消息
- **AND** MUST NOT 创建 Session 或关闭当前面板

#### Scenario: Session creation fails

- **WHEN** 工作区无法创建专家 Session
- **THEN** Capability Hub 保持打开并展示失败原因
- **AND** 当前激活 Session 与打开 Tab 集合保持不变

### Requirement: Expert identity remains visible in the conversation

绑定专家的活动 Session MUST 在 Tab、对话顶部或欢迎区持续展示专家名称；空对话 MUST 展示专家说明、建议任务和依赖就绪状态，使用户能够理解当前伙伴及可用能力。

#### Scenario: Empty expert Session

- **WHEN** 用户进入尚无消息的专家 Session
- **THEN** 对话区展示专家名称、说明和至少一个可执行任务入口
- **AND** 显示已就绪与受限的绑定能力摘要

#### Scenario: Expert tab remains identifiable after messages

- **WHEN** 专家 Session 已产生对话消息
- **THEN** Tab 或对话顶部继续显示专家身份
- **AND** 用户无需返回 Hub 判断当前专家

#### Scenario: Configure a limited dependency

- **WHEN** 用户点击受限连接器旁的“去配置”
- **THEN** 工作区打开对应连接器设置或 Capability Hub 连接器入口
- **AND** 当前专家 Session 保持打开

## REMOVED Requirements

### Requirement: Ephemeral try-chat sessions excluded from main tabs

**Reason**: 产品不再提供独立 ephemeral 试聊形态；专家从 Hub 直接进入普通、可恢复的独立对话。

**Migration**: 原“试聊”按钮替换为状态驱动的直接使用 CTA，新建 Session 按既有持久化、Tab 和历史规则管理。
