# 开发自测报告

- 日期：2026-08-13
- Change：`stack-run-result-footer-actions`
- npm test: PASS
- npm run lint: PASS
- 手动冒烟: 应用重启后请点击结果页产物确认可打开
- 备注：
  - 根因：相对路径按本地内容源解析，Daemon 任务工作区文件找不到
  - 修复：本地不存在时带 `slug` 从 Daemon 下载/blob 落到临时目录再 `shell.openPath`
  - 结果页过滤 `ingest/` 输入路径，避免把启动材料当产物点击
