# workbench-file-tools Specification

## Purpose

让 Agent 在活跃内容源作用域内安全地完成文件创建、修改、移动、复制、删除与建目录，并支持预览、用户批准、备份与回滚。

## Requirements

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

### Requirement: move_path bidirectional rollback

`move_path` apply 失败时 MUST 同时正确处理 source 与 target：从 backup 恢复 source；若 target 被部分写入则恢复 target backup。系统 MUST 暴露 rollback 能力且中间态 MUST 可诊断。

#### Scenario: Move failure restores both sides

- **WHEN** move 在写入 target 后失败
- **THEN** source 从 backup 恢复
- **AND** target 恢复至 move 前状态（若曾存在）

#### Scenario: Rollback audit recorded

- **WHEN** 用户触发 file draft rollback
- **THEN** audit outcome=rolled_back
- **AND** 文件内容与 backup 一致

### Requirement: mkdir low-risk direct create with timeline feedback

**产品决策**：内容源内、父目录存在、目标不存在的 mkdir MUST 直建（无 draft）。时间线 MUST 展示相对路径与「低风险直建」标签。其他情况 MUST 走 draft 审批。

#### Scenario: In-source mkdir direct

- **WHEN** mkdir 目标在活跃内容源内且父目录存在、目标不存在
- **THEN** 目录立即创建
- **AND** MUST NOT 创建 draft 记录
- **AND** 时间线 title 含路径与「低风险直建」

#### Scenario: Out-of-scope mkdir drafts

- **WHEN** mkdir 路径在内容源外或目标已存在
- **THEN** 生成 draft 且需批准

### Requirement: Symlink and junction path hardening

写/移动/删除前 MUST 使用 `lstat`（不 follow symlink）验证；创建目标前 MUST `realpath` 验证父路径在 content root 内。Windows junction 指向 root 外 MUST 返回 `scope_denied`。

#### Scenario: Junction escape blocked

- **WHEN** 路径经 junction 指向内容源外
- **THEN** 返回 `scope_denied`
- **AND** MUST NOT 写入

#### Scenario: Symlink file not followed for write target

- **WHEN** 目标路径为 symlink
- **THEN** 系统 MUST 按 spec 拒绝或写入 link 本身而不 follow 到 root 外
