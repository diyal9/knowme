## ADDED Requirements

### Requirement: Write tools bound to active content source

文件写/删/移动/patch 工具 MUST 仅作用于当前 Session 活跃内容源根；切换内容源后 MUST 重新校验 scope。

#### Scenario: Switch source invalidates pending file draft

- **WHEN** 用户切换活跃内容源且存在 pending file draft
- **THEN** 系统提示 draft 路径可能失效并需重新预览

### Requirement: Artifacts subdirectory policy

内容源 MAY 配置 `artifacts/` 为默认可写子目录；写工具 MUST 仍拒绝写入 `.git/`、`.knowme/backups` 以外系统敏感路径（由 path policy 定义）。

#### Scenario: Write to artifacts allowed

- **WHEN** 活跃源已启用 artifacts 策略
- **THEN** create_artifact 落盘 MAY 使用 `<root>/artifacts/` 无需额外批准（若 contract 标记低风险）

#### Scenario: Write to git blocked

- **WHEN** 模型试图 patch `.git/config`
- **THEN** 返回 `scope_denied`
