## MODIFIED Requirements

### Requirement: Expert CRUD and try-chat in Hub

Hub MUST 支持专家的创建、编辑、安装、卸载，以及居中详情弹窗内「试聊」。

#### Scenario: Create custom expert

- **WHEN** 用户通过 Hub 自定义向导创建专家
- **THEN** 生成 EXPERT.md 与 manifest 并出现在专家列表

#### Scenario: Edit expert persists

- **WHEN** 用户在 Hub 编辑专家并保存
- **THEN** 磁盘 manifest 更新且 Hub 立即反映

#### Scenario: Try-chat opens ephemeral session

- **WHEN** 用户在专家居中详情弹窗点击「试聊」
- **THEN** 打开标记 ephemeral 的临时 Session，绑定该专家快照
- **AND** 关闭试聊后不保留在主 Session Tab 列表
