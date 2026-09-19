# RQA20 old6 同 run 上下文审计

2026-09-06。只读保存的 old-live 与指定隔离 QA 根内六个精确 run；仅新增本报告。无 API、模型或任务调用，无安装/重启，无生产、冻结测试、原始证据或评分修改；未访问用户 APPDATA。保存的 provenance 中含 APPDATA 字符串，未沿其路径读取。

## 结论

六个旧任务的 assignment/session/installed 均指向 2.0.0。六轮真实 `llm-system-prompt` 均 `skillRefs=[]`，included 无 `skill.explicit-content`。CD 两轮有 `skill.auto-summary`；CS、DA 各两轮无 Skill 块。**不能把 RQA19 的 CS 有 L0 结果复制到本批，也不能用当前磁盘运行时推断本批 L1。**

全部 task brief 的 primary 为 `requiredSkills=[]`。已安装依赖 ready 不等于每任务加载 L1；本审计不判断专业水平、不将缺方法归因为任一专业失败。

## 来源与绑定

- 保存证据：`D:/aispace/knowme/openspec/changes/production-qualify-all-experts/evidence/rqa20-old-live.json`。
- 文件 SHA256：`D2120A2F1013E36E9780C62EA3BF67C61B052BD91CCC171D46D44BF43B5D24F7`；phase=`old-installed-2.0.0`，capturedAt=`2026-09-06T04:11:54.996Z`。
- 授权隔离根：`D:/USERCA~1/Temp/knowme-expert-qualification-e3808573825e42908aef0a0f2d0f20de`。
- 装配日志：上述根下 `logs/knowme-2026-09-06.jsonl`。以下各 run 恰有一条同 run 装配日志；时间均 UTC。
- 交叉读取上述根下 `agent-runs/<runId>/state.json`、`events.jsonl`；前五轮另读 `checkpoints/latest.json`，DA-H02 该 checkpoint 不存在。

| 案例 | taskId | 精确 runId | 日志行 / 时间 | task / state.status |
|---|---|---|---|---|
| R20-CS-N01 | task-mtpaibcd-ad0cj | expert_task-mtpaibcd-ad0cj_mtpaibv6 | 502 / 04:06:44.535Z | review / done |
| R20-CS-H02 | task-mtpaicmn-s2k79 | expert_task-mtpaicmn-s2k79_mtpaid61 | 504 / 04:06:45.846Z | review / done |
| R20-CD-N01 | task-mtpaidm4-33yfd | expert_task-mtpaidm4-33yfd_mtpaieah | 506 / 04:06:47.488Z | review / done |
| R20-CD-H02 | task-mtpal2n9-5vqtp | expert_task-mtpal2n9-5vqtp_mtpal3ie | 514 / 04:08:53.761Z | review / done |
| R20-DA-N01 | task-mtpal4bc-ii3ks | expert_task-mtpal4bc-ii3ks_mtpal4sf | 516 / 04:08:54.847Z | needs_input / done |
| R20-DA-H02 | task-mtpal55n-5xfdv | expert_task-mtpal55n-5xfdv_mtpal5n0 | 518 / 04:08:55.966Z | failed / error |

六个完整 sessionId 均为 `wb-expert-` 加表中 taskId；逐个验证 `state.sessionId === rows[].session.session.id === task.execRef.id`。前五个 runId 与 `task.executionEvidence[0].runId` 相同。DA-H02 的 executionEvidence=[]，其 runId 从精确 taskId 命中的日志取得，再由 state 的完整 sessionId 交叉确认，未按时间邻近或最新目录猜配。日志 sessionId 是脱敏值，不用于单独证明绑定。

六轮 state 均 terminal=true，但 phase 字段仍为 RUNNING；本表采用实际 status，不把 phase 单字段当活跃运行。events 各只有 run.created/run.started/run.terminal 三条，是生命周期记录，不是完整工具流水。

## 安装、会话与实际装配

| 专家 | 保存的 installed/assignment 版本、短 hash | installed/assignment/session Skill bindings | SOP 与 installed 比较 |
|---|---|---|---|
| content-strategist | 2.0.0 / 21a196c32c0707e8 | writing-polish | 两题全文相等 |
| creative-director | 2.0.0 / c881b9fbda76a4de | writing-polish、visual-brief-prompt | 两题全文相等 |
| data-analyst | 2.0.0 / d911ee5d728c4409 | [] | 两题全文相等 |

六会话 readiness=ready、issues=[]，CS/CD 对应依赖项 ready，DA items=[]。三旧 installed canonical 均为 legacy adapted manifest，permissions={}，未见 metadata.knowme.execution。**permissions={} 不等于新候选显式全 false/空**；本轮未读取当前已升级的安装目录来补写旧记录。表中短 hash 为保存的 contentHash/agentHash，不冒充独立 SHA256。

六轮日志共同为 model=qwen3.8-flash、manifest version=1、scene=expert-collaboration、phase=execution、executionPolicy=tools-allowed、locale=zh-CN、promptPackVersion=zh-CN@2，omitted=[]、conflicts=[]。

| 专家两题 | included 总块数 | Skill 块数 / L1 块数 | Skill 块 chars / hash | persona.sop chars / hash | persona.attributes chars / hash |
|---|---:|---|---|---|---|
| CS | 18 | 0 / 0 | 无 | 92 / dfc93f05e61fc31a | 66 / a74ee32b7fafbd54 |
| CD | 19 | 1 / 0 | skill.auto-summary：413 / daff1ea04ae299e1 | 105 / 7cdcfa8b46f59dd0 | 64 / 5301ef4c804e068c |
| DA | 18 | 0 / 0 | 无 | 88 / 3aa8616357cc4d38 | 66 / c7ffa6d634510336 |

六轮各有 3 个 persona 块，另外一个 id 脱敏为 `per***ld`，131 chars、hash `9c4e9cd37b672d21`，不猜测其完整名称。所列 persona/Skill 块均 truncated=false。chars 是日志记录的装配块字符数（包含可能的标题/包装），未单独测量标题字数，也不把短块 hash 当缺失正文的独立 SHA256。L1 缺失结论来自上述当轮日志，不来自包依赖或新源码。

## 动态工具与记录缺口

- 前四题保存的 executionEvidence.toolCalls=[]，session.run.toolsUsed=[]，未记录到动态 load_skill。
- DA-N01 保存的工具流水为 math.compute 两次 fail（未注册工具），create_artifact 一次 ok；没有 load_skill。task gateStatus=blocked、verificationPassed=false，claimLabels=['结论']，因此 kernel done 不等于任务 review。这里只记录平台结果，不裁定该字段是否应被拦。
- DA-H02 task 无 executionEvidence，session.run.toolsUsed=[]，无 checkpoint；state.stopReason 是“本轮工具目录中没有这个工具”的失败提示。现有生命周期 events 不提供完整工具序列，故不能用空数组证明完全未尝试工具，也不猜具体失败工具名。其装配日志可确认模型准备上下文确实存在。
- 日志 capabilityIds 或工具面可见不等于工具实际调用/获授权；本批 SkillRefs 为空也不能单凭这一点证明所有后续请求均无方法文本。

## QA 已加载模块与磁盘变化严格分开

old-live.runtimeIdentity 保存 PID **13260**、上述隔离 userData，以及模块 `diskSha` 与 `exportFunctions` 指纹。只读取已保存记录，没有对 QA 进程发新探针。

| 模块 | 捕获时记录的 diskSha | 捕获的导出函数指纹 |
|---|---|---|
| agent-context-assembly.ts | 73a617053bf11036f357c31cb2998de13e4fe29198fe05f3e0d46d8b72156402 | assembleCapabilityContext：37ef3779d4c02b66f63e35bd31f7920b30196566ea78729600a5e1dd71818fa3 |
| skill-runtime.ts | 57722584f5c03757de019356566d3cdcd9aa6c30f6977287662ea5f60988a0a6 | createSkillRuntime：7bcf9d7ddb03d930a35e72ff0ffe8531919ab39eb62a87d1764257d0d08b2877 |

diskSha 是捕获时磁盘文件值，不是已加载模块源码 hash；exportFunctions 是保存的函数指纹，不是整个进程及闭包依赖的完整快照。主线说明本批旧新同 PID、不重启，本报告保留该条件但不把一次 PID 记录扩大为全时段模块未变的独立证明。

主线提示的北京时间 12:03 assembly / 12:08 skill-runtime 后续磁盘变更，及结构复核实际捕获的 assembly `73A617…→9F8AEB…` 漂移，均不能倒推该 QA 进程加载了什么版本。当前磁盘 check 失败不自动归因到此旧批；本批实际方法装配仅以上述精确同 run manifest 为依据。新批需另取同 run 和 runtimeIdentity 比较，不能用本报告代替。

## 取证指纹与限制

精确 `agent-runs/<runId>/state.json` 原始字节 SHA256：

| 案例 | SHA256 |
|---|---|
| R20-CS-N01 | 24b9c9503ae6ef240b711e2730bee3751b1e4ec5faa4a4a0dac8a25a916395f0 |
| R20-CS-H02 | 1eabd21aeacffac4c313bcda72e1afc2d131111aadee92717c87616c4270eadf |
| R20-CD-N01 | 9c0db18bcdb8422b4927866aed0c194d447dc1c602b29d40cfb931f7d7ccbf50 |
| R20-CD-H02 | 57f8603bc46a81d9801849b78e87bab36d367f4a9f2ab3463be82eee7ba6dc31 |
| R20-DA-N01 | a36ae134c1341d4219f63efe67efa10378f79f6a5f73b352ed78bea058a2cf4e |
| R20-DA-H02 | 6337fc96bf3c92c00c3b2698fac637d7d97cf2a11f2757f368d0f7864c797f7d |

未取得逐次 MODEL/FINALIZE 完整 HTTP 请求或全部动态工具原始回执；一条装配 manifest 不等于每次请求的完整内容，更不等于模型注意或遵循方法。未比较后来 retry、新候选任务或当前安装目录，未对候选安装成功作本轮独立复验。原始输出专业评估与整包旧新对照留给后续，不声称纯 Skill 因果或完全独立盲评。
