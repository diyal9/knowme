# Code Review: refine-my-agent-start-handoff

审阅人：开发（自审） · 日期：2026-08-10

## 改动清单

| 文件 | 改动 | 风险 |
|---|---|---|
| `src/lib/agent-identity.js`（新增） | 图标语义 / 来源徽标 / 职责 / 能力标签的单一口径 | 低。纯函数、无副作用、双导出（CommonJS + window） |
| `src/workspace.html` | 加载 identity 模块；身份区与降级说明样式 | 低。仅新增选择器，未改既有规则 |
| `src/workbench.js` | 卡片身份与能力标签；`agentStartPending`；成功后才切视图 | 中。见下「重点核查」 |
| `src/workspace-agent.js` | 去掉目录前置否决；身份前置；占位符点名；`surfaceMode` 回滚 | 中。见下「重点核查」 |
| `src/workbench-shelf.css` | 卡片标记/标签/等待态、按压与焦点环、reduced-motion | 低 |
| `tests/*` | 6 处新增/更新断言 | 低 |

## 重点核查

**1. 去掉渲染层前置校验会不会放进非法 expertId？**
不会。`agent-session-new` 在 `expertId` 非空时必过 `expertRuntime().createSessionSnapshot()` → `loadExpert()`，加载失败即整体返回失败，不落会话。冒烟 `missing-agent-fails-once` 用 `__missing_agent__` 验证了这条路径。改动实际是把准入从「渲染层缓存」收回到「主进程定义」，比原来更严谨。

**2. 失败后状态是否一致？**
两处都做了回滚：`startExpertChat` 失败恢复 `surfaceMode = previousSurface`；`handleMyAgentAction` 的 `finally` 一定会清 pending 并重渲染。视图切换（`btnRailAi`）移到成功之后，失败时用户不会被丢到助理视图看着旧会话。

**3. 重复提示？**
`createNewAgent` 失败时已 toast 主进程错因，因此 `startExpertChat` 返回 `notified: true`，工作台侧仅在 `!res.notified` 时才 toast。冒烟断言了 `notified === true`。

**4. pending 用 `Set` 而非按钮 DOM 状态，为什么？**
`renderShelf()` 会整块替换 `innerHTML`，写在 DOM 上的状态会被下一次渲染冲掉；用模块级 `Set` 作为唯一事实源，渲染函数据此产出按钮状态，重渲染后依然正确。副作用是天然防连点：第二次点击在 `add` 之前就被拦截（`add` 与 `renderShelf` 都在首个 `await` 之前同步执行）。

**5. `renderLaunchIntroHtml` 改签名的回归面**
新增的 `intro` 是可选参数且默认值等于原文案，另外 3 处调用（pack / steward / coding / writing 空态）行为不变；`npm test` 中相关空态断言全部保持通过。

**6. 图标是否都存在？**
`agent-identity.js` 引用的 9 个图标名（component / database / settingsLine / flask / bookOpen / server / terminal / note / clipboardCheck）与兜底 `users` 均已在 `src/ui-icons.js` 注册，不会出现空白方块。冒烟另断言了标记内确有 `svg` 且无文本（emoji 会以文本出现）。

## 未处理与取舍

- 能力标签只报数量，不列具体技能名：卡片空间有限，具体绑定在「调优」里看，避免卡片变成配置面板。
- `src/workbench.js:2248` 仍有 `avatar: managedAgentDetail?.avatar || '🧩'`（保存时写入的数据字段）。这是数据层默认值，界面已不再直出该字段；彻底清理需要迁移既有 EXPERT.md，超出本次范围。

## 结论

通过。硬门禁 `npm test`（1574/1574）与 `npm run lint` 均 PASS，真机冒烟 24/24、渲染层 console 错误 0。
