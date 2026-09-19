# RQA110 — 生产能力审计 CLI 入口

日期：2026-09-08

## 变更

`scripts/audit-production-capabilities.js` 现在自行加载项目 TypeScript 注册器。直接执行脚本与 npm 包装命令使用同一运行环境，不再因遗漏 `register-ts` 在真正开始审计前报 `MODULE_NOT_FOUND`。

该变更只修复审计入口，不改变正式运行时的快照写入、权限和生产就绪门禁。

## 验证

- 直接执行 `node scripts/audit-production-capabilities.js --user-data .tmp/production-capability-audit`：exit 0
- `tests/audit-production-capabilities.test.js`：10/10
- 既有审计规则仍保持：快照写入失败可见、必需连接器缺失阻断、条件路线声明不能冒充真实工具回执。
