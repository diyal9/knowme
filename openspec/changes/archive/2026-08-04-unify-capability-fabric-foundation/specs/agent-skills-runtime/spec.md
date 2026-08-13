## ADDED Requirements

### Requirement: Skill runtime exposes unified declaration metadata

标准、legacy OKF 与 Cursor linked Skill MUST 在运行时映射为统一声明，并在 L0 元数据中提供依赖、权限、输入输出、风险与 provenance；L1–L3 内容和执行边界 MUST 保持不变。

#### Scenario: Linked skill has sidecar metadata

- **WHEN** 已注册 linked Skill 含合法 v2 sidecar
- **THEN** L0 SHALL 使用 sidecar 治理元数据和 SKILL.md 展示内容
- **AND** 资源与脚本仍受仓库和技能目录双重约束

#### Scenario: Legacy skill lacks sidecar

- **WHEN** SKILL.md 不含 v2 sidecar
- **THEN** runtime SHALL 使用 adapter 返回兼容统一声明
- **AND** 技能仍可按原方式自动匹配和 slash 加载
