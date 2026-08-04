# cursor-repository-capability-import Specification

## Purpose
允许用户把现有 Cursor 智能体仓库作为受控的本地能力来源接入 KnowMe，并在不破坏仓库内相对路径依赖的前提下发现、确认和注册专家、技能及安全连接器。
## Requirements
### Requirement: Scan a Cursor repository before registration
系统 MUST 接受本地仓库根目录并扫描标准 Cursor 能力位置，返回包含能力类型、标识、名称、来源路径和警告的预览；扫描阶段 MUST NOT 执行仓库脚本。

#### Scenario: Repository contains agents and skills
- **WHEN** 用户选择含 `.cursor/agents/` 与 `.cursor/skills/` 的仓库
- **THEN** 系统返回可注册专家与技能清单
- **AND** 每个条目包含稳定 ID 与仓库内相对路径

#### Scenario: Repository has no supported capabilities
- **WHEN** 所选目录不存在合法 Cursor Agent、SKILL.md 或 MCP 配置
- **THEN** 系统拒绝注册并提示未发现可导入能力

### Requirement: Adapt Cursor agents and skill-only repositories
系统 MUST 将 `AGENT.md` 与 `agent.manifest.json` 组合适配为 Hub Expert；若仓库没有 Agent 但存在技能，系统 MUST 选择明确的主入口技能或生成仓库级 Expert，并绑定该仓库技能。

#### Scenario: Cursor agent is adapted
- **WHEN** Agent 目录含合法 `AGENT.md` 和/或 `agent.manifest.json`
- **THEN** 预览中的 Expert 保留名称、描述、persona 正文及声明的技能绑定

#### Scenario: Skill-only repository is adapted
- **WHEN** 仓库没有 Agent 且至少存在一个合法技能
- **THEN** 系统生成一个仓库级 Expert
- **AND** 该 Expert 绑定仓库内已发现技能

### Requirement: Register repository capabilities idempotently
系统 MUST 在用户确认后注册所选能力，并以仓库规范路径和能力相对路径形成稳定身份；重复注册同一仓库 MUST 更新现有条目而不是创建重复条目。

#### Scenario: First registration succeeds
- **WHEN** 用户确认合法仓库预览
- **THEN** 专家、技能和连接器写入统一 catalog 与 install store
- **AND** 返回各类型成功、跳过和失败数量

#### Scenario: Repository is registered again
- **WHEN** 用户再次确认同一规范路径仓库
- **THEN** 系统更新已有条目的元数据和内容哈希
- **AND** Hub 中不出现重复卡片

### Requirement: Preserve repository-relative capability context
已注册技能 MUST 从原仓库受控读取 `SKILL.md`、`references/`、`assets/` 与 `scripts/`；任何解析后的路径 MUST 保持在仓库根目录内，脚本执行 MUST 继续受现有 sandbox 权限约束。

#### Scenario: Linked skill reads a resource
- **WHEN** 已注册技能请求读取其 `references/` 下文件
- **THEN** 系统从注册仓库读取该文件
- **AND** 路径穿越仓库根目录的请求被拒绝

#### Scenario: Registered repository moved or removed
- **WHEN** 运行时无法访问已注册仓库路径
- **THEN** 能力显示为不可用并返回可操作的重新定位或移除提示

### Requirement: Protect secrets and require explicit trust
系统 MUST 在注册前扫描 MCP 配置与清单中的敏感字段；明文 secret MUST NOT 写入用户数据，未知本地仓库 MUST 经用户明确确认信任。

#### Scenario: MCP configuration contains plaintext secret
- **WHEN** 仓库 MCP 配置包含明文 token、password 或 API key
- **THEN** 对应连接器注册被阻止
- **AND** 其他安全能力仍可由用户确认后注册

#### Scenario: Unknown repository requires confirmation
- **WHEN** 用户首次注册某本地仓库
- **THEN** UI 展示规范路径、能力数量和风险提示
- **AND** 仅在用户确认后执行注册

