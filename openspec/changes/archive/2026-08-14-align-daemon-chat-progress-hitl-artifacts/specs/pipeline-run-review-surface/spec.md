## ADDED Requirements

### Requirement: 左栏管线进度卡

Daemon 运行间左栏对话 MUST 展示紧凑「管线进度」卡，包含当前步骤标签与完成比例（或等价进度文案）。完整运行日志 MUST 仍可在右栏「过程日志」查阅；左栏 MUST NOT 回灌全文 daemon.log。

#### Scenario: 运行中可见进度

- **WHEN** 用户打开进行中的 Daemon 任务工作间
- **THEN** 左栏出现管线进度卡（当前步 / 步数比例 / 等待或执行态）
- **AND** 可从该卡或既有入口打开右栏过程日志

#### Scenario: 与助手工具时间线区分

- **WHEN** 左栏同时存在助手工具「执行过程」折叠条与管线进度卡
- **THEN** 管线进度卡文案/语义 MUST 标明为管线进度，不得仅用易混淆的「执行过程」作为唯一标题

### Requirement: HITL 问题与作答对齐 WebUI 待处理事项

当任务处于澄清（need_input）或 Gate 等待时，左栏 HITL 卡 MUST 展示可读的具体问题列表（多问时编号）；澄清 MUST 支持在卡内或对话输入提交答复；Gate MUST 提供通过/修订/打回。

#### Scenario: 澄清展示具体问题

- **WHEN** Daemon 返回 pending clarification 且含 `questions[]`（或 enrichment 得到问题文案）
- **THEN** HITL 卡列出这些问题
- **AND** 用户可提交答复后任务继续

#### Scenario: Gate 决定

- **WHEN** 任务等待本机 Gate
- **THEN** HITL 卡提供通过 / 修订 / 打回并可提交

### Requirement: 制品行对齐 WebUI

右栏「制品」Tab 的每条制品 MUST 采用「预览 · 路径 · 大小」水平行布局（有大小时显示大小），视觉上为描边列表行，对齐 Daemon WebUI 制品区。

#### Scenario: 有大小的制品行

- **WHEN** 制品列表项包含 path 与 size
- **THEN** 行内左侧为预览操作、中间为路径、右侧为格式化大小
