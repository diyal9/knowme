# agent-workbench (delta)

## ADDED Requirements

### Requirement: 管线服务操作台视觉与工作台令牌一致

管线服务（Daemon）操作台的字号层级、控件边框/圆角/焦点环、主 CTA 与状态色 MUST 复用工作台 `--wb-*` 令牌与货架控件视觉规范。主开工按钮可用态 MUST 使用 accent，MUST NOT 使用与货架割裂的纯黑大按钮作为默认可用态。

#### Scenario: 主 CTA 色与货架一致

- **WHEN** 用户在线且满足开工条件
- **THEN** 「开始开发」按钮呈现 accent 可用态（非纯黑填充）
- **AND** 不满足条件时按钮为 muted 禁用态

#### Scenario: 表单与右栏可读

- **WHEN** 用户打开管线服务 Tab
- **THEN** 字段标签与输入文字可读（不低于工作台货架正文量级）
- **AND** 连接状态行与「刷新/重试」按钮垂直居中对齐
- **AND** 输入聚焦时出现 accent 焦点环（与货架搜索一致）
