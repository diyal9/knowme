# 开发自测 — fix-assistant-mode-picker

时间：2026-08-11

## 变更

- `src/workspace-agent.js`
  - `renderExpertPop()` 数据源由 `availableExperts()`（模式 + 已安装专家）改为 `availableAssistantModes()`（仅内置模式）
  - 新增 `isBuiltinAssistantMode(id)`
  - 新增 `startModeChat(modeId)`：按模式建会话，不产生 `expertId`
  - `selectExpert()` 走 `startModeChat`，成功后提示「已切换到<模式名>」
  - `startExpertChat()` 收到内置模式 id 时委派给 `startModeChat`，避免能力中心等入口复现 `not_found`
  - `availableExperts()` 保留，仅供会话标题解析专家显示名
- `tests/office-assistant-mvp.test.js`：补沙箱行为断言（模式列表不含已安装专家、四个内置模式被识别）+ 更新契约断言

## 结果

| 检查 | 命令 | 结果 |
|---|---|---|
| 本变更契约测试 | `node --test tests/office-assistant-mvp.test.js` | 5 pass / 0 fail |
| 助手渲染层契约 | `node --test tests/workspace-agent.test.js` | 34 pass / 1 fail（见下，与本变更无关） |
| Lint | `npm run lint` | lint ok / script-scope ok |

## 与本变更无关的既有失败

工作树中存在其他进行中的改动，导致两条契约断言与实现不同步：

1. `tests/workspace-agent.test.js:310` 期望 `async function startExpertChat(expertId)`，实现已被改为 `startExpertChat(expertIdOrOptions)`（支持 `goal` / `knowledgeRefs` / `taskRef` 的选项对象）。
2. `tests/workbench-templates.test.js:120` 期望 `WorkspaceAgent.setSurfaceMode(workbenchOn ? 'workbench' : 'agent')`，`src/workspace.js` 已改为把 `workbenchTaskContextKind === 'expert-chat'` 排除在 workbench surface 之外。

两处均不在本变更改动的代码路径上（本变更未触碰 `src/workspace.js`，也未改 `startExpertChat` 的签名）。待对应改动收口后由其负责人同步断言。

## 手工验证清单（待制作人体验验收）

- [ ] 打开助手头部加号菜单：只出现 4 个内置模式，当前模式高亮
- [ ] 依次点击通用 / 知识管家 / 写作 / 编程：均新建会话、空状态与输入框提示随模式变化、无错误 toast
- [ ] 能力中心「我的专家 → 开始使用」：仍能进入绑定该专家的会话
