# Dev self-test: harden-workbench-chat-fact-citations

## 命令

- `npm test` — PASS **1785/1785**
- `npm run lint` — ok

## 覆盖点

- [x] `workbenchGroundingRules` 含第一性原则 / 引用来源 / 零幻觉
- [x] `buildWorkbenchCitations` 从任务事实、澄清、产物、附件构建列表
- [x] `workbenchContextText` 注入「本轮可用来源」
- [x] 助手气泡 `.agent-workbench-citations`「引用来源」
- [x] 非 workbench surface 不强制渲染该区域

## 手动体验

1. 工作台打开 Daemon 任务 → 问「现在卡在哪」→ 回答应依据任务事实，气泡有「引用来源」
2. 有产物时来源列表含产物
3. 助手模式对话无工作台 citation 空壳
