## 1. 导入向导与预检

- [ ] 1.1 定义导入预检数据结构（能力、权限、兼容、风险、成本、回滚）并补齐主进程 IPC
- [ ] 1.2 在工作台接入导入决策面板，完成安装确认与取消路径
- [ ] 1.3 为不兼容 Package 增加 fail-closed 文案与可执行修复建议

## 2. 运行态指引与恢复

- [ ] 2.1 实现 Guided Recovery Panel，覆盖 WAITING_INPUT/APPROVAL/CHILD 三类等待态
- [ ] 2.2 建立失败类别到修复动作映射（超时、权限、协议、证据）
- [ ] 2.3 实现取消与恢复阶段态可视化（requesting/cancelling/cancelled 与 resume 过程态）

## 3. 协议映射与状态一致性

- [ ] 3.1 扩展 output protocol 诊断字段，增加 recommendedAction 与 estimatedWait 映射
- [ ] 3.2 更新 message state 聚合逻辑，确保过程态不污染终态 answer lane
- [ ] 3.3 为导入与异常态交互补齐隐私脱敏与敏感字段显示约束

## 4. 验证与放行

- [ ] 4.1 新增导入向导与 live cancel Electron smoke 用例并沉淀 evidence
- [ ] 4.2 执行 QA 反模式走查（误导文案、错误动作、无反馈等待）
- [ ] 4.3 通过 `npm test`、`npm run lint`、`node .cursor/scripts/harness.js gate --json` 门禁
