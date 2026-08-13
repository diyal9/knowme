## ADDED Requirements

### Requirement: Assistant autonomously executes time-sensitive research
当本轮存在可用研究工具时，AI 助手 MUST 对明确的实时公开信息任务直接执行搜索与核验，MUST NOT 把工具选择转嫁给用户，也 MUST NOT 在工具成功前声称正在或已经完成外部检索。

#### Scenario: Research tools are available
- **WHEN** 用户请求“今天关于 AI 的资讯”且联网搜索工具可用
- **THEN** 助手调用工具后交付结果
- **AND** 不先询问用户选择飞书知识库或其他内部实现来源

#### Scenario: No executable research source
- **WHEN** 用户请求最新公开信息但本轮没有任何可执行搜索来源
- **THEN** 助手明确说明缺失的能力及可行动的下一步
- **AND** 不生成虚构来源或单项来源选择

### Requirement: Assistant distinguishes publication and retrieval time
对时效研究答案，助手 MUST 区分来源标注的发布时间与本次检索时间；无法验证发布时间时 MUST 标记未知，MUST NOT 用检索时间冒充发布时间。

#### Scenario: Result lacks publication date
- **WHEN** 搜索或原文结果没有可验证的发布时间
- **THEN** 助手将该条目的发布时间标记为未知
- **AND** 仍可单独展示本次检索时间
