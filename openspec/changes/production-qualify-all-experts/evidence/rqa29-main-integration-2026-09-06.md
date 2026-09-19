# RQA29 — 任务目标与验收意见完整性

## 结论与专业资格边界

本轮修正共享任务目标、计划目标和验收意见的静默截断，不添加专家 ID 分支，不扩大工具权限。此前 RQA28 的 F01 真实修订仍不合格：最终正文仅版本标题变化；D01 因输入尾部未送达仍为无效诊断。本轮没有真实模型、QA UI、付费生成、外部写入或专家资格新增，24 专家生产目标仍 ACTIVE。

## 已修范围

- 新增 `task-text-contract.ts`：新提交目标/计划目标最多 32000、验收评论最多 8000；均为 trim 后 JavaScript UTF-16 length，不是 token、UTF-8 字节或总请求预算。非法类型/超限明确拒绝整次提交，不保存前缀。
- store.create/update 在规范化和写入前验证；review 经 update 验证。目标、计划和评论按完整正文规范化、保存、重开，不再分别裁成 2000/1000。标题160、结果摘要280等展示摘要保持原限制。
- runtime.createStart 在建立会话、快照、执行器之前验证输入；确认计划目标完整保存。执行修订时完整读取已保存的最新评论，组装原目标与最新修改意见。
- 独立复审发现 P2：reconcileTask 将完整 confirmedGoal 与 text 默认2000字结果比较，导致长目标每次 get 都回写。已将两侧改为同一 taskText 比较；未改变占位目标的合法回填规则。

## 验证记录

- 首批7项旧源 RED（7失败），修复后相关55项通过。追加确认计划入口测试首次失败属于夹具缺少 readSessionSnapshot，补齐夹具后8项通过；不归因生产缺陷。
- P2 新增第9项：旧比较下实际8过1失败，连续两次get产生两次goal/brief更新；修复后相关67/67通过，包含既有占位恢复测试。
- 执行夹具使用真正 store→review→JSON重开→runtime.execute，生成接口为 mock，只证明完整 prompt 到达该接缝，不证明实际模型专业能力或所有下游请求装配。
- 主线完整 `npm run check` session26219 exit0，包含最终9项回归及P2修复；renderer86文件606项通过，backend、lint、typecheck通过。后端输出截断，不沿用前轮计数。此前55892/44984检查是中间候选，不替代最终检查。
- 独立审查记录见 `rqa29-input-integrity-review.md`：第7节92项通过并发现P2；第8节最终82/82通过、exit0，确认P2关闭及placeholder正常回填，无新增阻断项，不覆盖旧诊断。
- `git diff --check` exit0，仅既有 windows-gpu-policy 两文件CRLF提示。未提交或重置共享改动。

## 风险与未覆盖范围

本轮遵循 GitNexus debugging/impact-analysis 的源链路和修改前影响检查：createStart HIGH 已告知用户；execute MEDIUM；normalizeBrief/normalizeExpertPlan/normalizeDeliverables/confirmedTaskGoal/reconcileTask 及 store.update 的可解析项 LOW。store.create 和新 helper 的图谱结果 UNKNOWN，另行检查实际动态调用点，不将无图谱命中当安全证明。reconcileTask直接影响execute、recoverQueuedTasks、reviewDeliverable。整树 detect_changes 为323文件、708符号、172受影响流程、CRITICAL，包含大量共享历史改动，不是本轮规模或全树审查证明。

材料8000/批次32、计划条目长度/数量、work-relationship-router 2000字目标及其他工作台入口仍需单独审查。没有新增总字节预算，也未修所有输入清空/错误呈现路径。新写入限制不裁旧记录，但携带超新上限旧正文的完整patch会明确拒绝；不能称所有历史任务均可无障碍继续。已被旧代码截掉的尾部无法自动恢复。

文本保存完整不等于可以无限发送：上下文预算不足仍应明确失败并保留旧稿/反馈，不静默丢掉修改意见。目标和反馈未被升级为事实证据、权限或工具执行回执。

RQA28 D02 安全审核拒绝保持有效，本轮未重试或换途径启动。后续真实诊断需明确允许的测试边界，或先建立并验证宿主强制禁工具路径，不能仅靠提示词禁止工具。当前仍可继续本地工程审查，不将全部目标标为blocked或complete。

## 最终源码指纹 SHA-256

- task-text-contract.ts：`6f5723305304ece69606c6b2da0eb2c23b552501898e341d0a3e5492089ad268`
- workbench-task-store.ts：`084203ff0a04eff0295f80aa83faff8e9000db2213625ddd3c3be81472cc2bde`
- expert-task-runtime.ts：`d7481c56206bf765121541b6046baadb93f1676dbc7a4805cbb0a39ef5c08bda`
- rqa29-task-text-integrity.test.js：`2039cbc06391f27cd766c51c6e871d7474892c8811913e7b966166cdc848066e`

后续继续区分平台传输失败与专家专业失败。专业认证依赖冻结正常/异常/修改题、实际方法装配、真实交付和独立全文核验；安装Skill、扩写SOP、review状态或绿测不能作为专家达标证据。
