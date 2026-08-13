## ADDED Requirements

### Requirement: Daemon review footer keeps refresh with process log

管线 daemon 审阅右栏 MUST 将「刷新」与「过程日志」放在同一 footer 行；「过程日志」按钮 MUST NOT 通栏拉满。底栏 `#wbRunnerActions` MUST NOT 再提供与顶栏重复的「返回」，也 MUST NOT 在终态提供「重跑」（执行过程与后续意图走左栏对话）。无审批/澄清等必要动作时，该底栏 MUST 隐藏。

#### Scenario: Refresh sits with process log

- **WHEN** 用户打开 Daemon 管线执行审阅右栏且存在可刷新的任务 slug
- **THEN** 「过程日志」与「刷新」并排出现在审阅 footer
- **AND** 「过程日志」按钮宽度为内容自适应，不拉满整行

#### Scenario: No duplicate bottom back

- **WHEN** 用户查看 Daemon 管线执行审阅右栏
- **THEN** 底栏不出现「返回」按钮
- **AND** 顶栏 `#wbRunBack` 仍可离开运行面

#### Scenario: No terminal restart in review footer

- **WHEN** 管线任务处于失败或已取消终态
- **THEN** 审阅右栏底栏不出现「重跑」
- **AND** 执行过程仍可在左栏对话/过程区查看

#### Scenario: Empty action bar hidden

- **WHEN** 当前运行无需审批或澄清
- **THEN** `#wbRunnerActions` 底栏隐藏，不露出空白横条
