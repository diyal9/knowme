# RQA98/RQA99：生产 roster、依赖迁移与 readiness 分级

## RQA98：安全收敛实际专家 roster

- 只读盘点确认 6 个核心专家均已绑定到工作台。
- `ui-expert`、`artbundle-expert` 是无任务、无工作台绑定的 `local-repo` 旧专家。
- 新增 `scripts/reconcile-production-roster.js`，默认 dry-run；`--apply --remove ...` 才会执行，并备份 install store、catalog overlay、工作台模式、任务和目标专家目录。
- 已通过系统 `deleteExpert` 流程移除两个目标，备份目录为：
  `C:\Users\Administrator\AppData\Roaming\KnowMe\audit\production-roster-2026-09-08T06-57-36-878Z`
- 实际用户数据验证：启用专家数为 6；两个旧专家目录、绑定和任务引用均不存在。

## RQA99：必需依赖和可选依赖

- `production-catalog-migration` 升级为 `focused-expert-roster-v10`。
- 保留专家即使版本和内容未变化，也会读取 bundled capability manifest 并补齐 `required:true` Skill/连接器依赖。
- 已在实际用户数据应用 v10；补齐 13 个核心专家必需 Skill，实际检查 `MISSING_REQUIRED_DEPENDENCIES=0`。
- `buildBindingReadiness` 现在读取 capability manifest 依赖分级；`required:false` 缺失只显示 `optional`，不会把专家错误标成不可执行。
- 实际运行时 readiness：6/6 核心专家为 `ready`。

## 验证

- roster reconcile 定向测试：2/2 通过。
- production migration 定向测试：10/10 通过。
- expert runtime 定向测试：15/15 通过。
- actual user-data readiness probe：6/6 `ready`。
- 生产能力审计已按能力合同区分必需/可选依赖：实际用户数据的静态包审计 `packageReady:true`，18 个必需 Skill 与 `pango-image-mcp` 均可用；未启用的可选能力仅进入 `optionalUnavailable*`。带 `requiredTools` 的条件路线仍需实时工具回执，因此完整执行审计另由 `executionReady` / `productionReady` 判定。
- 全量回归：`npm test` 3440 通过 / 51 跳过 / 0 失败，renderer 86 个测试文件 / 619 项通过，lint 与 renderer typecheck 通过。

## 未完成

这只证明运行时 roster、必需依赖和就绪判定已收敛，不等于专家专业质量已达标。真实 Provider/连接器授权、实际图片生成闭环、各专家专业反例和 UI 全生命周期验收仍需继续。
