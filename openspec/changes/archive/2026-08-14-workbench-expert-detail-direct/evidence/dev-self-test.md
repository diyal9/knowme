# 开发自测报告

- 日期：2026-08-11
- Change：workbench-expert-detail-direct
- npm test: 相关静态用例 PASS（capability-hub / expert-task-chat / workspace-capability-rail）
- 修复：
  - 宿主 `capabilityHubSrcMismatch`：park 复用时 presentation/expertId 不一致强制重载 iframe，避免落在完整专家库目录
  - 关详情时保持 `presentation=detail` 直至叠层关闭，避免壳层先闪成目录页
  - detail 叠层隐藏 host drawer-head；bump `capability-hub`/`workspace`/`workbench` 缓存版本
- 手动验收路径：
  1. 工作台 → 任务 → 点快捷专家卡 → 仅二级详情弹窗 + 底栏「开始对话」
  2. 左轨仍高亮「工作台」；不进入专家库整页
  3. 专家库 rail 内点专家 → 仍为管理向底栏（添加到工作台），无「开始对话」
  4. 「+ 新建任务」仍打开任务编排
