## MODIFIED Requirements

### Requirement: Partner-oriented quick actions

Composer 快捷入口（Ctrl/Cmd+K）MUST 以可搜索命令面板呈现协作任务，不得要求用户先理解“快捷大类 / 快捷子项”等内部分类。面板 MUST 聚合当前模式的推荐任务与动态 Skill，MUST 保留统一任务 preflight，并 MUST 支持完整键盘操作。

#### Scenario: Launcher uses task-oriented copy

- **WHEN** 用户打开快捷命令面板
- **THEN** 面板 MUST 展示协作任务名称与结果导向描述
- **AND** MUST NOT 显示“快捷大类”或“快捷子项”
- **AND** 可见至少一项非提示词编辑类的协作动作

#### Scenario: Search filters commands immediately

- **GIVEN** 快捷命令面板已打开
- **WHEN** 用户输入任务标题或描述中的关键词
- **THEN** 可见结果 MUST 即时过滤为匹配任务
- **AND** 无匹配时 MUST 展示可读空状态而不是空白面板

#### Scenario: Dynamic skills are searchable

- **GIVEN** 当前任务目录包含由能力包或 Skill 动态提供的快捷任务
- **WHEN** 用户搜索其标题或描述关键词
- **THEN** 匹配任务 MUST 出现在结果中
- **AND** 执行后 MUST 复用该任务既有 preflight 与执行路径

#### Scenario: Keyboard opens and operates launcher

- **WHEN** 用户按 Ctrl/Cmd+K
- **THEN** 快捷命令面板 MUST 打开并将焦点置于搜索框
- **AND** ArrowDown / ArrowUp MUST 移动结果焦点
- **AND** Enter MUST 执行当前结果
- **AND** Escape MUST 关闭面板并将焦点返回输入区

#### Scenario: Search works without changing the draft

- **GIVEN** Composer 已包含未发送草稿
- **WHEN** 用户打开并搜索快捷命令
- **THEN** 搜索文字 MUST NOT 写入或覆盖 Composer 草稿
- **AND** 关闭面板后原草稿 MUST 保持不变
