## 1. 启动弹窗 DAG 渐进披露

- [x] 1.1 增加 `modal.dagExpanded` 状态；默认摘要，点击切换展开/收起完整 DAG
- [x] 1.2 实现流程摘要渲染（步数 + 门禁/并行等特征 +「查看执行流程」）并接入 `wrapWorkflowLaunchBody`
- [x] 1.3 调整启动弹窗 CSS：默认窄单栏/摘要侧栏，展开态恢复宽分栏完整 DAG

## 2. 工程上下文折叠

- [x] 2.1 将 GitLab/ref/commit/制品/资源字段移入默认可折叠「仓库与制品」区域；首屏保留任务标识与 PRD/asset
- [x] 2.2 更新帮助文案，去掉「按右侧关系图」等与新布局不符的表述

## 3. 验证

- [x] 3.1 更新 `workbench-templates.test.js` 覆盖摘要默认、展开入口与工程字段折叠
- [x] 3.2 运行聚焦测试、npm test、lint、OpenSpec strict validate，并写开发自测证据
