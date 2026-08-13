# Design: rename-workbench-tab-copy

## Context

三 Tab 已是「任务 / 工作流 / 管线服务」。surface 代码名 `taskhome` / `shelf` / `daemon` 稳定，仅改中文文案。

## Goals / Non-Goals

- Goals：用户可见词表与 Tab 对齐；减少裸「任务」「货架」。
- Non-Goals：不改路由、存储、英文 id；不批量改 openspec/changes 历史文档与代码注释（仅触达用户面与必要测试/主规格）。

## Decisions

1. **货架 → 工作流**：退路「返回工作流」；空态「还没有工作流」；删除确认「从工作流中移除」。
2. **任务 Tab → 专家协作**：页内「快捷专家 / 新建协作 / 最近协作 / 协作目标」。
3. **工作流页记录**：「工作流任务」→「工作流运行」；卡片「开始任务」→「开始运行」。
4. **标识符保留**：`data-wb-mode="tasks"`、`wbTask*`、`shelf*` 不变。

## Risks

- 测试硬编码旧文案需同步。
- 「专家协作」略长，窄窗 Tab 需手测不截断。
