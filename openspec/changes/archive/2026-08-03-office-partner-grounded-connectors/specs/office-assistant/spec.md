# Delta Spec: office-assistant

## ADDED Requirements

### Requirement: Writing office partner performs grounded professional polish

写作办公搭档在润色、改写、扩写场景中 MUST 优先结合可用资料源，而不是只做脱离上下文的语言替换。

#### Scenario: Polish a Feishu document with full body

- **GIVEN** 用户提供飞书文档链接
- **WHEN** 系统已成功读取正文
- **THEN** 助手的润色或改写 MUST 基于正文内容执行
- **AND** 输出 SHOULD 保持术语、事实和结构边界

#### Scenario: Polish with knowledge and RAG support

- **GIVEN** 用户的请求涉及专业背景或知识判断
- **WHEN** 本地知识库或远程 RAG 存在命中
- **THEN** 助手 SHOULD 先吸收相关事实再执行润色改写
- **AND** 未命中时必须明确说明，而不是编造背景知识

#### Scenario: Polish with active source materials

- **GIVEN** 当前 active source 来自本地目录、GitLab、GitHub 或网页
- **WHEN** 用户请求围绕该资料继续润色或改写
- **THEN** 助手 MAY 通过 `read_file` / `grep_files` / `semantic_search` 补充上下文
- **AND** 结果 MUST 体现对资料内容的理解，而不是只改写用户一句提示
