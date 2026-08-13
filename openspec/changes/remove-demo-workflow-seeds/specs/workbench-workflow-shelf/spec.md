## ADDED Requirements

### Requirement: No built-in demo vertical seeds on the shelf

工作流货架 MUST NOT 注入仅用于演示或垂直切片占位的内置种子工作流（包括但不限于「会议资料 → 纪要与待办」「需求 → 实现 → 测试 → 交付」「Brief → 生成 → 审阅 → 导出」的官方种子条目）。货架 MUST 仅汇集个人编排、仓库投影与 Daemon 目录中的真实工作流。

#### Scenario: Built-in vertical seeds are absent

- **WHEN** 用户打开工作台「工作流」货架，且本机没有对应个人副本
- **THEN** 货架不出现上述三条内置官方种子卡片

#### Scenario: Personal copies remain

- **WHEN** 用户此前已将某种子「复制并调整」为个人工作流
- **THEN** 该「我的」条目仍出现在货架上，不受种子废除影响
