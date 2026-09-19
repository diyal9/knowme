# RQA61：软件工程专家完整资格复验与“专家称号”门禁

## 结论

- 当前配置 `expert-config-v1:d7899f72e4db95ea15cb59a2c1278814278642ff8f8f5766d63e9160dfc66041` **明确失败**，不再是“证据不足”。
- 六个配置化样本覆盖 normal×2、edge、retry、revision、reopen；其中 SE07、SE08、SE09、SE10 均有决定性硬失败。SE06 的恢复交付可执行且通过，但首次正常执行失败，不能抵消其他失败。
- 同模型质量护栏对 SE07 的竞态错误和 SE09 的语法错误均给出通过，进一步证明它只能作为低成本护栏，不能作为专家认证者。
- AgentEvals 升为 v3.1：只有 `qualified` 配置才有 `expertTitle.eligible=true`。包结构完整、Skill 已安装或同模型复核通过，都不代表“配得上专家”。
- 当前 22 个内置 Agent 中，0 个具备专家称号资格，2 个明确不具备资格，20 个等待真实证据；2 个外部 Agent 仍为 limited。总体仍为 **0/24 生产合格**，目标保持 ACTIVE。

## 冻结题与真实任务

断言先冻结于 `skill-evals/rqa61-software-engineer-qualification/evals.json`，再通过隔离 KnowMe QA 实例真实执行。

| Eval | Task | Lifecycle | Assertion result | Qualification result |
|---|---|---|---:|---|
| SE05 | `task-mtqs5xl6-hv6y8` | normal | 5/5 | 通过单题 |
| SE06 | `task-mtqsvg6a-8dwsc` | normal；首次失败后恢复 | 5/5（恢复稿） | 首次可用性失败单列；恢复稿通过 |
| SE07 | `task-mtqsy54y-dvnoe` | edge | 1/5 | 专业语义硬失败 |
| SE08 | `task-mtqtyl1p-2r0in` | cancel → retry | 0/5 | 重试后无交付；硬失败 |
| SE09 | `task-mtqtjoxl-4lhtw` | review → changes requested → v2 review | 4/5 | v2 JavaScript 无法解析；硬失败 |
| SE10 | `task-mtqto4ck-hu345` | review → completed → reopen | 0/5 | 两次修改执行均无新版；硬失败 |

SE06 首次失败发生在失败证据补齐之前，保留为 unscoped 可用性证据，不反推模型配置。随后同任务恢复执行产生完整配置身份，交付的 `runPool` 经独立回放通过输入校验、并发上限、结果顺序、失败停启、已启动任务晚到拒绝不泄漏及单次调用检查。

## SE07：表格完整不等于实现正确

交付稿使用一个全局 `version` 管理所有 key，并且 `invalidate(key)` 只删除缓存、增加全局版本，不移除该 key 的旧 in-flight。独立脚本 `scripts/rqa61-verify-se07.js` 从真实 artifact 提取代码并执行竞态回放，三项决定性检查全部失败：

1. A 的 R1 挂起后 `invalidate('A')`，紧接着的 A/R2 仍复用 R1，第二个 fetcher 未启动。
2. B 的请求挂起时只失效 A，B 成功后因全局版本变化不写缓存，下一次 B 被错误地重新获取。
3. 答案声称两个 `async load()` 调用会返回同一个 Promise 引用；真实 JavaScript 语义下只会采用其状态，返回对象不相同。

这些错误直接违反题目明确给出的“按 key 隔离”和“失效后新读取不得共享旧 in-flight”。尽管如此，运行证据中的 `same_model_guardrail.passed=true`。

## SE09：方向正确但产物不可执行

修改稿正确采用 `/^[1-9][0-9]*$/` 与只裁剪 ASCII 空格的策略，也保留了原合同、补齐边界测试并正确进入 v2 生命周期。但代码注释中的 `\n` 被交付为真实换行，下一行以逗号开始：

```text
// ... 避免误放行 \t,
, \u3000 等 Unicode 空白
```

`vm.Script` 对真实 artifact 直接报 `SyntaxError: Unexpected token ','`。因此“完整替换实现”断言失败，并按不可执行交付判硬失败。同模型护栏再次误放行。

## SE08 / SE10：生命周期入口存在，但闭环失败

- SE08 能记录取消并启动 retry，但 retry 最终进入 `failed`，没有 deliverable。补齐后的失败 evidence 含当前 configurationId、真实 provider/model、`gateStatus=failed` 与 `execution_failed`，证明失败链路不再丢失身份。
- SE10 首版可以接受并从 completed 重开，评论和旧成果均保留；但两次针对游标环检测的修改执行均未产生 v2，最新一次失败已绑定当前 configurationId。能切换状态不等于完成修改闭环。

## 通用平台修复与资格语义

本轮没有新增 software-engineer 专属运行时分支：

1. 失败执行也持久化 Agent、Skill、Connector、实际模型组成的 configurationId，以及失败 gate、护栏状态、工具/evidence 与 `execution_failed` 违规。
2. store 接受 `failed` evidence gate 状态，重开后不丢失。
3. AgentEvals v3.1 新增 `expertTitle`：
   - `qualified` → `eligible`；
   - `failed` → `not_eligible`；
   - `unverified` / `insufficient_evidence` → `pending_evidence`。
4. 当前报告为 `eligible=0`、`notEligible=2`、`pendingEvidence=20`。静态 package-contract 100 分只说明结构合法，报告明确标注为 structure only。

## 证据与回归

- 原始任务：`skill-evals/rqa61-software-engineer-qualification/raw-*.json`
- 冻结断言及裁决：`skill-evals/rqa61-software-engineer-qualification/evals.json`、`results.json`
- 可执行复核：`scripts/rqa61-verify-se07.js`、`scripts/rqa61-verify-se06-se09.js`
- 当前资格报告：`evidence/rqa60-agent-evals-v3.{json,md}`（内容版本 v3.1）
- AgentEvals 回归：13/13 通过。
- 失败 evidence 持久化回归：35/35 通过。

## 下一步

- 软件工程专家先保持 `not_eligible`。修复必须同时处理专业方法对按 key 竞态的推理、代码产物可解析校验、长答案截断/超时和修改重开可靠性；任何 Agent/Skill/model 变化都会生成新配置 ID，并从冻结题重新评估。
- 后续 20 个内置候选按相同标准逐个执行；不会因为 Agent 名称、Skill 数量或文件篇幅授予资格。
