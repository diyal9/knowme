# RQA97：生产能力审计异常闭环

## 目标

能力审计不能因为一个专家的快照目录无法创建而整份崩溃。审计必须保留每个专家的诊断结果，并明确报告不可生产的原因。

## 实现

- 新增 `safeCreateAuditSnapshot`，捕获快照创建过程中的权限、路径和其他运行时异常。
- 失败会生成结构化 `snapshot_failed` issue，并将专家标记为 `degraded: true`、`snapshotOk: false`。
- 审计脚本改为仅在直接执行时启动 `main`，允许回归测试复用异常处理逻辑。
- `--strict` 仍保持失败语义，不会把审计异常误报为生产就绪。

## 验证

- `tests/audit-production-capabilities.test.js`：2/2 通过，覆盖快照权限异常和专家加载失败分支。
- `npm test`：3487 项，3436 通过、51 跳过、0 失败。
- `npm run test:renderer`：86 文件、619 项通过。
- `npm run typecheck:renderer`：通过。
- `npm run lint`：通过；仅保留既有文件长度 advisory warning。
- `npm run audit:production-capabilities -- --strict`：现在能输出完整 JSON；当前实际用户数据仍为 `productionReady: false`，原因包括 30 个未安装/停用技能和全部专家快照写入 `EPERM`。这是正确的失败诊断，不是资格通过。

## 结论

审计工具自身已具备异常闭环，但当前用户数据目录与“保留6个专家”的目标态不一致，且外部 Provider/连接器和专家专业质量尚未完成生产验收。因此目标继续保持 ACTIVE，不能宣称完成。
