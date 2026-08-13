## Purpose

为 KnowMe 默认根 LLM Wiki 提供可独立验证的目录与操作契约，确保初始化、读取、编辑、保存和索引刷新始终在授权边界内完成，并向自动化门禁输出稳定的机器可读结果。

## ADDED Requirements

### Requirement: Root LLM Wiki initializes deterministically

系统 MUST 在首次使用前建立唯一默认根 LLM Wiki，并确保存在用户资料区 `raw/`、稳定知识区 `concepts/` 与隐藏运行元数据；初始化 MUST 幂等且不得写入会污染用户检索的示例事实。

#### Scenario: First launch creates root contract
- **WHEN** 新用户首次启动 KnowMe 或首次打开“我的知识”
- **THEN** 根 LLM Wiki 及其必需目录和版本元数据被自动建立
- **AND** 用户无需选择或连接知识库

#### Scenario: Repeated initialization preserves content
- **WHEN** 已有根库再次执行初始化
- **THEN** 现有用户资料保持不变
- **AND** 缺失的契约目录或元数据被安全补齐

### Requirement: Harness validates root health

系统 MUST 提供可独立运行的 LLM Wiki Harness，检查根路径、目录契约、允许文件类型、非法符号链接、越界风险和可索引文件，并输出包含 `ok`、版本、根路径、统计与问题列表的机器可读报告。

#### Scenario: Healthy root passes
- **WHEN** Harness 检查满足目录与文件契约的根库
- **THEN** 返回 `ok: true` 的机器可读报告
- **AND** 报告包含 raw 文件数、稳定知识数和检查时间

#### Scenario: Invalid root fails visibly
- **WHEN** 根库缺失必需目录、包含越界链接或不允许的资料文件
- **THEN** Harness 返回 `ok: false`
- **AND** 每个问题包含稳定类型、相对路径和可读说明

### Requirement: Raw operations are confined and atomic

所有用户可编辑资料写操作 MUST 仅允许作用于根库 `raw/` 内的 Markdown 或纯文本文件，MUST 拒绝目录穿越、绝对路径、符号链接逃逸、超限内容和不允许的扩展名，并 MUST 使用同目录临时文件完成原子替换。

#### Scenario: Valid raw save succeeds
- **WHEN** 用户保存 `raw/` 内允许类型且未冲突的资料
- **THEN** 内容被原子写入
- **AND** 返回新的内容哈希与更新时间

#### Scenario: Path escape is rejected
- **WHEN** 写入路径包含目录穿越、绝对路径或解析到 `raw/` 之外
- **THEN** 操作被拒绝
- **AND** 根库外文件不发生变化

#### Scenario: Stale edit is rejected
- **WHEN** 用户提交的预期内容哈希与磁盘当前内容不一致
- **THEN** 保存被拒绝并返回冲突错误
- **AND** 磁盘当前内容保持不变

### Requirement: Successful mutations refresh retrieval state

通过 Harness 成功创建或保存资料后，系统 MUST 刷新根库索引并清理相关读取缓存；操作失败时 MUST NOT 发布新的索引状态。

#### Scenario: Saved raw content becomes searchable
- **WHEN** 用户成功保存包含新关键词的 raw 资料
- **THEN** 后续根库搜索能够命中新内容并返回该资料路径
