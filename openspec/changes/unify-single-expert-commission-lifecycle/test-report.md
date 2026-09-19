# 测试报告

日期：2026-09-15。

`npm run check` 退出码 0：
- 后端测试 3583 项：3532 通过、51 按现有条件跳过、0 失败。
- lint：0 error、0 warning。
- 渲染测试：86 个文件、634 项全部通过。
- `typecheck:renderer` 通过。

新增集成覆盖：自动完成、真实存储重新读取、自动交付不标作用户接受、多交付串行完成、显式审阅、缺少证据仍等待、失败结束及关联重试、统一等待原因及三种结束结果。

页面覆盖：自动完成无验收门槛、后续委托带原 taskRef 且使用新 ID、开始前勾选审阅进入提交契约。原预检并发测试保留在 legacy 单记录存储夹具中；新生命周期使用真实多任务存储独立验证。

范围审查：GitNexus detect_changes(scope=all) 返回 361 个变更文件、836 个符号、179 个受影响项、critical。此结果包括本轮开始时已存在的 719 条工作区变更，无法作为本轮专属差异；已明确告知用户。没有提交或回滚其他工作区修改。

运行验证：通过 npm start 重启 KnowMe；Vite ready、Electron app-start、窗口 ready-to-show。无生产业务委托重跑。

Story 完成门禁已通过：npm-test、npm-lint、test-renderer、typecheck-renderer、typecheck-lib 全部通过。门禁提示的 Smoke Scope 复选项格式已补齐。
