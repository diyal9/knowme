## ADDED Requirements

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
