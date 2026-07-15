# QA Plan: slash-skill-ref

## Smoke Scope（必填）

- [x] 设置新建技能（标题+slash+正文）保存成功
- [x] AI 助写输入 `/` 看到该技能并可选中
- [x] 发送含 `/slash` 的消息，不报错且上下文含技能

## Anti-pattern

- [x] 无技能时 `/` 提示「暂无技能，去设置新建」
- [x] slash 重名创建时拒绝或自动改名
