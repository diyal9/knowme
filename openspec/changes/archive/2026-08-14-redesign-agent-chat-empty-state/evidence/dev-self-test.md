# 开发自测报告

- 日期：2026-08-07
- Change：`redesign-agent-chat-empty-state`
- OpenSpec strict validate：PASS
- `npm test`：PASS（1279/1279）
- `npm run lint`：PASS（lint + script-scope）
- 定向测试：PASS（`tests/workspace-agent.test.js`，32/32）
- Electron 冒烟：PASS（3/3，无 Renderer console error）

## 覆盖范围

- 空 Session 显示“开始一个新任务”、KnowMe 说明、唯一真实 Composer 和四张图标任务卡。
- Composer 在空状态挂载到首屏中央；首次发送后回到 Chat Log 下方，DOM 中始终只有一个 Composer 和一个 textarea。
- 用户消息右对齐并按内容收缩；助手回复保持左侧阅读轨道。
- 原任务 ID、提示词、模型、附件、快捷命令和 preflight 发送路径保持不变。

## 视觉证据

- `evidence/screenshots/agent-launch-state.png`
- `evidence/screenshots/agent-conversation-state.png`
- 机器检查：`evidence/electron-smoke.json`

## 2026-08-10 助手模式菜单回归

- OpenSpec strict validate：PASS
- `npm test`：PASS（1562/1562）
- `npm run lint`：PASS（lint + script-scope）
- 定向测试：PASS（`tests/office-assistant-mvp.test.js`，3/3）
- 顶栏“+”菜单仅从 Session API 的内置模式列表渲染：通用、知识管家、写作、编程。
- Capability Hub 专家不再混入“+”菜单，专家启动与已有专家 Session 恢复链路保持不变。

## 2026-08-10 四模式入口可用性走查

对四个内置模式的空态卡片与快捷菜单逐项核对「提示词 / 任务 id 映射 / preflight」三要素，发现并修复 4 处缺口：

| 模式 | 入口 | 问题 | 修复 |
|---|---|---|---|
| 写作 | 润色去 AI 味 | 无 preflight，空输入直接发送 | 补 material 追问 |
| 编程 | 问题排查 | 无 preflight，空输入直接发送 | 补 material 追问 |
| 编程 | 改动评审 | 无 preflight，空输入直接发送 | 补 material 追问 |
| 编程 | 发布说明 | 无 preflight，空输入直接发送 | 补 material 追问 |

复核结果：13 张空态卡片 + 18 个快捷菜单项全部具备提示词与 preflight；知识管家 4 个入口均对应 `runStewardTemplate` 已实现分支。

- 回归测试：新增 `tests/agent-mode-entry-coverage.test.js`（5/5 PASS），从源码求值常量表做交叉核对，防止新增入口漏配 preflight。
- `npm test`：PASS（1567/1567）
- `npm run lint`：PASS（lint + script-scope）
- OpenSpec strict validate：PASS

## 2026-08-10 四模式入口真机端到端

`evidence/mode-entries-e2e.js`：Playwright `_electron` 真机启动，逐模式点击缺省入口，验证功能可完整使用。结果 `evidence/mode-entries-e2e.json`（9/9 PASS，Renderer console error 0）：

| 检查 | 结果 |
|---|---|
| “+” 菜单只列四个内置模式 | PASS（general/steward/writing/coding） |
| 写作空态 4 卡渲染 | PASS |
| 写作空输入 → 追问不空发 | PASS |
| 写作补料后 → 进入发送链路（出现用户气泡） | PASS |
| 编程空态 4 卡渲染 | PASS |
| 编程空输入 → 追问不空发 | PASS |
| 通用飞书任务未授权 → 引导授权不空发 | PASS |
| 知识管家 4 入口渲染 | PASS |
| 知识管家健康检查 → 本地 IPC 回填结果 | PASS |

结论：四个模式的空态卡片点击、preflight 追问、补料续发与知识管家本地动作均端到端跑通，无控制台报错。
