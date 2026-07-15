# QA Plan: skill-pack-auto-okf

## Smoke Scope（必填）

- [x] 同主题建 3 张有效便签 → 出现封装提示
- [x] 点「封装为技能包」→ Toast 成功；设置知识库「技能包」可见对应条目
- [x] 设置中打开技能 → 改正文保存 → 再打开看到更改
- [x] 对已封装主题便签打开 AI 助写 → 不报错（有 Key 时上下文含技能）

## Regression Scope

- [x] 原有「收录到知识库」(concepts/) 仍可用
- [x] 知识库导入/导出含 skills 主题
- [x] 「暂不」后不再弹同一轮提示

## Anti-pattern Checks

- [x] 无内容空便签不计入 ≥3
- [x] 无 API Key 时仍能本地模板封装成功
- [x] 不将开发 Agent 的 ≥3 记忆提示混入产品 UI
