## ADDED Requirements

### Requirement: 过程日志作为审阅独立 Tab

Daemon 审阅面 MUST 在「事件」之后提供「过程日志」Tab（id: `logs`）。该 Tab MUST 展示 progress.md 摘要与运行日志（或对应空态），MUST NOT 再将同一内容投影为左栏对话流中的过程卡。

#### Scenario: Tab 顺序含过程日志

- **WHEN** 用户打开 Daemon 运行审阅面
- **THEN** Tab 顺序为：步骤、制品、变更、事件、过程日志

#### Scenario: 过程日志 Tab 展示内容

- **WHEN** 用户切换到「过程日志」且已拉取 progress/logs
- **THEN** 右侧正文显示 progress 摘要区与运行日志区（无内容时显示空态文案）

#### Scenario: 左栏不再注入过程卡

- **WHEN** Daemon 任务正在运行或已失败且右栏审阅面可见
- **THEN** 左栏对话流 MUST NOT 出现 PROGRESS.MD / 运行日志过程块卡片

## ADDED Requirements

### Requirement: 审阅 Tab 栏刷新与底栏收敛

Daemon 审阅面 MUST 将「刷新」放在 Tab 按钮组同一行的最右侧，且 MUST 为仅图标（无文字标签）。底栏 MUST NOT 再提供「过程日志」入口按钮；原底栏「刷新」文字按钮 MUST 移除或迁出。

#### Scenario: 刷新在 Tab 栏右侧

- **WHEN** 当前任务有 slug，审阅面可见
- **THEN** Tab 行最右侧可见刷新图标按钮，`title`/`aria-label` 为「刷新」

#### Scenario: 无底栏过程日志按钮

- **WHEN** 用户查看 Daemon 审阅面
- **THEN** 底栏不出现「过程日志」按钮
