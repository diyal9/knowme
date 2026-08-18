# Dev self-test — harden-llm-call-and-prompt-assembly

日期：2026-08-18

- `npm run check`：pass（unit + lint + renderer + typecheck）
- 单测：`tests/main-llm-bridge.test.js`（once-shot 与 dispatch 同客户端）
- 单测：`src/renderer/features/workbench/store-workbench-dialogue.spec.tsx`（任务房不调 aiGenerate）
- 渲染：`run.spec.tsx` 管线发送为 ack 回执，不进入 generating
