## ADDED Requirements

### Requirement: Right review rail shows workflow secondary identity

Daemon 审阅右栏 MUST 在 Tab 行附近展示工作流短名（或等价副身份），使顶栏收敛为目的标题后用户仍能识别「跑的是哪条工作流」。该副身份 MUST NOT 再占用通栏顶栏 meta 位。

#### Scenario: Workflow name visible in right review chrome

- **WHEN** 用户处于 Daemon 审阅且已绑定工作流
- **THEN** 右栏审阅区可见工作流短名
- **AND** 通栏顶栏不再依赖 meta 展示同一工作流名

### Requirement: Left pipeline progress is a single-layer card

左栏「管线进度」投影 MUST 呈现为单层卡片：当前步、状态、比例与日志入口同属一张卡。MUST NOT 出现独立灰条标题与卡身视觉重叠、或双层边框叠卡观感。

#### Scenario: Progress card reads as one card

- **WHEN** 左栏展示管线进度卡
- **THEN** 用户看到一张连续卡片（当前步 + 进度 + 操作）
- **AND** 不出现「管线进度」条与下方卡片上下叠盖的双卡观感
