# RQA92 — 专家房调整路径动作通用化

日期：2026-09-08

## 问题

专家房的调整路径按钮和提交文案曾硬编码为“改用飞书内容继续”。这会把通用 Agent 平台误表现成飞书专用流程，也会误导非飞书专家的能力边界反馈。

## 修正

- 调整路径动作统一使用“确认建议路径”。
- 提交内容改为通用的“确认改用建议路径继续当前任务，并保持原目标”。
- 保留现有 `reroute` attention 协议和队列/附件边界，不改变 Feishu 专用路径判定逻辑。

## 验证

- `npx vitest run src/renderer/features/expert/rqa19-provide-input-boundaries.spec.tsx src/renderer/features/expert/expert-layout-contract.spec.ts`
- 结果：2 个文件、18/18 通过。
- `npm run typecheck:renderer`：通过。
- `npm run lint`：通过；仅保留既有文件长度 advisory warnings。
