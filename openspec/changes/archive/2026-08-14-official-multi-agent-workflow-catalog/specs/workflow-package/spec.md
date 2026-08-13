## MODIFIED Requirements

### Requirement: Official packages are readonly and forkable

Workflow Package Store MUST 拒绝直接修改 `source=official` 的包（除非显式 `allowOfficial`）；用户 MUST 能 fork 为 personal/forked 后再编辑。官方包 MUST 可通过 local-team 图执行路径启动（当 graph 完整且专家可用时）。

#### Scenario: Official save blocked

- **WHEN** 客户端尝试直接 save 覆盖官方包且未设置 allowOfficial
- **THEN** 返回 official_readonly 错误

#### Scenario: Official graph launch

- **WHEN** 用户启动带完整 graph 的官方包
- **THEN** 系统走与个人图工作流相同的 Agent Graph / local-team 确认与执行路径
