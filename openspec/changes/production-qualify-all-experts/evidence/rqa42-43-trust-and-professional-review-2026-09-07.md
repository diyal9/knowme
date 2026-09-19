# RQA42–43：历史状态归因、专业复核与能力目录闭包

日期：2026-09-07  
结论：工程合同通过；未新增生产合格专家；总体目标继续 ACTIVE。

## 1. 问题与边界

本轮处理三个系统性问题：

1. 用户提供的历史回执（例如“8 个 Skill 已安装”）会被误判为当前 Agent 无回执执行声明；但也不能因此放宽“我已安装/发送/发布”等当前执行声明。
2. 专家即使加载了必需 Skill，最终答复仍可能在改写阶段新增无依据事实。平台缺少“由专家包声明标准、由通用运行时执行”的专业复核合同。
3. 内置专家声明的必需 Skill 不一定发布在能力目录中，导致专家更新后依赖仍无法安装；目录与包版本也存在漂移。

本轮没有在 KnowMe 中增加 fact-checker 或其他专家 ID 分支。专业标准归专家包所有，KnowMe 只提供有限、通用、禁工具的复核执行能力。

## 2. RQA42：来源归因的历史执行状态

- `executionClaimText(text, userSources)` 只在同一句存在明确“用户提供的历史记录/回执”归因，且用户材料中存在相同执行状态族时，屏蔽该历史状态的当前执行声明检测。
- 读取、创建、写入、保存、导入、安装、发送、发布、删除、运行和执行按有限状态族逐项匹配，不能用一种历史回执替另一种状态背书。
- 第一人称或当前轮动作（如“我已安装”“本次已执行”）始终保留并要求真实工具账本。
- 工具返回的引用片段不作为“用户历史材料”，避免工具文本自证。

冻结反例覆盖：无匹配状态、无来源、伪造归因、归因后夹带第一人称执行、仅有来源但输出未归因，均必须阻断。

## 3. RQA43：专家包声明专业复核合同

新增通用 `metadata.knowme.execution.qualityReview`：

- 包只能声明 `enabled` 与有限 `criteria`；标准最多 12 条、单条最多 360 字。
- 运行时首轮得到完整候选后，最多追加一次禁工具、answer-only 的复核请求。
- 候选以 assistant 数据传入；复核输出必须是完整替换稿，不展示评分、自检过程或内部提示。
- 复核失败时 fail closed，不把未复核草稿写成最终成果。
- 未声明合同的专家执行路径不变。

首个采用者是 fact-checker 2.2.0。其包内标准要求原子声明拆解、全文及修正文一致性、证据不足/矛盾/身份未知/来源冲突区分，以及时间和材料范围约束。这个改动仅证明运行时具备专业复核能力，不证明 fact-checker 已获得生产资格。

## 4. 能力目录依赖闭包

新增全目录冻结检查：

- 每个内置专家在目录中恰有一个同版本 expert 条目；
- 每个 required Skill 在目录中恰有一个可安装条目；
- `bundlePath/SKILL.md` 必须可读；
- 目录版本必须与 Skill `capability.manifest.json` 一致。

检查首次发现：`evidence-verification` 未发布，三项商业 Skill、`qa-test-design`、`visual-brief-prompt` 及两个专家版本漂移。目录和 sidecar 版本已对齐。

隔离 `%APPDATA%` 实测 `capabilityUpdate({id:'fact-checker'})`：修复前返回 `dependency_update_unavailable`；修复后成功安装 fact-checker 2.2.0，并递归安装、启用 evidence-verification 1.0.0，warnings 为空。没有覆盖用户管理的同名包。

## 5. 测试证据

- RQA42 及声明/工具回执相关：83 passed，0 failed。
- RQA43 专业复核与运行时相关：127 passed，0 failed。
- 目录闭包、能力目录、导入与递归更新：26 passed，0 failed。
- fact-checker 隔离更新：2.2.0 expert 与 1.0.0 evidence-verification 均 installed/enabled。
- 最新完整 `npm run check`：后端 3459 passed / 51 skipped / 0 failed；渲染层 86 files、606 tests passed；lint 与 typecheck passed。
- `git diff --check` 无空白错误；GitNexus 对整个共享脏工作树报告 338 files、720 changed symbols、172 affected processes、CRITICAL。该全树风险包含长期累积修改，不能归因于本轮；本轮既有高风险符号已在修改前单独完成 impact 审计。

## 6. 资格判断

- 22 个内置专家当前至少具备一个声明的必需专业方法，这只是结构门槛，不是专家资格。
- fact-checker 仍为“不合格/待复验”：旧 FC01/FC03 的事实新增问题尚未通过同题复测、新留出题和修改轮证明关闭。
- 当前隔离环境未配置可用模型 API Key，无法取得新的真实模型输出；这是环境阻塞，不计为专业失败，也不能用离线夹具代替实战证据。
- 两个自定义专家及全部专家的正常、异常、重试、修改、重开与视觉验收仍未完成，因此 24 专家总体目标保持 ACTIVE。

下一步：恢复可用模型配置后，先对 fact-checker 执行旧失败题 + 新留出题 + 修改轮；同时按专业风险优先推进此前 0–2/5 或无法交付的专家，不以 Skill 数量、目录安装成功或工程测试通过授予“专家”资格。
