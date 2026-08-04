# 开发自测报告

- 日期：2026-08-03
- Change：`agent-task-preflight-ask`
- `node --check src/workspace-agent.js`：PASS
- `npm test`：PASS（720/720，123 suites；含新增 preflight 冒烟用例 +1）
- `npm run lint`：PASS（lint ok / script-scope ok）
- 代码级冒烟：新增 `tests/workspace-agent.test.js` 中「gates task cards behind a deterministic preflight…」用例，静态断言覆盖：
  - `TASK_PREFLIGHT` / `PROMPT_TO_TASK` / `need: feishuAuth|material`
  - `taskContextReady` / `askForTaskContent`（缺内容只推 system-note，不调用模型）
  - `pendingShortcut` 暂存与 `runAI` 续跑
  - 空态卡片与快捷菜单统一走 `runTaskCard`
  - remote-rag 缺主题一句话询问
- Electron 实机：已 `npm start` 重启（主进程正常启动、`workspace-agent.js` 200 重载、无启动报错）；桌面级点击冒烟无法从命令行自动化，交由制作人 / 测试按 qa-plan 走 Electron 实机

## 变更范围

- 单文件：`src/workspace-agent.js`（纯渲染层，未触碰主进程 `ai-generate` 与 LLM 协议）

## 已实现

- `TASK_PREFLIGHT`（12 任务）+ `PROMPT_TO_TASK` 反查表
- `shortcutHasMaterial` / `taskContextReady` / `askForTaskContent` / `runTaskCard`
- `pendingShortcut` 状态 + `runAI` 顶部续跑挂接
- 空态卡片点击与快捷菜单 `runQuickAction` 统一走 `runTaskCard`
- 知识管家 `remote-rag` 缺主题一句话询问

## 未覆盖 / 备注

- 一句话询问路径不经 LLM，无法用现有单测断言"未调用模型"，依赖 qa-plan 实机冒烟核对
- 飞书授权类未做一键内联跳转，属 Non-goal，后续迭代
