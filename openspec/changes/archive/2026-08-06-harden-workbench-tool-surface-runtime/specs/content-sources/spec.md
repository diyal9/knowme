## ADDED Requirements

### Requirement: Content root path resolution hardening

内容源路径解析 MUST 在写/移动/创建目录前使用 `realpath`/`lstat` 验证目标仍在绑定 root 内；symlink/junction 逃逸 MUST 返回 `scope_denied`。

#### Scenario: Parent realpath outside root

- **WHEN** 父路径 realpath 解析到 content root 外
- **THEN** 工具返回 `scope_denied`
- **AND** MUST NOT 创建或修改文件

#### Scenario: Windows junction negative test

- **WHEN** 测试 fixture 含指向 root 外的 junction
- **THEN** resolveUnderRoot MUST 拒绝
- **AND** 单测 MUST 覆盖该负例
