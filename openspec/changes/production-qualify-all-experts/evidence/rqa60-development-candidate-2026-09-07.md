# RQA60：开发类专家真实候选复验与配置级资格证据

## 结论

- `software-engineer` 的旧未分组样本通过 5/5；首次配置化运行的旧 Skill 配置连续两次仅 4/5，并暴露截断恢复绕过专业复核、同模型复核误放行两个通用问题。升级 `software-change-verification` 1.1.0 后，新配置首次通过 5/5，但只有一个正常样本，仍不足以授予专家资格。
- `solution-architect` 在冻结边界题 SA05 上连续三次仅通过 1/5 决定性断言，Flash 与 Max 均失败。失败涉及撤权安全边界，不允许被平均分或同模型自评掩盖，当前判定为专业失败。
- 配置身份持久化之前的旧任务不能补造 Agent、Skill、Connector、实际模型哈希。AgentEvals v3 将其标为 `unscoped`，不计入任何具体配置的资格样本；配置化任务按完整配置独立归档，不跨版本合并。
- 当前仍为 **0/24 可声称生产合格**；目标保持 ACTIVE。

## 冻结题与真实任务

冻结断言位于 `skill-evals/rqa60-development-candidate/evals.json`，先冻结、后执行。

| Expert | Task | Scenario | Frozen assertions | Result |
|---|---|---|---:|---|
| software-engineer | `task-mtqkuqqm-8zic0` | normal | 5 | 5/5，候选 |
| software-engineer | `task-mtqr19hj-h09xv` | normal / old config | 5 | 4/5，失败：缺复杂度；截断恢复绕过复核 |
| software-engineer | `task-mtqruutk-egay9` | normal / old config | 5 | 4/5，失败：缺复杂度；同模型复核误放行 |
| software-engineer | `task-mtqs5xl6-hv6y8` | normal / current config | 5 | 5/5，当前配置候选 |
| solution-architect | `task-mtqohzks-ayyzq` | edge / Flash | 5 | 1/5，失败 |
| solution-architect | `task-mtqots5l-d2xwe` | edge / Flash structured retry | 5 | 1/5，失败 |
| solution-architect | `task-mtqp2iqs-cg3wy` | edge / Max | 5 | 1/5，失败 |

`task-mtqods6q-6mb56` 因 sandbox 启动的 Electron 无可用 AI 配置而阻塞，已单列为环境失败，不纳入专业评分。

## 专业判定

旧未分组 SE05 样本完成了全部断言，但不能追认配置。配置化复验发现旧配置 `expert-config-v1:b93f…` 连续两次遗漏题目明确要求的时间/额外空间复杂度，因此按硬断言判失败。通用执行器同时修复了一个生命周期缺陷：模型首答因 `length` 截断、完成答案恢复后，之前会直接退出并跳过 package-declared 专业复核；现在“一次答案恢复”和“一次质量复核”使用独立预算，恢复后的完整答案仍必须复核。

随后直接增强专家已有的 `software-change-verification`，没有通过增加简单 Skill 装饰能力：1.1.0 明确要求在输入规模、延迟、内存或吞吐约束存在时输出时间复杂度、额外空间复杂度、最坏情况与约束适配说明。当前配置 `expert-config-v1:d789…` 的真实任务 `task-mtqs5xl6-hv6y8` 通过全部 5 项冻结断言，包括 `O(N log N)`、额外 `O(N)`、100000 段目标和诚实的未运行说明。它仍只是一条 normal 证据，缺第二 normal、edge、retry、revision、reopen，不能称为生产专家。

SA05 三次都能指出“8 小时无限离线”与“5 分钟撤权”冲突，但未给出两个真正同时满足硬要求的方案。其余决定性缺陷包括：

- 将服务端提供的 `expires_at_mono` 当作客户端本地可靠单调时间，重启/休眠语义不成立；
- 许可、缓存与高水位没有始终按 `(account, workspace)` 隔离；
- 查询、打开、缓存命中与结果交付四处门禁未形成完整闭环；
- 回退方案会移除安全门禁，重新暴露过期授权；
- 在没有基线的材料上给出“2 人 4 周可完成”等无证据可行性结论或任意阈值。

以上是架构安全边界的硬失败。Max 重跑仍未修复，说明问题不能靠更换模型标签解决。

## AgentEvals v3 与通用运行时修复

本轮将资格从“专家 ID + 几条历史输出”提升为不可混用的配置证据：

1. 每次执行记录 Agent ID/版本/哈希、全部绑定 Skill 版本/哈希、Connector 版本/哈希，以及实际 provider/model/requestedModel/autoRoute。
2. 只有身份完整时才生成稳定 `expert-config-v1:<sha256>`；旧样本可用于诊断，但永不追认资格。
3. 评测按 configurationId 分组；Flash、Max、不同 Skill 或 Connector 版本不合并平均。显式当前配置只按自身证据评定，旧配置失败仍展示但不永久污染升级配置。
4. 同模型专业复核仅记为 `same_model_guardrail`。它可以拦截明显问题，但不能认证自己的答案。
5. 任一硬断言失败仍使资格失败；不得由其他高分样本抵消。

这是一条通用 Agent 平台能力，不包含 software-engineer 或 solution-architect 的产品特判。

## 回归证据

- 资格身份、store 重开、同模型护栏标签、截断恢复后继续复核、混合配置隔离与显式当前配置独立毕业等聚焦测试均通过。
- AgentEvals 报告会显式展示 unscoped、scoped 和 mixed configuration 证据，防止报告层隐藏样本来源。
- 旧任务没有五维独立评分，本轮没有补造 completion/quality/evidence/efficiency/fit 数字。

## 尚未完成

- `software-engineer` 当前配置还需在同一 configurationId 下补齐第二 normal、edge、retry、revision、reopen；任一硬失败都必须先整改再重跑。
- `solution-architect` 必须先修复专业方法或增加独立、异模型/规则化的评审能力，再重跑冻结边界题；当前不得继续增加简单 Skill 来伪装深度。
- 其余 20 个内置专家需要同样按冻结题、硬断言、配置身份和生命周期闭环复验；2 个外部专家仍为 limited。
