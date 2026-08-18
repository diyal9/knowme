## MODIFIED Requirements

### Requirement: 现有链接安全行为必须保留

系统 MUST 保留飞书链接现有的 URL 安全校验和打开动作。

#### Scenario: 点击资源卡片

- **WHEN** 用户左键点击飞书资源卡片（文档、表格、妙记等非 chat 类型）
- **THEN** 系统在右侧 KnowMe 浏览器打开该链接
- **AND** 预览宿主使用 `webview` 且 `partition="persist:knowme-preview"`
- **AND** 不因 `target="_blank"` 另开无登录态系统窗口

#### Scenario: 飞书会话 AppLink

- **WHEN** 用户点击类型为 chat 的飞书资源
- **THEN** 系统继续走外部/客户端打开路径，不进入右侧预览

#### Scenario: 预览工具栏

- **WHEN** 右侧预览已打开
- **THEN** 用户可全屏、外部打开、复制链接或关闭预览
- **AND** Esc 退出全屏（若处于全屏）
