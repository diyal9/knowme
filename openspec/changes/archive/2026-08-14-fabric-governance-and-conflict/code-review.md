# Code Review · fabric-governance-and-conflict

## Summary

P4 治理垂直切片：后端 `fabric-governance.js` + IPC + 知识中心治理 Tab。SSOT 默认 mark，与路线图一致。

## Strengths

- 联合体检聚合 Wiki/OKF/graph 多源问题，每项带 actions
- 循环依赖通过 lazy require + 本地 lexicalSimilarity 解耦
- UI 复用 `runAsyncKnowledgeButton`，避免织网类卡死

## Risks / Follow-ups

- `resolveProviderRoot` 在 weave/governance 各有一份，后续可抽 `fabric-utils`
- 调和提案 apply 仅建 refines 边，复杂冲突仍须 AI/人工
- workbench-templates 5 失败为仓库既有项，非本 change 引入

## Verdict

**Approve for QA**（fabric 相关测试 18/18 + lint 通过）
