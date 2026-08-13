## ADDED Requirements

### Requirement: Hub exposes capability governance facts

能力详情 MUST 展示统一声明中的 required/optional 依赖、权限、输入、输出、风险、来源证据和信任状态，不得以硬编码空依赖代替真实数据。

#### Scenario: User opens governed capability

- **WHEN** 用户打开具有统一声明的能力详情
- **THEN** 抽屉 SHALL 展示真实治理字段
- **AND** legacy 适配字段 SHALL 标明其 provenance

### Requirement: Hub enforces dependencies and risk confirmation

安装或启用能力前，Hub MUST 验证 required dependencies；对 high 或 critical 风险能力 MUST 在写入状态前取得明确确认。

#### Scenario: Required dependency is unavailable

- **WHEN** 用户安装或启用缺少必需依赖的能力
- **THEN** 操作 MUST 被阻止
- **AND** UI SHALL 提供缺失依赖 ID 和可操作说明

#### Scenario: User rejects high-risk confirmation

- **WHEN** 用户拒绝 high/critical 能力的风险确认
- **THEN** install store MUST 保持原状态

#### Scenario: Optional dependency is unavailable

- **WHEN** 能力仅缺少可选依赖
- **THEN** UI SHALL 显示警告但允许用户继续
