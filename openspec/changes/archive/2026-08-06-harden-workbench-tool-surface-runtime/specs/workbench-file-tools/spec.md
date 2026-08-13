## ADDED Requirements

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
