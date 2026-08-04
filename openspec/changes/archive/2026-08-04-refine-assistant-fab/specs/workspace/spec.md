## ADDED Requirements

### Requirement: Floating assistant uses a low-interruption icon anchor

工作台悬浮助理入口 MUST 默认以右下角的单一聊天标记呈现，不得使用常驻的实心药丸底板或厚重投影；入口 MUST 在浅色和深色主题中保持可识别，并保留原有快捷操作能力。

#### Scenario: Default workspace presentation

- **WHEN** 用户首次打开工作台或尚未保存悬浮入口位置
- **THEN** 悬浮助理 SHALL 显示在工作台右下角
- **AND** 常态只显示聊天标记，不显示实心药丸容器

#### Scenario: Theme and interaction visibility

- **WHEN** 用户切换浅色或深色系统主题
- **THEN** 聊天标记 SHALL 使用与背景有足够区分的主题色
- **AND** 悬停、键盘焦点与处理中状态 SHALL 继续提供可感知反馈

#### Scenario: Existing assistant interactions remain available

- **WHEN** 用户点击或纵向拖动聊天标记
- **THEN** 点击 SHALL 打开原有快捷面板
- **AND** 纵向拖动 SHALL 更新并持久化入口位置
- **AND** 可恢复工作提示与状态徽标 SHALL 继续可用
