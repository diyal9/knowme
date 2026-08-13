## Purpose

让 Agent 在活跃内容源作用域内安全地完成文件创建、修改、移动、复制、删除与建目录，并支持预览、用户批准、备份与回滚。

## ADDED Requirements

### Requirement: Scoped file write tools

系统 MUST 提供 `write_file`、`create_file`、`apply_patch`、`move_path`、`copy_path`、`delete_path`、`mkdir`，路径 MUST 相对于当前活跃内容源根目录，MUST 拒绝 `..`、绝对路径与内容源外路径。

#### Scenario: Path traversal blocked

- **WHEN** 模型请求 `write_file` 且 path 为 `../../outside.txt`
- **THEN** 返回 `scope_denied`
- **AND** MUST NOT 写入磁盘

#### Scenario: Read tools unchanged

- **WHEN** 仅 allowlist 读工具
- **THEN** 现有 `read_file/list_dir/grep_files` 行为 MUST NOT 回归

### Requirement: Write preview and approval

除明确标记低风险的 `mkdir`（空目录）外，写/删/移动 MUST 先创建 draft preview（diff 或操作摘要），`requiresApproval=true`，用户批准后才执行。

#### Scenario: apply_patch preview shows diff

- **WHEN** 模型调用 `apply_patch` 修改现有文件
- **THEN** draft preview MUST 展示 unified diff 或前后片段对比
- **AND** 未批准前 MUST NOT 修改文件

#### Scenario: User rejects delete

- **WHEN** 用户拒绝 `delete_path` draft
- **THEN** 文件 MUST 保持原状
- **AND** draft 状态为 rejected

### Requirement: Backup and rollback

写/删/移动在 execute 前 MUST 将受影响文件备份到 `.knowme/backups/<runId>/`；当 `rollbackSupported=true` 且用户在 UI 选择回滚时，系统 MUST 从备份恢复。

#### Scenario: Rollback after bad patch

- **GIVEN** 用户已批准并应用 patch
- **WHEN** 用户在 artifact/审批历史中选择回滚
- **THEN** 文件内容恢复为备份版本
- **AND** audit 记录 outcome=rolled_back

### Requirement: apply_patch format

`apply_patch` MUST 接受结构化 patch（path + hunks 或 whole-file replacement）；MUST 拒绝 patch 与文件编码不兼容或 hunk 无法应用的情况。

#### Scenario: Patch conflict

- **WHEN** patch 目标行与当前文件不匹配
- **THEN** 返回 `patch_conflict` 且不部分应用
