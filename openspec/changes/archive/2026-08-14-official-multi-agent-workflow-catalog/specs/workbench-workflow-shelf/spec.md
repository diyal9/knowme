## MODIFIED Requirements

### Requirement: No built-in demo vertical seeds on the shelf

工作流货架 MUST NOT 注入仅用于演示或垂直切片占位的内置空壳种子（包括历史 id：`office-meeting-to-actions`、`engineering-delivery`、`visual-brief-to-export` 的不可执行占位形态）。货架 MAY 注入 `official-workflow-catalog` 定义的、带完整多 Agent graph 与 Gate 的官方参考工作流。

#### Scenario: Legacy empty demo seeds absent

- **WHEN** 用户打开工作台「工作流」货架
- **THEN** 货架不出现上述历史空壳 Demo 卡片

#### Scenario: Real official references present

- **WHEN** 官方目录模块提供可执行官方 Package
- **THEN** 货架展示这些官方条目，且卡片 provenance 为官方
