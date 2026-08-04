# Delta Spec: connector-sdk

## ADDED Requirements

### Requirement: Connectors manageable in Capability Hub

连接器 MUST 在 Capability Hub「连接器」Tab 中列出、安装、编辑、启用/禁用。内置 `feishu` 与 `mcp` 类型 MUST 作为 curated template 出现。

#### Scenario: Hub lists built-in templates

- **WHEN** 用户打开 Hub 连接器 Tab 且无用户配置
- **THEN** 列表含 feishu 与 mcp 模板卡片，无 secret 明文

#### Scenario: Install connector template

- **WHEN** 用户安装 feishu 模板
- **THEN** 配置写入 `%APPDATA%\KnowMe\capabilities\connectors/<id>/`
- **AND** install store 记录 enabled 默认 false 直至用户完成授权

### Requirement: Curated connector templates

系统 MUST ship 内置 curated templates（至少 feishu、mcp-generic），含 manifest、默认 allowlist 空集、health probe 配置。

#### Scenario: Template manifest valid

- **WHEN** 应用启动加载 curated catalog
- **THEN** 每个 connector template 通过 manifest schema 校验

### Requirement: Feishu JIT auth and write-review preserved

飞书连接器 MUST 保留即需即授（JIT）增量授权与写草稿审批行为；入口迁移到 Hub MUST NOT 改变对话内 CTA 与审批流。

#### Scenario: JIT auth from agent chat still works

- **WHEN** 飞书工具因缺 scope 失败
- **THEN** 对话内仍显示增量授权卡片，与 Hub 配置入口无关

#### Scenario: Write draft review unchanged

- **WHEN** Agent 通过飞书连接器发起写操作
- **THEN** 仍走写草稿审批流，Hub 仅管理连接器配置

## MODIFIED Requirements

### Requirement: Config persists without secrets

Connector configuration MUST persist under `%APPDATA%\KnowMe\capabilities\connectors/` and MUST NOT store Feishu access tokens or MCP secret values in plaintext beyond optional `env:VAR_NAME` references.

#### Scenario: Upsert mcp command

- **WHEN** 用户在 Hub 保存 MCP 连接器 command 与 args
- **THEN** 字段持久化且 secret env 值 omitted from disk

### Requirement: Allowlist controls Agent visibility

Each connector MUST support an allowlist of tool names editable in Hub detail drawer; tools not allowlisted MUST NOT be projected to the Agent tool table.

#### Scenario: Hub allowlist editor

- **WHEN** 用户在 Hub 连接器抽屉勾选 allowlist 工具
- **THEN** 保存后 Agent 仅见勾选工具

#### Scenario: Empty allowlist

- **WHEN** a connector is enabled but allowlist is empty
- **THEN** status remains readable but no Agent tools are projected from that connector

### Requirement: Status probe is read-only

Status checks MAY spawn local CLIs for health (L0) but MUST NOT create, update, or delete platform data. Hub MUST 显示 health badge（绿/黄/红）。

#### Scenario: Health badge in Hub

- **WHEN** 连接器 health probe 成功
- **THEN** Hub 卡片显示绿色 health 状态

#### Scenario: Feishu status

- **WHEN** feishu status is requested and `lark-cli` is available
- **THEN** 响应报告 identity readiness 且不写入飞书
