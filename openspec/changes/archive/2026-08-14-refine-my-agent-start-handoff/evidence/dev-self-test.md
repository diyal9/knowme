# 开发自测: refine-my-agent-start-handoff

日期：2026-08-10 · 角色：开发

## 硬门禁

| 项 | 命令 | 结果 |
|---|---|---|
| 单元/集成测试 | `npm test` | PASS 1574/1574 |
| Lint | `npm run lint` | PASS（lint ok + script-scope ok） |

## 真机冒烟

脚本：`evidence/agent-start-handoff-electron-smoke.js`（Playwright + Electron，干净 userDataDir，种子 Agent `ui-expert` 带 1 技能 + 1 未授权连接器）
报告：`evidence/agent-start-handoff-electron-smoke.json` — **24/24 PASS，渲染层 console 错误 0**

| 检查 | 覆盖的边界 |
|---|---|
| `card-identity-mark-is-icon` | 卡片头像是 SVG 图标，无 emoji 文本 |
| `card-source-badge` / `card-capability-chips` | 来源徽标与「1 个技能 / 1 个连接器」能力标签 |
| `start-button-focus-ring` | 用 Tab 键真实走到按钮，`:focus-visible` 命中且 outline 非 0 |
| `pending-state-visible` / `pending-state-released` | 等待期间按钮禁用 + 「正在打开…」+ 卡片 `is-starting`；释放后复原 |
| `double-click-creates-one-session` | 连点两次只新增 1 个会话（1 → 2） |
| `chat-shows-agent-name` / `-source-badge` / `-duty` | 聊天首屏身份与卡片一致（均为「UI 专家」） |
| `identity-precedes-generic-copy` / `capabilities-precede-composer` | 顺序：身份 → 能力状态 → 输入 → 快捷任务 |
| `generic-knowme-copy-replaced` | 通用「把你的问题或任务交给 KnowMe」不再占据首屏 |
| `composer-placeholder-names-agent` | 输入框占位符点名当前 Agent |
| `degraded-explicitly-permits-chat` | 2 个受限项时出现「有依赖未就绪，仍可直接对话…」 |
| `start-survives-catalog-failure` / `identity-survives-catalog-failure` | 把 `expertList` 打成抛错后仍能开聊且身份正确 |
| `missing-agent-fails-once` / `failed-start-restores-button` | 不存在的 Agent：只报一条、留在工作台、按钮回到「开始使用」 |
| `narrow-window-no-h-scroll` | 760×620 下无横向滚动且卡片仍可见 |
| `renderer-console-errors` | 全程 0 条渲染层错误 |

## 截图

![我的智能体卡片](screenshots/my-agent-shelf-cards.png)

![专家会话身份前置](screenshots/expert-chat-identity.png)

![窄窗口](screenshots/my-agent-shelf-narrow.png)

## 自测中修正的问题

1. 首版把能力状态放在「开始使用」标题之下，读起来像启动选项 → 上移到身份区正下方，首屏顺序改为「身份 → 能力 → 输入 → 快捷任务」。
2. 首版输入框仍是「给 KnowMe 发送消息…」，把刚建立的身份感冲掉 → 专家会话改为「告诉「<Agent 名>」你的目标…」。
3. 冒烟脚本首版用程序化 `focus()` 断言焦点环，Chromium 下 `:focus-visible` 不命中（假失败）→ 改为按 Tab 键真实导航后断言。
4. 冒烟脚本首版靠 60ms 采样观测 pending，真实 IPC 太快导致漏采（假失败）→ 改为用可控 gate 挂住启动再观测与释放。

## 已知边界（非本次范围）

- 助理侧「我的专家」与工作台「我的智能体」的心智重叠仍未解决，沿用上一轮结论。
- 卡片能力标签只报数量，不展开具体技能名；具体绑定仍需进入「调优」查看。
