# Code review — harden-llm-call-and-prompt-assembly

结论：收尾时对照源码复核，任务均有对应实现。

- `src/lib/knowme-system-prompt.ts`：`assembleCorePrompt` 按 tier 装配
- `src/lib/main-llm-bridge.ts`：`chatCompletionOnce` → `requestAgentCompletion`
- `src/ipc/workbench-dispatch.ts`：只走 `requestAgentCompletion`
- `src/ipc/ai-assist.ts`：`llm-probe`
- `src/renderer/features/workbench/store-workbench-dialogue.ts`：任务房禁止 `aiGenerate`
