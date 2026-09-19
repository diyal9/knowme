# 商业洞察方法、工具与专业资格复验

## 结论与边界

通用方法装配、计算工具和部分交互恢复已修正；商业洞察专家仍不满足生产级专业资格。真实模型能完成算术并自行纠正表达式，但仍会作出无依据的因果判断、把观测值当护栏、在正确表格之外添加错误情景估算。不能把工具成功、平台 review 状态或若干断言通过当作专家合格。

这是22内置+2自定义专家全集验收的一项深入样例，不覆盖其他23位。测试使用隔离 Electron profile、实际 Qwen 3.8 Flash（qwen3.8-flash），没有模型输出夹具。所有业务数据为合成数据，没有执行投放、上线或外部写入。源码包只覆盖隔离 QA 副本，未升级用户原安装包，未修改用户主应用、真实任务或模型配置。

## 接通方法和工具的两道边界

1. `expert-task-runtime.execute` 原先只在预检中验证 requiredSkills 安装/启用，没有把它们传入生成调用。新增 `skillRefs: outputSpec.requiredSkills || []`，沿既有 L1 装配链进入上下文。可选绑定仍由模型选择，不把所有包强塞进系统提示词。required/optional/unbound 三种真实方法装配测试验证这一边界。
2. 商业洞察专家2.2.0将三项必需方法写入单一 answer 交付契约，第二项分析要求合并到同一答复，避免同一个用户问题被拆成重复文档。
3. 新增通用 `calculate`：有界数值解析器，不用 eval/Function/vm，不读写文件或网络，不产生 artifact，不需额外审批；支持表达式、sqrt/abs/min/max、分项错误、数量/长度/深度预算。正式工具回合可用，规划讨论不可用，无专家ID分支。精度为 binary64，不承诺任意精度。
4. 注册不等于可用：业务包原 `permissions.tools.allowlist=[]` 在 v1 治理中明确拒绝额外工具。2.2.1只授权 calculate，network/write/externalWrite仍为false。回归使用真实包快照和工具投影，空许可只见4个原有知识工具，授权后可见并执行calculate。没有通过放宽运行时权限来解决。
5. `capabilityIds` 分类尚无 math/calculate 类别；有无calculate都可能只显示 suggestion/knowledge。工具可用性以最终投影和实际回执判断，不能只凭该摘要判断。legacy保留extraTools的测试是既有行为刻画，不推荐退回legacy绕过v1权限。

方法包：business-metrics-analysis、business-cause-analysis由1.0.0升至1.1.0；business-insight-report沿用1.1.0。指标方法增加口径、加权分解、数量变化、成本、统计适用条件及计算回执；归因方法区分事实/算术/假设与受限决策，不把周度总量推成曝光分配或发生日期。不是按本题数字填模板。

## 实际执行证据

| 阶段 | 任务 / Run | 方法与工具 | 工程结果与专业问题 |
|---|---|---|---|
| 必需方法接通 | task-mtoof0wd-j8bxp / mtoof1ig | 旧指标/归因方法，完整2113字 | review；分解期别不一致，编造新版只在展示渠道 |
| 旧方法正向题 | task-mtoof1im-65rmz / mtoof23d | 同上 | review；主指标基本正确，额外z与监测标准错误 |
| 新方法但未授权工具 | task-mtop2yhd-msfec / mtop2z20 | 完整4328字，calculate不可见 | review；最终分解算对，但混入错误试算、虚构下降日期和因果排除 |
| 同配置正向题 | task-mtop2z26-6ntg3 / mtop2znn | 新方法，calculate不可见 | review；额外成本降幅、观察窗口等仍有问题 |
| 新方法+明确授权 | task-mtopjyz4-mlmm8 / mtopjzk6 | calculate成功2次 | review；主分解正确，仍以组内改善排除新版损害，小样本统计和建议越界 |
| 同配置正向题 | task-mtopjzkd-05dx3 / mtopk062 | 1次batch_limit后拆分，成功3次 | review；修正错误分子后z=9.42809/9.84136，仍把观测率当硬护栏 |
| 未用于调优的留出题 | task-mtopn9p2-e5rm3 / mtopna9b | 行序/总量/成本变化；1次batch_limit后成功2次 | review；率/数量/成本主表正确，额外预算情景估算错误，不能判合格 |

完整 Run ID 均为 `expert_<task-id>_<表内后缀>`。新方法各轮日志：`skill.explicit-content` 4328字、hash `27af0c546423f140`、`truncated=false`；三项方法都实际装配。tool-receipts.json保留模型提交的表达式和真实数值，不能把表达式合理性归给计算器负责。

原文与独立评分见 `../skill-evals/business-methods-workspace/`。iteration-1比较旧方法与新方法但工具不可用；iteration-2比较前一阶段原输出与明确授权后的输出，旧侧复用历史输出、不是同时间重跑。每题每配置单次，存在随机和顺序差异，不据此声称稳定性或单独归因Skill文字。留出题输入/断言在执行前保存为 `bi05-holdout-input.json`。不同案例的通过率不能直接混合当专家资格分。

## 正常修改、重开与自然异常

- `task-mtonnbn1-6i2qa` 旧v2任务：实际列表重开、刷新后再次从列表重开，两次均为接受1、修改1、主输入框1，发言者显示商业洞察专家而非任务标题。点退回修改聚焦原输入框。截图 `bi01-reopen-fixed.png`。
- `task-mtop2yhd-msfec` 通过主输入框提交27→9及撤回无依据结论，v2保留v1和意见，主输入框/接受按钮仍各1。截图 `bi01c-method-revision.png`；原文 `bi01c-revision-answer.md`。该版本仍有额外统计/因果问题，不判专业通过。
- `task-mtopjyz4-mlmm8` 修改轮 `mtopujw3` 遇到真实 DashScope 15秒连接超时：task=failed、版本仍1、没有假v2，attention保留具体原因，意见和原稿在对话可见。失败时接受按钮0、主输入框1。截图 `bi01g-revision-timeout.png`。
- 实际点击“重新执行”后，`mtopxi85` 恢复同一修改、生成v2进入review。接受1、输入框1、重试0，27→9意见仍在。完整原文/3次计算回执/失败与重试关联见 `bi01g-revision-retry.json`，截图 `bi01g-revision-retry.png`。其计算先错后主动复核成功，但仍有“人群必然变杂”等无依据机制及过长交付，不能以恢复成功掩盖内容问题。
- 新发现失败界面只展示泛化失败而把真实超时原因隐藏到记录，已作为RQA-09单独修复：failed对话显示结构化attention安全首行，未知/疑似凭据诊断安全兜底，不再默认推荐多专家。捕获原因的只读UI回放见下节，不把重试成功或回放当成新的真实故障测试。

## 工程验证与风险

`npm run check`（session78713）exit0：后端2089项，2038通过、51项既有跳过、0失败；renderer80文件544项全通过；lint与typecheck通过。完整输出 `check-business-methods-2026-09-06.log`。RQA-09修复后的完整检查session88890也exit0：后端结果相同，renderer80文件559项全部通过，lint/typecheck通过，日志 `check-rqa09-2026-09-06.log`。

此前session89038在renderer执行中追加输入用例超时（543/544）；原偶发失败未被再次复现。测试现在明确等待store草稿和渲染发送就绪再按Enter，保留精确参数/单次提交断言，无sleep/延长timeout，不声称已经证明其唯一根因。相关过程见runtime-qa-review.md的RQA-07。

GitNexus：execute修改前LOW，直接涉及createStart/provideInput/retry/reviewDeliverable；计算工具注册入口LOW。新测试符号未入索引返回UNKNOWN，未把零结果当零风险。共享工作区detect_changes为CRITICAL（293文件、537符号、160相关流程），包括其他既有和并发工作，不能归因本增量或声称整个工作区已审完。git diff --check通过（另有既有Windows GPU文件换行提示）；未commit。

## 独立专业复核与只读界面回放

iteration-2三题均4/5，但专业资格全部失败：渠道题用组内率改善排除版本损害；随机题把12%/7.2%观测点估计直接作为硬护栏；新留出题主表虽正确，追加恢复流量方案的预算、注册与费用上限相互矛盾。独立审阅对全部60个工具表达式重新计算，没有把已纠正的中间z错误继续扣作最终算术错误，也没有忽略正文额外主张。三份grading.json保留逐条证据和断言之外的claims。

`../skill-evals/business-methods-workspace/review.html` 提供5份历史/候选原文、回执和评分；iteration-2/benchmark.json仅汇总两道匹配题（旧侧7/10，新侧8/10），新留出题无baseline不混入。每题每配置单次、历史输出复用，差异不等同于稳定提升；耗时/tokens/成本未知，未填0。查看器由skill-creator提供的generate_review.py生成。

RQA-09界面核对使用现有隔离Electron：先验证userData路径；临时包装内存中的expert-task-get只读返回，仅对task-mtopjyz4-mlmm8投影failed及已捕获的超时attention，保留其当前v2内容。没有写任务文件、修改API权限、再次调用模型或点击重试。截图 `rqa09-failure-ui-replay.png` 已人工查看：具体超时原因在对话正文，主输入框1、重试1、接受0、转工作流0，段落可读。随后恢复原IPC处理器，真实读取仍为review/version2。这是故障展示回放，不是超时当时完整历史快照，也不是新的自然故障成功恢复证据；自然超时/恢复证据仍以前节的真实run为准。

## 未完成

商业洞察还需解决因果可识别性、额外情景数字复核、监测阈值依据和精简交付，且通过重复与新留出题。其他23位真实专业资格、安装升级保真、RQA-01/03/04/05以及媒体全链路验收仍未完成。接下来的资格审查继续分开工程可执行与专业可靠，不能按Skill数量、字数或单次成功授予专家资格。
