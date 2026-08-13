# capability-manifest Specification

## Purpose
Capability Manifest 为 KnowMe 的 Expert、Skill、Connector 与 Pack 提供统一、可验证且向后兼容的声明语义，使 Hub 和运行时共享同一依赖、权限、风险与来源事实。
## Requirements
### Requirement: Manifest v2 has a normalized common shape

统一声明 MUST 包含 `schemaVersion=2`、`id`、`kind`、`name`、`version`，并规范化 `description`、`dependencies`、`permissions`、`inputs`、`outputs`、`risk` 与 `provenance`；运行状态 MUST NOT 写入声明。

#### Scenario: Valid v2 manifest is normalized

- **WHEN** 系统读取合法 v2 sidecar
- **THEN** 返回稳定的统一声明 DTO
- **AND** 缺省集合字段 SHALL 规范化为空数组或空对象

#### Scenario: Invalid v2 manifest is rejected

- **WHEN** 必填字段、kind、版本、依赖或风险字段不合法
- **THEN** 系统 MUST 返回字段级错误
- **AND** MUST NOT 安装该能力

### Requirement: Legacy capabilities adapt without source mutation

无 v2 sidecar 的 SKILL.md、EXPERT.md、connector manifest、Cursor linked 能力和 pack.json MUST 可适配为统一声明，适配 MUST NOT 修改原始来源文件。

#### Scenario: Legacy skill imports without sidecar

- **WHEN** 用户导入仅包含 SKILL.md 的合法技能
- **THEN** 系统 SHALL 从 frontmatter 构造 skill v2 声明
- **AND** 保持原 SKILL.md 内容和 L0–L3 行为不变

#### Scenario: Legacy connector manifest adapts

- **WHEN** connector manifest 使用现有 type、mcp 和 allowlist 字段
- **THEN** 系统 SHALL 映射统一权限、输入输出、风险和 provenance

### Requirement: Dependencies form a validated directed graph

依赖 MUST 使用能力 ID、可选 kind、必需性和版本范围表达；系统 MUST 检测重复依赖、自依赖、依赖环与缺失必需依赖。

#### Scenario: Required dependency is missing

- **WHEN** 能力声明引用不存在或未启用的 required dependency
- **THEN** 安装或启用 MUST 被阻止并列出缺失项

#### Scenario: Optional dependency is missing

- **WHEN** 能力声明仅缺少 optional dependency
- **THEN** 操作 SHALL 继续
- **AND** 返回可展示警告

#### Scenario: Dependency cycle exists

- **WHEN** 待验证能力图包含直接或间接环
- **THEN** 系统 MUST 拒绝并返回环路径

### Requirement: Risk and provenance are normalized

风险等级 MUST 规范化为 `low|medium|high|critical`，并可包含原因；provenance MUST 表达来源类型、引用、信任和内容哈希。

#### Scenario: Executable connector is high risk

- **WHEN** legacy MCP connector 可启动本地命令但未显式声明风险
- **THEN** adapter SHALL 至少推导为 high risk
- **AND** provenance SHALL 标记其适配来源

### Requirement: Sidecar materialization is optional and deterministic

安装流程 MAY 在受管能力目录生成 `capability.manifest.json`，相同来源内容 MUST 生成语义等价的 sidecar；linked 来源 MUST NOT 被写入。

#### Scenario: Managed legacy package installs

- **WHEN** legacy 能力完成校验并复制到受管目录
- **THEN** 系统 SHALL 写入规范化 sidecar 供后续读取

#### Scenario: Linked repository capability registers

- **WHEN** Cursor linked 能力完成注册
- **THEN** 统一声明 SHALL 存入 install/catalog 元数据或按需适配
- **AND** 原仓库 MUST 保持不变

