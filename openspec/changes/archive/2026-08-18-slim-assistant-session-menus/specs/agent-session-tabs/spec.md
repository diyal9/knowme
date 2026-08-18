## MODIFIED Requirements

### Requirement: Tab context menu

每个 Session Tab MUST 提供右键菜单，动作为本条工作会话：重命名、复制对话记录、关闭。MUST NOT 再提供浏览器式页签管理（Pin、分叉、关闭左侧/右侧/其他）或「管理对话」跳转到 ⋯。

#### Scenario: Open tab context menu

- **WHEN** 用户在 Session Tab 上右键
- **THEN** 弹出菜单，包含重命名、复制对话记录、关闭
- **AND** 不包含管理对话、Pin、分叉、关闭左侧、关闭右侧、关闭其他

#### Scenario: Copy transcript

- **WHEN** 用户选择「复制对话记录」
- **THEN** 将该 Session 的完整对话（用户/助手轮次）写入剪贴板

#### Scenario: Rename session inline

- **WHEN** 用户选择「重命名」
- **THEN** 可在 Tab 内联修改标题，并持久化到 Session.title

### Requirement: Active session management menu

当前激活 Session 的 ⋯ 菜单 MUST 提供当前工作动作：新对话、在新对话继续、复制当前总结。有助手错误时 MUST 提供复制错误信息；无错误时 MUST NOT 展示该项。MUST NOT 再提供重命名、关闭 Tab、动作表现（与右键 / Tab `×` / 调试开关重复）。

#### Scenario: Open active session menu

- **WHEN** 用户点击 ⋯
- **THEN** 弹出针对当前激活 Session 的菜单，包含新对话、在新对话继续、复制当前总结
- **AND** 不包含重命名、关闭 Tab、动作表现

#### Scenario: Copy current summary

- **WHEN** 用户选择「复制当前总结」
- **THEN** 将当前 Session 的 summary 写入剪贴板
- **AND** 若无 summary 则由最近消息生成

#### Scenario: Continue in new conversation

- **WHEN** 用户选择「在新对话继续」
- **THEN** 新建 Session，把当前总结写入新 Session 的 summary，打开为新 Tab 并激活
- **AND** 原 Session 保持不变

#### Scenario: Copy error only when present

- **WHEN** 当前对话存在错误消息
- **THEN** ⋯ 菜单包含「复制错误信息」
- **WHEN** 当前对话没有错误消息
- **THEN** ⋯ 菜单不展示「复制错误信息」
