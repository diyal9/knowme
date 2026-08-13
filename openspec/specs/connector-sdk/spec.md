# connector-sdk Specification

## Purpose
定义 KnowMe 连接器的安全配置、状态探测、Agent 工具可见性，以及在 Capability Hub 中的安装和生命周期管理。
## Requirements
### Requirement: Built-in connectors are listable

The system MUST expose at least built-in connector types `feishu` and `mcp` through `connectors-list`, including enabled and status fields.

#### Scenario: Default list

- **WHEN** the user opens connectors with empty user config
- **THEN** the list includes feishu and mcp entries with safe defaults and no secrets

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
- **THEN** the response reports identity readiness without writing to Feishu

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

### Requirement: Connector manifest and install store are authoritative

受管 Connector 的配置声明 MUST 来自能力目录 manifest，启停与安装状态 MUST 来自 capability install store；`connectors.json` MUST 仅作为兼容投影或 legacy fallback。

#### Scenario: Manifest-only connector runs

- **WHEN** Connector 目录含合法 manifest 且 install store 标记 enabled
- **THEN** 设置页、Hub 与 Agent MCP runtime SHALL 看到同一 Connector
- **AND** 不要求预先存在 `connectors.json` 条目

#### Scenario: Old settings IPC updates connector

- **WHEN** 旧设置页通过现有 IPC 更新 allowlist 或启停
- **THEN** 权威 manifest/install store SHALL 被更新
- **AND** 兼容投影 SHALL 同步反映该状态

### Requirement: Connector migration is idempotent and recoverable

系统 MUST 将 legacy `connectors.json` 条目幂等迁移为能力目录 manifest 与 install store 条目，并在首次迁移前保留备份；本阶段 MUST NOT 删除 legacy 文件。

#### Scenario: Migration runs twice

- **WHEN** 同一用户数据连续执行两次迁移
- **THEN** 不得产生重复 Connector、覆盖较新权威配置或重复备份写入

#### Scenario: Unified read is disabled

- **WHEN** 兼容开关要求 legacy fallback
- **THEN** 系统 SHALL 继续从 `connectors.json` 提供旧行为

