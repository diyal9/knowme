## MODIFIED Requirements

### Requirement: Clicking a shelf card opens a workflow dialogue workbench

用户点击货架卡片空白区域、按 Enter/Space，或点击页脚「开始任务」图标时，系统 MUST 打开工作台双栏工作流对话房（见 `open-workflow-dialogue-workbench`）。系统 MUST NOT 以居中详情弹层或表单「确认输入」作为该主路径。页脚仍为右对齐图标；运行入口为 play 图标。

#### Scenario: Open dialogue from card or run icon

- **WHEN** 用户点击货架卡片空白区或 play 图标
- **THEN** 系统进入工作流对话房
- **AND** 不打开 `workflow-start` 精简确认弹层

### Requirement: Domain filter chips do not show a separate clear-filter control

领域筛选区域 MUST 仅展示领域 chip 与「管理工作流」等必要操作；不得展示「清除筛选」文字按钮。无匹配结果时提示用户点「全部」或清空搜索，不得再提供清除筛选按钮。

#### Scenario: No clear-filter label on the shelf toolbar

- **WHEN** 用户选择非「全部」领域或使用搜索过滤
- **THEN** 工具栏不出现「清除筛选」按钮
- **AND** 用户可通过点「全部」或清空搜索取消过滤
