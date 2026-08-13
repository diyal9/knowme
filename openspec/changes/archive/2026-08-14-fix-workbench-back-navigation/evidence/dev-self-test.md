# 开发自测报告

- 日期：2026-08-13
- Change：fix-workbench-back-navigation
- npm test: PASS（1805/1805）
- npm run lint: PASS
- 手动冒烟: 代码层核对；请在 Electron 复验三条路径

## 根因（本轮）

`leaveDialogueTaskRoom` / `#wbRunBack` 在 `run.mode === 'daemon'` 时一律调用 `backDaemonRunToPipelineTasks()`，把**从工作流货架启动、后端走 daemon** 的运行也送回「管线服务」，而不是「工作流」分类首页。

## 修复摘要

| 入口 | 返回目标 |
|------|----------|
| 专家协作 → 协作对话房 | 专家协作（taskhome） |
| 工作流货架 → 对话房 / 运行（含 daemon 后端） | 工作流货架（shelf） |
| 管线服务 → daemon 任务审阅 | 管线服务（daemon） |
| 无来源记录的 daemon | 默认管线服务 |
| 无来源记录的 workflow 运行 | 默认货架 |

## 关键点

- `leaveDialogueTaskRoom` → 统一 `backToRunList`
- `#wbRunBack` → `leaveDialogueTaskRoom`
- `backToRunList` 推断 surface：显式来源 > daemon > workflow > taskhome
- `dialogueModeFromOrigin`：模式标签与分类首页对齐
- 契约：`restores dialogue back navigation to the origin category home`
