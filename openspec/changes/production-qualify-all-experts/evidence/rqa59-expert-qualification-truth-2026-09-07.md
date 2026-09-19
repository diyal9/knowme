# RQA59：专家资格不再由 Skill 数量和包结构代替

## 问题与根因

旧 AgentEvals 对 22 个内置专家的运行样本数均为 0，却仍由静态包分数回退出平均综合分 99。其中 Skill 维度按数量加分：1 个 Skill 为 75，2 个即 100。这会同时产生两个错误激励：

- 多绑定简单 Skill 比打磨一个完整方法更容易高分。
- 专家能否在真实任务中正确上下文、调用工具、处理失败、接收修改并重开恢复，不影响“专家”分数。

能力中心还将 curated 专家显示为“认证”，把来源身份与专业资格混为一件事。

## AgentEvals v2

新评测把“能否装配”和“是否配得上专家”拆开：

1. **Package contract gate** 只检查专家身份、输入/输出、边界、Skill 引用、证据策略和包完整性。一个有效 Skill 与多个有效 Skill 同分；数量不再产生专业性加分。
2. **Runtime evidence gate** 没有样本时 overall 与平均分为空，资格为 `unverified`，不使用包分数回退。
3. **最低场景覆盖** 为 6 件：`normal`×2、`edge`、`retry`、`revision`、`reopen`。只重复六个正常题不能通过。
4. **质量门槛** 要求 completion/quality/evidence/efficiency/fit 五维完整，加权原始分≥85，每件任务的 completion/quality/evidence/fit 不得低于 80。
5. **硬失败保留** ：任一 hard failure、硬断言失败或 failed 任务都使资格失败，不被其他高分平均掉。
6. **双门禁** ：即使运行样本满分，引用不存在的 Skill 或专家包合同损坏仍不能合格。

## 当前真实台账

| 范围 | 结构合同 | 运行资格 | 可声称生产专家 |
|---|---|---|---:|
| 22 个内置专家 | 22/22 通过 | 22 个 `unverified` | 0/22 |
| 验收范围中 2 个外部专家 | 已知 `limited` | 不允许建立正式执行快照 | 0/2 |
| 全部验收范围 | — | — | **0/24** |

内置专家包的核心方法大多已包含边界、失败与验收要求，但这只证明方法文本可装配。RQA39 的真实留出题证明模型表现仍可显著失真：action-owner 单题 5/5 仅是候选；requirement-reviewer 首轮 3/5，修改后 5/5；qa-engineer 连续三个包版本仍为 2/5、2/5、1/5。因此不再通过扩写 Skill 或工程绿测授予资格。

## 产品表达修正

能力中心 curated 专家徽标从“认证”改为“官方”。它只表示 KnowMe 内置来源，不暗示通过专业评测。明确 `limited` 的外部专家仍显示“能力受限”并禁止执行。

## 回归证据

- `tests/agent-evals.test.js`：8/8 通过。
- 能力中心领域 + Renderer：26/26 通过。
- 全量报告：`rqa59-agent-evals-v2.md` 与 `rqa59-agent-evals-v2.json`。
- 全量 `npm run check`：exit 0；后端 3565 项（3514 通过 / 51 跳过 / 0 失败），Renderer 86 个文件 607 项通过，lint 与 Renderer TypeScript 通过。
- GitNexus `detect_changes(all)`：共享脏工作树为 344 文件 / 755 符号 / 172 流程，总体 CRITICAL；包含本轮之前的大量并行改动，不能将整树风险归因于 RQA59。本轮符号 `evaluateExpertPackage` / `scoreRuntimeTasks` / `evaluateAgents` / `hubItemBadges` 已在修改前单独做影响核对，并由定向与全量回归覆盖。

## 尚未完成

- 22 个内置专家仍缺满足 v2 门槛的真实任务组，不得标记 qualified。
- 历史专业任务需逐项转换为可机器消费的场景和断言证据，不能编造缺失的维度分。
- 外部 `th-art` 源包仍需在获得写入授权后修复断链引用、包外脚本和未声明工具合同。
- 24 专家目标保持 ACTIVE。
