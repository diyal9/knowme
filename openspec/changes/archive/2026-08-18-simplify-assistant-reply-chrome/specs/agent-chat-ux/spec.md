## MODIFIED Requirements

### Requirement: Apply-to-file menu

助手气泡 MUST NOT 再提供「应用到文件」或插入光标 / 追加文末 / 替换全文。独立笔记编辑器已退役；对文件的写入 MUST 走产物卡（`editor_patch`）人审。

#### Scenario: No apply-to-file on completed reply

- **WHEN** 助手回复完成且非空
- **THEN** 气泡内不展示「应用到文件」
- **AND** 不展示插入光标、追加文末、替换全文

#### Scenario: File write stays on artifact card

- **WHEN** 本轮存在 `editor_patch` draft 产物
- **THEN** 用户仍可通过产物卡接受后写入目标文件

## ADDED Requirements

### Requirement: Compact execution chrome

生成过程 MUST 以单行进度表达当前活动与耗时，外层保留一张过程卡。MUST NOT 同时叠内部步骤灰条、thinking 胶囊与过程卡三套同一文案。

#### Scenario: Single-step running is one line

- **WHEN** 助手正在生成且过程只有准备/整理一步
- **THEN** 只显示一条「正在整理相关内容」及耗时
- **AND** 不在其下再重复一条 thinking 状态条

#### Scenario: Multi-step can expand

- **WHEN** 过程包含工具或多步
- **THEN** 可展开步骤列表，外层一张过程卡，步骤行不再套第二层灰底卡片
