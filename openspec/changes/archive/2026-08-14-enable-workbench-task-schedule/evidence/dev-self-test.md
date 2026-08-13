# 开发自测报告

- 日期：2026-08-12
- Change：enable-workbench-task-schedule
- npm test: PASS（1692/1692）
- npm run lint: PASS
- 手动冒烟: 代码路径已接通；需重启 Electron 后目视
  - 任务页「定时任务」打开任务计划面板（不再进工作流自动化）
  - 行上「定时」可编辑每天/间隔/单次；启用后显示徽章
  - 主进程 60s tick + `workbench-task-schedule-due` → 子任务 + beginExpertTask
- 备注：仅本机 App 在线触发；侧栏「自动化」仍为工作流自动化中心
