# agent-chat-ux — 下线 composer 工作提示条

## REMOVED Requirements

### Requirement: 工作提示以实际内容呈现

**移除原因**：产品尚未定位「记忆开关」与「意图推荐」的边界，先下线输入框上方的提示条，避免空操作与误导。

### Requirement: 勾选状态决定本轮上下文

**移除原因**：同上。记忆改为仅通过主进程静默个性化上下文生效，不做 composer 侧勾选。

### Requirement: 提示条不占用输入框

**移除原因**：提示条整体下线。

### Requirement: 按需展示详情

**移除原因**：提示条整体下线。

## ADDED Requirements

### Requirement: Composer 旁不展示记忆勾选条

Agent 输入框上方 MUST NOT 渲染工作提示 / 「本轮带上」勾选条，直至产品明确意图推荐或记忆开关的定位。

#### Scenario: 打开对话时输入区干净

- **WHEN** 用户打开 Agent 对话且输入框为空
- **THEN** 输入框上方不出现记忆相关勾选芯片

#### Scenario: 记忆仍可静默进入请求

- **WHEN** 用户已有已确认习惯或设置了协作偏好，并发送一条消息
- **THEN** 主进程仍可通过个性化 / 协作偏好链路注入上下文
- **AND** 渲染进程不提供本轮勾选开关
