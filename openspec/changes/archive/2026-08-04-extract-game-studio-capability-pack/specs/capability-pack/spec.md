## Purpose

Capability Pack 将专家、技能、连接器、知识、工作流和任务场景组合为可发现、可安装、可启停并可安全迁移的垂直工作能力单元。

## ADDED Requirements

### Requirement: Capability packs use a validated portable manifest

系统 MUST 使用版本化 `pack.json` 描述能力包身份、版本、Expert、Skill、Connector、Workflow、Knowledge、场景、依赖、权限和 UI 元数据；无效 schema、标识或版本 MUST 被拒绝。

#### Scenario: Valid bundled pack is discovered

- **WHEN** bundled pack 目录包含合法 `pack.json`
- **THEN** 系统 SHALL 返回名称、描述、版本、组合能力、依赖与权限摘要

#### Scenario: Invalid manifest is rejected

- **WHEN** pack id 不是小写 kebab-case、版本不是 semver 或 schemaVersion 不受支持
- **THEN** 系统 MUST 返回可读校验错误
- **AND** MUST NOT 写入 pack store

### Requirement: Capability pack lifecycle is persistent

系统 MUST 支持能力包发现、安装、启用、禁用和卸载，并在用户数据目录持久化版本、来源、状态、时间与内容哈希。

#### Scenario: Install bundled pack

- **WHEN** 用户安装可用的 bundled pack
- **THEN** pack store SHALL 记录 enabled 状态、版本、来源、安装时间和内容哈希

#### Scenario: Disable installed pack

- **WHEN** 用户禁用已安装能力包
- **THEN** 该能力包的场景和空状态入口 MUST NOT 再参与运行时发现

#### Scenario: Uninstall imported pack

- **WHEN** 用户卸载从目录复制安装的能力包
- **THEN** 用户副本与 store 条目 SHALL 被移除
- **AND** bundled 原始目录 MUST 保持只读不变

### Requirement: Pack dependencies and file access are constrained

启用能力包前系统 MUST 验证必需 pack 依赖已启用；读取 pack 内资源 MUST 限制在该 pack 根目录，拒绝目录穿越。

#### Scenario: Dependency is missing

- **WHEN** 用户启用的能力包声明了未启用的必需依赖
- **THEN** 系统 MUST 阻止启用并列出缺失依赖

#### Scenario: Resource path escapes pack

- **WHEN** pack 资源请求解析到 pack 根目录之外
- **THEN** 系统 MUST 拒绝读取

### Requirement: Third-party packs do not require core source changes

系统 SHALL 允许从本地目录安装符合相同 manifest 契约的第三方能力包，并通过通用运行时提供其场景和 UI 分组。

#### Scenario: Install a minimal third-party pack

- **WHEN** 用户选择包含合法 manifest 与场景的第三方目录
- **THEN** 系统 SHALL 复制并安装该能力包
- **AND** 其空状态分组 SHALL 可在不修改核心代码的情况下出现

### Requirement: Renderer accesses packs only through IPC

能力包文件校验、复制和 store 读写 MUST 由 Electron 主进程执行；Renderer MUST 仅通过 preload 暴露的最小 API 访问 DTO。

#### Scenario: Renderer lists packs

- **WHEN** 工作台请求能力包和空状态分组
- **THEN** preload SHALL 通过受控 IPC 返回 DTO
- **AND** Renderer MUST NOT 获得 Node 文件系统权限
