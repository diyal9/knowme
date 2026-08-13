# 开发自测报告

- 日期：2026-08-13
- Change：fix-daemon-task-room-topbar-and-progress-card
- npm test: PASS（1795/1795，含新增顶栏/身份行/进度卡契约）
- npm run lint: PASS
- 手动冒烟: PASS（已重启 Electron；请打开任一 Daemon 任务房目视确认）
- 备注：
  - 通栏 Daemon 顶栏清空 meta、隐藏 mode；目的标题 + 结论态 + 返回
  - 右栏 `#wbDaemonReviewIdentity` 展示工作流短名
  - 左栏进度卡去掉 kicker，单层结构
  - 制品行改为：图标 + 文件名小标题 + 目录副文案 + 预览
  - 右栏身份行强化为浅底小标题卡；无工作流时回退到 slug/context
  - 应用已重启，请再打开截图中的任务核对顶栏与进度卡 / 制品标题
