# SA-N01 独立专业评分

结论：**3/5，专业不合格，不予总体资格放行**。这是当前安装包2.0.0的单次、非盲baseline，1题1份输出，无对照、未改方法；不能归因于某个Skill，也不能以平台verified认证专业能力。

## 证据绑定与方法

按skill-creator的agents/grader.md及references/schemas.md，阅读全文、五条冻结断言、五组assertion_notes及三条硬失败条件，并审查断言外claims。未新增冻结预期、未运行模型/API、未读写QA环境或修改src/旧评分。

- task：`task-mtozhx32-ycfem`
- session：`wb-expert-task-mtozhx32-ycfem`
- run：`expert_task-mtozhx32-ycfem_mtozhx8j`
- live状态review，gateStatus=verified，toolCalls=[]；仅作为运行记录。
- metadata与冻结SA-N01的prompt、expectations、hard_failure_conditions逐字相等；live材料与冻结prompt相等；live/session消息与transcript相等；answer与同run assistant正文去末尾换行后相等。无按数组位置跨任务绑定。
- assignmentSnapshot为2.0.0、bindings.skills=[code-review]，但primary.requiredSkills=[]；导出缺contextAudit，不声称全文Skill已装配，更不从依赖名推断本次失败原因。

## 五条断言

| # | 结果 | 证据与边界 |
| --- | --- | --- |
| 1 冲突/剩余许可期 | Fail | C1与B正确保留5分钟保证；但销售话术变成“断网后仍可继续工作约5分钟”，不是剩余许可期。许可t=0签发、5分到期、4分50秒断网仅剩10秒；不能因前文正确公式忽略最终话术矛盾。 |
| 2 两个可行方案/取舍 | Pass | A逐次在线鉴权，B短许可本地访问；讨论断网/弱网、实现风险、既有组件和四周约束，推荐B。A/B已满足两方案，不需把C算作可行方案。 |
| 3 权威/分区/门控 | Pass | account/workspace隔离、服务端权威、客户端副本，标题/摘要/正文及缓存/交付均经Gate；删除/重建不充当授权，W1不拖累有效W2。 |
| 4 三类失效时序 | Pass | 执行中到期→交付检查→丢弃；重启证明失败→锁定/重新授权；低版本乱序响应→丢弃/刷新。C7误称从零计时与A2一致，但紧接纠正且后文明确禁续期，不能夸成当前实现允许重启续期。 |
| 5 安全迁移/验收 | Fail | 旧缓存供未迁移用户、一键退回旧路径，没有交代同一不可回滚Gate/许可版本保护；全文止于阶段3“否则C4”。未交付断网撤权受控验收、设备/负载/冷热缓存/测量起止边界。 |

答复已有正文，不是blocked/N/A；对实际交付评分。三份导出均同样结束，不能替作者补完验收章节，也无法凭此认定是token耗尽、平台截断或导出故障。

## 全篇专业硬伤及审慎归类

1. **许可承诺跨章节变形**：把剩余期改成断网后约5分钟，直接触及冻结note 1；这是安全契约一致性问题，不是文风偏好。
2. **C的条件化机制不成立**：“8小时加密离线包+吊销列表”不能让持续断网的客户端得知新撤权。审批投入并不产生通信路径。C明确未成立且不是当前推荐，因此不记为“已批准/已部署8小时方案”；但“待批准”也不能免除架构推断正确性责任。
3. **安全回退和验收未完整交付**：前文唯一Gate是优点，迁移节却未说明旧路径必须先受同一Gate约束及许可状态不可回退。属于保护未证明、需修正后再审，不宣称真实系统已经泄漏。
4. **次要或待澄清项**：物理分区可选，不能断言统一存储必然无法逻辑隔离；严格大于perm_version的接受规则需澄清同权限版本合法续签，题面未给此细节；C7的从零计时解读有局部矛盾。两人四周可行/风险等级是估算不足的判断，不据此捏造其伪造预算或审批。

冻结三条hard_failure_conditions分别审查：未确认其把当前B宣称为8小时+5分钟兼得；未证明实际发生重启续期/缓存越权，但迁移硬约束保证未完成；未发现伪称基准/容量/部署已实测或C已获批。**未把每项都强行命中硬失败条款，不代表专业通过**：断言1/5和上述严重架构缺陷已足以拒绝本次交付。

## 合格边界与数据限制

有效内容是A/B取舍、有效许可内访问、到期交付门控、保守重启、版本防回退、后台删除与访问锁定解耦；应保留这些优点。要成为可拍板稿，仍需统一剩余期承诺、纠正C的信息条件、补充权限不回退的迁移/回滚不变量及可判5分钟界限的受控测试和性能测量方案。

全文4461 Unicode字符；Han+alnum词块heuristic=2684，非空白字符（含标点/Markdown）3935。本题无冻结字数限制，不以长度判失败。没有metrics/timing文件，不填写tokens或执行耗时，也不把缺失记0。

评分仅说明此1个合成countercase的表现；无对照或重复样本，不证明纯Skill因果、生产容量、安全认证或专家总资格。已有workspace/review.html由主线维护，本轮不覆盖共享viewer。

## 写入与只读文件审计

仅新增：

- `iteration-1/SA-N01/old_skill/grading.json`
- 本报告 `sa-independent-review-2026-09-06.md`

原始只读文件SHA256（供复核）：

| 文件 | SHA256 |
| --- | --- |
| SA-N01/eval_metadata.json | 06f73d8c9ee41735de0cee33703515e09a096810286eba3d286be5239cfa9df2 |
| SA-N01/old_skill/live.json | 066b5852037864dc790ae967e44f782d5ad7a6a00abc91f577f7ae8e22bdc1ed |
| SA-N01/old_skill/transcript.json | 5579e426d1e0d5150d4379d3cfb854455c44e92e4c74a2be009ab01d63fd8a5d |
| SA-N01/old_skill/outputs/answer.md | 60f2c22e715f809702c5110942fb4af6cb7dceb273b77eca516d04b1c816fb24 |
| evidence/professional-next-batch-cases-2026-09-06.json | f28ebe2534c7b15ba56965ba5a4cfded068b8b0c7bd0f992819dfc1e17600817 |
