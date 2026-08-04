# Delta Spec: connector-feishu-auth

## ADDED Requirements

### Requirement: Just-in-time incremental authorization for missing Feishu scopes

当飞书工具因缺少特定 scope 失败时，系统 MUST 基于 lark-cli 权威 `missing_scopes` 在对话内提供即需即授入口，并在授权后自动续跑原始提问；MUST NOT 泛化成"检查不到工具"或要求整体重新全量授权。

#### Scenario: Missing scope detected from tool failure

- **GIVEN** 飞书连接器已启用且 user 已授权
- **AND** lark-cli 读工具返回结构化 `missing_scope` 错误（含 `missing_scopes` 或 `required scope(s):` 文本）
- **WHEN** 系统构造失败提示
- **THEN** MUST 提取精确的缺失 scope 列表（结构化字段优先，文本回退）
- **AND** MUST 用友好能力名（如「知识库检索」）说明缺什么
- **AND** MUST 在 CTA 链接编码这些 scope（`knowme://feishu/auth?scopes=<encoded>`）
- **AND** MUST NOT 泛化为"检查不到工具/权限不足"的无指向提示

#### Scenario: One-click incremental authorization

- **GIVEN** 对话内显示了即需即授卡片
- **WHEN** 用户点击"补齐授权并继续"
- **THEN** 系统 MUST 只申请缺失的那几个 scope（增量授权）
- **AND** 卡片 MUST 提供可展开的原始 scope 明细

#### Scenario: Auto-resume after authorization

- **GIVEN** 用户完成增量授权
- **WHEN** 授权成功回到应用
- **THEN** 系统 MUST 自动续跑用户的原始提问，无需用户重新发起

#### Scenario: Unauthorized read without parseable scopes

- **GIVEN** 飞书读工具返回 401/403/unauthorized，但 lark-cli 未回传结构化 scope
- **WHEN** 系统构造失败提示
- **THEN** MUST 提供通用"重新授权"入口
- **AND** MUST NOT 落到"会议/妙记读取失败"等错配措辞
- **AND** MUST NOT 编造文档正文

#### Scenario: Do not misclassify non-scope failures

- **GIVEN** 失败原因是"文档不存在"或"妙记无查看权限（ACL）"
- **WHEN** 系统构造失败提示
- **THEN** MUST 保留各自的专属提示（核对链接 / 申请妙记权限）
- **AND** MUST NOT 转成缺 scope 的增量授权 CTA
