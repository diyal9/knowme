# RQA104 — 真实用户数据目录生产能力审计

日期：2026-09-08

## 执行

在真实 KnowMe 用户数据目录执行：

```text
npm run audit:production-capabilities
```

审计以受控权限运行，仅写入 `capabilities/snapshots` 审计快照，不执行删除、迁移或连接器安装。

## 结果

- 用户数据目录：`%APPDATA%/KnowMe`
- 保留专家：6 个
- 专家加载：6/6 `loadOk=true`
- 专家快照：6/6 `snapshotOk=true`
- 专家降级：0 个
- 必需 Skill：18 个，全部安装、启用且 grounding 通过
- 必需连接器：`pango-image-mcp`，已安装并启用
- 任务目录：9 个，结构问题 0
- 静态包就绪：`packageReady=true`
- 完整执行就绪：`executionReady=false`
- 审计结论：`productionReady=false`
- 条件路线：办公协作的飞书路由、研究专家的公开网络核查/研究路线，以及生图专家的 `pango-generate` 均单独记录必需工具，状态为 `task-runtime-probe-required`

## 解释

在受限沙箱中直接运行同一命令时，快照目录创建会返回 `EPERM`，报告会把专家标记为 `snapshot_failed`。该结果是执行环境权限限制，不是 KnowMe 真实用户数据目录的产品运行时失败；真实目录复核已排除该问题。

静态包就绪只证明专家依赖和运行时装配就绪，不替代真实 Provider 执行、独立专业评审和生图质量验收。
只要仍有条件路线未取得真实工具回执，完整执行审计就保持 `productionReady=false`；材料内研究路线可以不需要网络工具，但公开网络路线、办公协作路由和生图路线必须在具体任务的最终工具面中实时确认。
