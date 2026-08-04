# Retro: agent-session-tabs

## 做了什么

把 Agent 顶栏从「通用/写作/编程」胶囊，改成 Cursor 式多 Session Tab：New Agent | Tabs | + / 历史 / ⋯，每 Tab 独立 transcript。

## 学到的

- Electron 禁用 `window.prompt`，重命名必须内联或抽屉。
- Session 数据与「打开 Tab」UI 状态应分离：关 Tab ≠ 删数据。
- 旧「每 Agent 类型固定一条对话」心智与 Cursor 多 Agent 冲突，主 chrome 应直接表达 Session。

## 可沉淀

- 若再出现「多会话 Tab chrome」需求，可升格为 UI pattern skill（须用户确认）。
