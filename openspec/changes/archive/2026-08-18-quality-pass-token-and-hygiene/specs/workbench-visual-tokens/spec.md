# Spec: workbench-visual-tokens

## ADDED Requirements

### Requirement: Workbench primary actions use accent token

工作台内主要行动按钮 MUST 使用 `--wb-accent`，不得使用炭黑硬编码作为 primary 填充色。

#### Scenario: Run and modal primary buttons

- **WHEN** 用户查看工作台运行底栏或模态确认主按钮
- **THEN** primary 按钮背景与边框为 `var(--wb-accent)`（或其计算色），而非 `#34312d`

### Requirement: Daemon review status colors use shared tokens

Daemon 审阅进度条与步骤标记 MUST 使用 `--wb-success` / `--wb-warning` / `--wb-danger`。

#### Scenario: Step mark colors

- **WHEN** 审阅步骤处于 done / active / error
- **THEN** 标记色分别对应 success / warning / danger token

### Requirement: Border token is defined

`.workbench` MUST 定义 `--wb-border`，与 `--wb-line` 对齐，避免 fallback 漂移。

#### Scenario: Review tabs border

- **WHEN** 审阅面使用 `var(--wb-border, …)`
- **THEN** 解析到已定义的 `--wb-border`，而非仅依赖 hex fallback
