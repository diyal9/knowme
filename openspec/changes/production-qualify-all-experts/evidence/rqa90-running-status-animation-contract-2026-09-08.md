# RQA90 — 执行中状态动效回归契约

日期：2026-09-08

## 变更

在专家房布局契约中增加执行中状态点回归断言，确保顶部 `tone-running` 状态点持续使用 `agent-dialogue-status-pulse` 动效，并保留 `prefers-reduced-motion` 下的无动画降级。

## 验证

- `npx vitest run src/renderer/features/expert/expert-layout-contract.spec.ts`：11/11 通过。
- `npm run lint`：通过；仅保留既有文件长度 advisory。

## 判定

“专家执行中”不再只是静态文字和原点，UI 契约会阻止状态动效在后续重构中回退；无障碍减弱动效偏好仍被尊重。
