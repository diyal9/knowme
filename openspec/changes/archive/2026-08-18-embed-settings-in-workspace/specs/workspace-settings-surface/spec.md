## ADDED Requirements

### Requirement: Settings opens in the main workspace

工作台侧栏「设置」MUST 在主窗口内容区打开设置面，MUST NOT 再弹出独立系统窗口。再次点击已打开的设置 MUST 关闭该面。

#### Scenario: Open settings from rail

- **WHEN** 用户点击侧栏「设置」
- **THEN** 主窗口显示设置 Tab 面（内容源等）
- **AND** 不调用 `openSettingsWindow`

#### Scenario: Toggle settings closed

- **WHEN** 设置已在主区打开且用户再次点击侧栏「设置」
- **THEN** 设置面关闭，回到助理

#### Scenario: Tray or source shortcut

- **WHEN** 主进程发送 `workspace-open-settings` 或用户从文件栏添加内容源
- **THEN** 主窗口打开设置并落到对应 Tab
