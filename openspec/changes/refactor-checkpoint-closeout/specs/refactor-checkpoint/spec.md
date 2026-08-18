## ADDED Requirements

### Requirement: Checkpoint is not completion

系统与文档 MUST 将当前树表述为可运行检查点。MUST NOT 以重构完成名义进入下一功能轮。

#### Scenario: Closeout does not archive restore parity

- **WHEN** 执行本收口迭代
- **THEN** `restore-game-studio-ui-parity` 保持活跃
- **AND** `surfaces.md` 中标「薄」的项不得无真机证据改为「有」
