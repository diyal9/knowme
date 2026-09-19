# RQA138：路线 Skill 迁移闭包与真实用户数据修复

日期：2026-09-09

## 目标

修复专家升级后“专家已安装，但执行专项路线时才提示 Skill 未安装”的版本迁移问题。路线声明中的本地 Skill 应进入专家依赖闭包；外部连接器仍必须保留授权与运行时检查，不能因为路线声明而静默授权。

## 实现

- `syncRetainedExpertCapabilities` 读取专家 manifest 的 `metadata.knowme.execution.routes` 与 `deliverables`。
- 当路线声明了 `requiredTools` / `toolAllowlist` 时，将其 `requiredSkills` / `skillId` 合并为必需的本地 Skill 依赖。
- `connectorId` 与 `requiredConnectorIds` 不被自动提升，继续由运行时授权门禁判断。
- 新增回归覆盖：旧 sidecar 将路线 Skill 标为可选时会被提升；外部连接器仍保持可选/授权门禁语义。

## 真实用户数据修复

在 `%APPDATA%\\KnowMe` 上执行限定范围的 `syncRetainedExpertCapabilities`，未执行全量审计 `--apply`，未安装或授权外部连接器，未删除用户内容。

- 6 个保留专家完成当前契约同步。
- 办公协作补齐：`feishu-meeting-summary`、`feishu-related-chats`、`feishu-today-priority`、`feishu-doc-kb`。
- 数据分析补齐：`business-metrics-analysis`、`business-cause-analysis`、`business-insight-report`、`data-report-method`。
- 真实审计复核：`packageReady=true`、`degradedExperts=0`、`conditionalUnavailableSkills=[]`。
- 审计同时复核条件连接器：办公协作路线声明的 `feishu` 已进入路线契约；当前机器的连接器探针返回 `auth_required`，Pango 返回 `offline`。这两项作为真实环境阻塞保留，不把“已安装/启用”误报为可执行。
- 7 条条件路线仍为 `task-runtime-probe-required`，没有伪造执行回执，因此 `executionReady=false`、`productionReady=false` 保持不变。

## 验证

- 当前冻结资格矩阵：6/6 专家、51 个用例，均满足 normal×2、edge、retry、revision、reopen 的结构覆盖，状态为 `ready_for_live_execution`；这证明测试矩阵完整，不等于专业质量认证。
- 迁移定向回归：28/28 通过。
- 条件连接器审计回归：29/29 通过。
- 全量后端：3527 tests，3476 passed，51 skipped，0 failed。
- Renderer：86 files，630 tests passed。
- lint、架构检查、脚本范围检查、prompt lint、renderer typecheck 通过；仅有既有大文件提示。

## 结论

本次只关闭了“路线 Skill 安装闭包”缺口，不能替代真实 Feishu/Pango Provider 回执、系统安全存储可用性或独立专业质量评审。目标继续保持 ACTIVE。

矩阵快照：`evidence/rqa138-current-matrix.json`。
