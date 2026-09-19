# RQA44–45：用户研究与数据分析专业合同

日期：2026-09-07  
结论：两位专家的专业方法与运行合同完成一轮系统性加固；未取得新的真实模型专业分数，不授予生产资格。

## 1. 选择依据

- user-researcher 的历史真实任务出现 0/5，候选方法后仅 1/5；另一题实际交付 2/5。主要硬伤是材料记录/参与者/事件计数混淆、配对方向判断错误、观察与推断混写，以及后续研究没有覆盖任务终点。
- data-analyst 的历史真实题出现 0/5，并发生摘要、表格、未知值、比较方向和因果边界错误。其核心 Skill 已较完整，但包一面要求关键计算使用真实计算能力，一面把工具权限设为空，合同自相矛盾。

改动原则：专业知识放在 Expert/Skill 包中；KnowMe 只执行既有通用 Skill、路由、工具权限和 qualityReview 合同，不增加专家 ID 分支。

## 2. user-researcher 2.2.0

`research-evidence-analysis` 升级到 1.1.0：

- 配对、交叉顺序和前后测先逐人列出版本、顺序、独立完成状态及原始值，再核对差值正负号；
- 区分版本差异与第一次/第二次差异，不能由总体均值替代个体反例；
- 研究计划必须定义最终提交、独立完成或安全退出等任务终点，明确分母及协助/缺失处理；
- 交付前横向核对证据表、主题、摘要、结论与建议中的人数、方向和因果强度。

新增包声明 qualityReview，覆盖记录数/人数/重复关系、观察/解释/推断/假设、全文方向一致性，以及名额/任务终点/改变建议条件。

隔离运行时实测：`capabilityUpdate(user-researcher)` 成功，expert 2.2.0 与 required Skill 1.1.0 均 installed/enabled；依赖从 1.0.0 自动升级到 1.1.0，warnings 为空。

## 3. data-analyst 2.2.0

- 包仅开放本地只读 `calculate`，保持 network/write/externalWrite=false。
- 默认路线将工具面限制为 `calculate`，但不列为 requiredTools；定性任务或用户明确禁工具时不应为了回执强制计算。
- 新增包声明 qualityReview，覆盖分子/分母/合计/单位、全文数字与方向一致性、缺失/未知/冲突/零值区分，以及算术、相关、竞争解释与因果结论的证据强度。

隔离运行时实测：`capabilityUpdate(data-analyst)` 成功，2.2.0 installed/enabled；安装快照权限只含 `calculate`，qualityReview 四项存在。两个 optional 商业分析 Skill 未安装，运行时给出 `missing_optional_dependency`，符合“可选缺失不自动安装”的既有更新策略，不影响 required `data-analysis-method` 1.1.0 已启用。

## 4. 测试证据

- RQA44 新冻结测试：最初 0/3，实施后 3/3。
- RQA45 新冻结测试：最初 0/3，实施后 3/3；额外验证 `resolveOutputSpec` 与 `scopePermissionsForOutputSpec` 的实际路线权限为 `calculate`，requiredTools 为空。
- 专家矩阵、目录闭包、能力更新、运行时/工具回归组合：74 passed，0 failed。
- 首次全量检查发现 4 个历史测试仍写死 expert 2.1.0，其中一项还把 data-analyst 的空工具权限当作不变量；迁移为“各包声明版本对齐 + 专家最小工具权限 + 核心 Skill 不扩权”后，相关 64/64 通过。
- 最终 `npm run check` exit 0：后端 3465 passed / 51 skipped / 0 failed；渲染层 86 files、606 tests 全绿；lint 与 renderer typecheck 通过。
- `git diff --check` exit 0，仅报告 4 个本轮未触及 Windows GPU 文件的既有 CRLF→LF 提示。
- GitNexus 对整个共享脏工作树报告 338 files / 720 symbols / 172 processes、CRITICAL；范围包含长期并行改动，不能归因于 RQA44–45。本轮新增测试与 Expert/Skill/目录/证据文件未引入新的专家 ID 运行时分支。
- OpenSpec health 仅剩仓库级软项：15 个活跃 change 超过建议 12，且无关 change `establish-project-work-context` 缺 qa-plan/evidence；本 change 已具备 code-review 与 evidence。

## 5. 资格边界

上述证据证明：方法内容、包声明、目录版本、隔离安装、L1/通用运行合同没有已知结构断点。它不证明模型会正确执行这些方法。

当前隔离环境仍无可用模型 API Key，因此不能重新执行 UR-N01/UR-H02、DA-N01/DA-H02，也不能验证 qualityReview 是否在真实模型下纠正旧硬伤而不引入新错误。两位专家保持“不合格/待复验”；后续必须完成旧失败题、新留出题、用户修改轮及重开验收，且全文无硬红线后才可进入资格候选。
