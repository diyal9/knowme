## ADDED Requirements

### Requirement: Capability pack can describe professional work-mode fit
Capability Pack SHALL 能够声明其适用的工作模式、建议 Agent 角色、工作流以及执行提供方，使编码、办公、视觉等专业处理能力可以在同一工作台中被组织，而不需要新增一级产品模块。

#### Scenario: Engineering pack contributes to engineering mode
- **WHEN** 软件工程能力包可用
- **THEN** 系统 SHALL 将其 Agent 角色、编码工作流和 Daemon 执行提供方投影到软件研发模式
- **AND** MUST NOT 将该投影视为其他模式的默认团队

#### Scenario: Pack provider is unavailable
- **WHEN** 能力包声明的执行提供方不可用
- **THEN** 工作台 SHALL 保留能力包及工作模式说明
- **AND** SHALL 标明相关工作流不可运行
- **AND** MUST NOT 伪造成功或静默切换到权限更大的提供方

#### Scenario: Pack has no work-mode metadata
- **WHEN** 旧版能力包未声明工作模式适配信息
- **THEN** 系统 SHALL 继续按既有能力包生命周期加载
- **AND** MAY 将其归入通用能力而不阻断启动

### Requirement: Work-mode projection reuses atomic capability governance
专业能力投影 MUST 复用 Expert、Skill、Connector 与 Workflow 的原子依赖、权限、风险和来源，不得因加入工作模式而自动安装依赖或扩大权限。

#### Scenario: Add pack to a mode with missing dependencies
- **WHEN** 专业能力包缺少必需原子能力
- **THEN** 工作台 SHALL 显示缺失项和修复入口
- **AND** MUST NOT 将相关团队角色或工作流标记为完全可用

#### Scenario: User binding does not expand permissions
- **WHEN** 用户把 Expert 添加到包含专业能力包的工作模式
- **THEN** Expert 实际运行权限 MUST 继续取当前安装状态、连接器授权和工具 allowlist 的交集
- **AND** 工作模式绑定 MUST NOT 自动授权外部写操作
