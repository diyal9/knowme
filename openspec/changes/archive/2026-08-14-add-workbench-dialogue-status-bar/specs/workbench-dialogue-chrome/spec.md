## Purpose

定义工作台 task-room 对话工作间的统一顶栏（标题身份 + 上下文操作），覆盖专家协作、工作流对话与 Daemon 运行审阅，使用户始终知道当前协作对象并有明确退路。

## ADDED Requirements

### Requirement: Task-room dialogue status bar

当工作台处于 task-room 布局（专家协作对话、工作流对话、或 Daemon 运行审阅带左对话）时，系统 MUST 在左侧对话列顶部展示贴顶状态栏。状态栏 MUST 包含：左侧标题（可读身份），右侧至少一个主操作。状态栏 MUST 在对话内容滚动时保持可见（sticky 或固定在列顶）。工作台总览（非 task-room）MUST NOT 显示此对话状态栏。

#### Scenario: Expert collaboration shows dialogue status bar

- **WHEN** 用户从专家协作进入任务对话房
- **THEN** 左侧对话列顶部显示状态栏
- **AND** 标题反映当前任务目标或专家/协作名称（非空泛「工作台」占位）
- **AND** 右侧提供可点击「返回」（或等价退路控件）

#### Scenario: Workflow dialogue shows dialogue status bar

- **WHEN** 用户从工作流货架进入工作流对话房
- **THEN** 左侧对话列顶部显示状态栏
- **AND** 标题反映工作流短名或本次任务目标
- **AND** 右侧提供可点击「返回」以退回货架或约定退路

#### Scenario: Daemon review with chat shows dialogue status bar

- **WHEN** 用户处于 Daemon 运行审阅且左侧过程对话可见
- **THEN** 左侧对话列顶部显示状态栏
- **AND** 标题反映 Daemon 阶段身份（或运行标题）
- **AND** 右侧提供返回或与右栏约定一致的主退路，且 MUST NOT 与右栏返回产生冲突性双重主退路文案堆叠（允许一主一次）

#### Scenario: Overview hides dialogue status bar

- **WHEN** 用户停留在专家协作首页、工作流货架或管线服务总览（非 task-room）
- **THEN** 不渲染对话工作间状态栏

### Requirement: Right rail chrome matches status-bar language

task-room 右侧面板（专家任务房或运行壳顶栏）MUST 采用与左侧状态栏一致的布局语言：左侧标题/身份，右侧操作；专家任务房 MUST NOT 仅显示无标题的状态点作为唯一顶栏内容。

#### Scenario: Expert task room has titled chrome

- **WHEN** 专家任务房右栏可见
- **THEN** 顶栏显示协作/专家相关标题或状态文案
- **AND** 布局为左身份、右操作（若有操作）

#### Scenario: Run topbar remains titled with back

- **WHEN** 用户处于工作流/Daemon 运行面
- **THEN** 右栏顶栏保留标题与可点击「返回」
- **AND** 不恢复「确认输入 / 执行中 / 产物」装饰步进条
