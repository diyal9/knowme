# ai-assistant（delta）

## MODIFIED Requirements

`@` 引用绑定内容源文件，不引用便签库。

#### Scenario: Empty catalog when no sources

- **WHEN** 用户未绑定内容源并输入 `@`
- **THEN** 菜单提示没有可引用文件，而不是列出历史便签
