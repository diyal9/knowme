## ADDED Requirements

### Requirement: Assistant surface never shows daemon process feed

助理 Session surface MUST NOT 展示 Daemon / 管线「过程对话」投影（progress.md 摘要与运行日志块）。该投影仅允许出现在工作台 surface 的 Daemon 运行间。

#### Scenario: Switch from daemon run to assistant clears process card

- **WHEN** 用户在工作台 Daemon 运行间看到过程投影后进入助理模式
- **THEN** 助理对话区不显示「Agent 全局运行过程」或 progress/运行日志块
- **AND** 助理空态或消息流按助理 Session 正常渲染

#### Scenario: Assistant render does not restore stale process cache

- **WHEN** 进程内仍残留上次 Daemon 过程缓存且当前为助理 surface
- **THEN** 系统丢弃或忽略该缓存，不把过程块画进助理对话区

### Requirement: Workbench ownership title variants relocate from assistant tabs

判定 Session 是否工作台归属时，系统 MUST 识别「工作台」后接常见间隔符的标题/目标变体（至少包括间隔点、连字符、破折号），并将其移出助理打开 Tab 集合。

#### Scenario: Hyphenated workbench title migrates off assistant

- **WHEN** 助理打开集合中存在标题或目标以「工作台 -」或「工作台—」开头的 Session
- **THEN** 加载或清洗时将该 Session 归入工作台打开集合
- **AND** 助理 Tab 栏不再展示它
