## ADDED Requirements

### Requirement: 过程分区可折叠

Daemon 审阅「过程日志」Tab 中，PROGRESS.MD 与运行日志区块 MUST 支持通过点击文件头折叠或展开正文。同一次任务会话内，折叠状态在日志增量重绘后 MUST 被保留。

#### Scenario: 点击文件头折叠

- **WHEN** 用户点击「PROGRESS.MD」或「运行日志」文件头
- **THEN** 对应正文隐藏或显示，文件头仍可见

#### Scenario: 重绘保留折叠

- **WHEN** 运行日志有增量且触发过程日志重绘
- **THEN** 用户此前折叠的分区保持折叠

### Requirement: PROGRESS.MD 默认预览

PROGRESS.MD 正文 MUST 默认以安全 Markdown 预览展示（标题/列表/段落等可读排版），MUST NOT 仅以未排版源码作为默认视图。界面 MUST 提供切换到源码视图的入口。

#### Scenario: 默认预览

- **WHEN** 用户打开含非空 progress 文本的过程日志 Tab
- **THEN** PROGRESS.MD 区以预览排版展示，而不是默认整块源码等宽文本

#### Scenario: 切换源码

- **WHEN** 用户选择源码视图
- **THEN** 同一份 progress 文本以等宽源码形式展示
