# slash-skill Specification

## Purpose

自定义技能 + AI 助写 `/` 快捷引用。

## Requirements

### Requirement: Custom skill with slash

用户 MUST 能在设置知识库新建技能并设置 `slash` 命令。

创建入口 MUST 使用应用内抽屉表单，MUST NOT 依赖 `window.prompt`（Electron 下不可用）。

### Requirement: Slash picker

AI 助写输入 `/` 时 MUST 展示可过滤技能列表。

### Requirement: Inject referenced skills

发送含 `/slash` 的助写请求时 MUST 将该技能正文注入动态上下文。
