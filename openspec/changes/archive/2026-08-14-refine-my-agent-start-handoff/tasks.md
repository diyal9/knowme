# Tasks: refine-my-agent-start-handoff

## 1. 助理侧：身份前置与降级说明

- [x] 1.1 `renderLaunchIntroHtml(sectionMeta, intro)` 支持自定义引导文案，默认行为保持不变
- [x] 1.2 `renderExpertEmptyState` 前置身份区：图标标记 + 名称 + 来源徽标 + 职责说明
- [x] 1.3 readiness 含 `limited` 时补「仍可直接对话」说明，与「去配置连接器」并存
- [x] 1.4 专家 `avatar` 为 emoji 时不直出，改走图标语义
- [x] 1.5 首屏顺序调为「身份 → 能力状态 → 输入 → 快捷任务」，输入框占位符点名当前 Agent

## 2. 助理侧：启动不被渲染层否决

- [x] 2.1 `startExpertChat` 移除「目录查不到即失败」的前置否决，改由主进程权威校验
- [x] 2.2 显示名退回链：session → 目录 → expertId
- [x] 2.3 失败只反馈一条：`createNewAgent` 已弹过的错误不再由调用方重复弹
- [x] 2.4 失败恢复 `surfaceMode`，不留半切换状态

## 3. 工作台侧：卡片身份与交互态

- [x] 3.1 `agentCardHtml` 增加图标标记与能力标签（技能 / 连接器数量）
- [x] 3.2 `handleMyAgentAction('start')` 增加 pending 态与防连点
- [x] 3.3 失败恢复：按钮回到可点击态，留在工作台，提示可执行下一步
- [x] 3.4 样式：按压反馈、`focus-visible` 焦点环、pending 脉冲、`prefers-reduced-motion` 兜底
- [x] 3.5 新增 `src/lib/agent-identity.js`，卡片与会话首屏共用同一套图标/徽标口径

## 4. 门禁与证据

- [x] 4.1 更新 `tests/workspace-agent.test.js`（含既有 `renderLaunchIntroHtml(expert.name)` 断言）
- [x] 4.2 更新 `tests/workbench-templates.test.js` 卡片与交互态断言
- [x] 4.3 `npm test`（1574/1574）与 `npm run lint` 通过
- [x] 4.4 Electron 真机冒烟 24/24 + 截图，写 `evidence/dev-self-test.md`
