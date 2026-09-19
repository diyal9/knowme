# RQA27 六包与方法装配：开发侧只读诊断

日期：2026-09-06。仅审包/源码与契约，不评分；不是 team-tester 正式验收、运行授权或资格放行。未访问 QA/profile、模型、网络；未安装、修改源码/测试/包/外部 Skill。

## 结论

1. **installed 与源码并非同一整包**：五个专家的 installed EXPERT 缺源码新增的五步 SOP；视觉专家 EXPERT 一致，但六个 installed canonical 全部缺源码的 execution 配置与显式拒绝权限。同版本号不能证明同内容。
2. **六包均没有确定性的必需方法 L1 接线**：installed 和 source 的输出/路由均未声明 requiredSkills；安装依赖 required=true 不等于本轮传入 skillRefs 或加载正文。不能把本轮结果标为“已使用源码方法”。
3. **未见六包强制工具/真实文件契约**：只读投影的 requiredTools/requiredEvidence/requiredArtifacts/completionConditions 均空、minArtifacts=0、expectsArtifact=false。但 installed permissions={} 也不是硬禁工具；实际工具面仍须核对同 run wire。
4. 重点待观测风险：视觉专家计划确认提示与完整方案交付要求的张力；知识管家方法的仓库操作偏向；产品经理同版本依赖/交付形态漂移。以下均为设计/装配风险，不是对尚未读取的六次输出作因果归因。

## 证据与方法

- 冻结包：[rqa27-before-packages.json](D:/aispace/knowme/openspec/changes/production-qualify-all-experts/evidence/rqa27-before-packages.json)，SHA256 `38ce063579bdd37bed190f0965e388bf58680f333499f6f0e43c49af1c1d29d5`。仅读取其中 installed[].files[].text；里面的 profile/provenance 路径仅作历史字符串，未跟随读取。
- 冻结题面：[rqa27-professional-cases.json](D:/aispace/knowme/openspec/changes/production-qualify-all-experts/evidence/rqa27-professional-cases.json)，SHA256 `c38befcb7337785e01462779d15b6e30e2f4de34474643c203f42020a83025b2`。六题均只授权给定合成材料内的对话交付，禁止工具/文件/外发；视觉题也未授权付费出图。
- 对 36 个冻结 E/C/L 文本重新计算 SHA256，全部符合记录；18 个 source 文件当前磁盘 hash 全部符合冻结值。下表 E/C/L 分别为 EXPERT.md / capability.manifest.json / manifest.json。
- 使用 gitnexus-exploring：repo context 的索引日期为 03:56:23Z，标记 scope-extraction-unverified；query 因 FTS 未装载返回空，context 找到 loadExpert/resolveOutputSpec，均为 lower-bound。返回的 proc_120_create 资源未找到；故以当前源码补查，不将图中缺边当作不存在。遵守本轮限制，未重建索引或修 infra。
- 离线内存检查使用仓库 `node -r ./scripts/register-ts.js -e ...`：把冻结 E/C/L 注入仅有 existsSync/readFileSync 的内存 fs，真实调用 createExpertRuntime().loadExpert → resolveOutputSpec / expectsArtifact / buildRunGovernancePolicy。12 份包 × 默认与自定义 primary-answer 两种输入，共 24 个输出投影，exit 0；没有 createStart/execute 或真实 session 装配。**这不是实际 L0/L1 已加载的证据。**

## 六包差异

| 专家 | installed 与 source 版本 | E/C/L 字节一致性 | 已证实的方法/交付差异 |
|---|---|---|---|
| knowledge-curator | 均 2.0.0 | E不同/C不同/L相同 | installed 只有简短 systemPrompt，源码新增来源版本盘点、稳定 ID、分类映射、维护与检索核对五步 SOP；两端均绑定 knowledge-steward。源码声明两个 answer 交付，installed 无 execution。 |
| longform-editor | 均 2.0.0 | E不同/C不同/L相同 | installed 缺源码的论据地图、段落推进、三轮编辑、完整正文五步 SOP；两端绑定 writing-polish。源码明确两个 answer 交付，installed 只保留文字 outputContract。 |
| presentation-writer | 均 2.0.0 | E不同/C不同/L相同 | installed 缺源码的每页信息任务、标题/证据/图形/讲解、时间预算五步 SOP；两端绑定 writing-polish；源码两个 answer，installed 无执行声明。 |
| product-manager | 均 2.0.0 | E/C/L均不同 | installed 仅 writing-polish(required)。源码 E/L 添加 office-requirement-doc；C 将其设 required、writing-polish 改 optional，增加五步 SOP/完整正文要求及 document-first、primary+acceptance(mergeInto primary)、requiredSections。这些均未进入本轮 installed 包。 |
| research-analyst | 均 2.0.0 | E不同/C不同/L相同 | installed 缺源码的证据矩阵、反证、方法质量/独立性、推断与未知区分五步 SOP；两端绑定 knowledge-steward+writing-polish，C 均 required；源码两个 answer，installed 无执行声明。 |
| visual-designer | 均 2.2.0 | E相同/C不同/L相同 | 已安装完整六步交接 SOP，与源码 E 完全一致；两端绑定 visual-brief-prompt，planning/planFirst/requirePlanConfirmation 相同。源码 C 的两个 answer 交付和拒绝权限没有同步到 installed C。 |

当前 catalog 六个 expert 条目版本与各自 E/C/L 版本相符，但这不能消除上述同版本内容漂移。五个无显式 SOP 的 installed 包并非“没有提示词”：真实 parser 将 systemPrompt 映射为 SOP（解析后分别 72/63/73/99/71 字符）；视觉为 566 字符。这里只报告装配来源，**不按长度衡量专业性**。

## 实际接线与权限边界

### 1. 包可用、绑定、必需方法、真实正文是四个不同事实

[loadExpert:306](D:/aispace/knowme/src/lib/expert-runtime.ts:306) 读取所给 capabilitiesRoot 的 E/L/C；有效 canonical 优先，不按相同 ID 自动补入 src/catalog 内容。[resolveSoulSop:89](D:/aispace/knowme/src/lib/expert-agentic-profile.ts:89) 将旧 systemPrompt 兼容为 SOP；源码新增 SOP 不能由旧版本号推得。

[resolveOutputSpec:110](D:/aispace/knowme/src/lib/expert-execution-profile.ts:110) 从当前快照 execution.deliverables/routes 合并要求，不把 dependencies.required 自动转为 requiredSkills。[preflightSkills:342](D:/aispace/knowme/src/lib/expert-task-runtime.ts:342) 仅检查本轮 requiredSkills；[execute payload:608](D:/aispace/knowme/src/lib/expert-task-runtime.ts:608) 将其写入 skillRefs。六包两种投影 requiredSkills 均为 []，因此**缺少包级强制 L1 的充分接线**，不是已经观测到本轮 skillRefs=[]。

[prepare:143](D:/aispace/knowme/src/lib/agent-generate-prepare.ts:143) 合并 skillRefs 与 prompt slash；[assembleCapabilityContext:226](D:/aispace/knowme/src/lib/agent-context-assembly.ts:226) 的 autoMatch 产出 L0，显式 slash 才走 loadSkillL1。绑定/授权过滤、模型后续自主读 Skill 都会影响实际使用，L0 命中不能当 L1 正文。当前 [loadSkillL1:588](D:/aispace/knowme/src/lib/skill-runtime.ts:588) 要求启用、允许调用且正文在预算内，否则失败，不应静默截断通过。

### 2. installed 的空对象权限不是源码的拒绝白名单

六个 installed C 均 `permissions:{}`、无 connector 依赖；source C 均明确 `tools.allowlist:[]`、`connectors.allowedConnectorIds:[]`、network/write/externalWrite=false。纯投影前者工具 allowlist 为 null（未声明限制），后者为 []（显式拒绝），不能把它们说成等价的 no-tools。

[buildRunGovernancePolicy:140](D:/aispace/knowme/src/lib/tool-surface-builder.ts:140) 交集保留显式空数组；[实际 surface:204](D:/aispace/knowme/src/lib/agent-generate-tool-surface.ts:204) 还结合 session、权限与能力范围。空 connector bindings 通常约束连接器默认可用性，但不证明所有 builtin 工具不可见；仍受 host/组织/任务授权/执行策略约束。内存单层治理的 allowDelegate 默认值不代表正式任务授权：runtime [620](D:/aispace/knowme/src/lib/expert-task-runtime.ts:620) 明确追加 allowDelegate=false/maxSubRuns=0。

六包没有 requiredTools/connectorIds/grounding 文件要求；已审四个源码 Skill 的 sidecar 也未声明必须调用工具的 grounding。Skill 自然语言操作步骤不是调用凭证或授权。正式 expert-execution 的 Feishu 强制条件在 [prepare:502](D:/aispace/knowme/src/lib/agent-generate-prepare.ts:502) 不再从整段材料快捷语义新增；实际运行仍以其最终合并 contract/wire 为准。

### 3. document 不是强制生成文件

24 个投影均 expectsArtifact=false。installed 默认兜底为 primary/document；显式 primary-answer 保留用户标题/type。源码除 PM 外默认 output-1/answer。源码 PM 的匹配 primary 会把用户 title/type 改成“产品需求文档”/document 并追加章节，这是已复现的交付显示/模板差异，**不是本轮旧安装包行为**。

真实文件门槛由 [expectsArtifact:167](D:/aispace/knowme/src/lib/expert-execution-profile.ts:167) 的 minArtifacts/requiredArtifacts/artifact_present 决定；[任务 prompt:181](D:/aispace/knowme/src/lib/expert-task-runtime.ts:181) 只有满足该条件才要求真实成果。[文本回退:740](D:/aispace/knowme/src/lib/expert-task-runtime.ts:740) 可把正文存为 session artifact，这不等于调用文件写入工具或写用户原文件。用户“对话交付、不创建额外文件”与内部会话持久化也应区分。

## 源码方法风险（不是已安装方法正文取证）

- [knowledge-steward](D:/aispace/knowme/src/catalog/skills/knowledge-steward/SKILL.md:18) 主要面向开发 Wiki/OKF：先读 index、ingest 更新 index/log、执行 npm kb:lint。对 KC 的材料内索引设计、RA 的证据分析，存在场景错配和引导无关读写/命令的风险；用户本轮明确禁止这些操作。不能因为依赖已声明就将这些步骤注入每个任务，更不能反向认定本次已执行。
- [writing-polish](D:/aispace/knowme/src/catalog/skills/writing-polish/SKILL.md:16) 强调完整文本、≤3条修改说明、保持原意，适合作为辅助；不等于长文证据结构、管理决策汇报、产品验收或研究方法已覆盖。方法不足是包设计风险，专业表现待 Arendt 评分。
- [office-requirement-doc](D:/aispace/knowme/src/catalog/skills/office-requirement-doc/SKILL.md:1) 是材料内 PRD 写作，不要求创建文件，且明确不调飞书；disable-model-invocation=true，自动推荐不能替代显式选择。源码 PM 仅改 dependencies required 仍不足以触发 requiredSkills→L1。
- [visual-designer E:23](D:/aispace/knowme/src/catalog/experts/visual-designer/EXPERT.md:23) 的 requirePlanConfirmation=true 会经 [脚手架:147](D:/aispace/knowme/src/lib/expert-agentic-profile.ts:147) 加入“未确认前只完善计划与澄清”，与 SOP“信息足够后必须完整交接”存在指令张力。R27-VD 已授权完整设计，但未授权出图；应区分设计交付与后续生产批准，不把“可直接生成”当成批准，也不据此先判模型会停在确认。这里只确认提示文本机制，未发现包因此硬性要求 generate_image。
- [visual-brief-prompt](D:/aispace/knowme/src/catalog/skills/visual-brief-prompt/SKILL.md:1) 禁外部出图，但交接模板有“可直接生成”标签，仍需保留上述授权边界。另有确切版本漂移：SKILL.md/catalog 为 2.0.0，canonical sidecar 为 1.0.0（SHA256 `847cfa9be340e8ba2d258c29048b66b08c9e7d5a4d707422f0349b85d9bef8b6`）。其它三个源码方法的正文/canonical/catalog 均 1.0.0。四个 Skill 无 legacy manifest.json 是其现有两文件格式，不作为缺包结论。

## 最小后续方向与同 run 待核验项

本轮保持旧包基线不动。未来候选应版本化同步 E/C/L/catalog，选择真正适配职责的核心方法，按用途声明 execution 默认 route 和对应 deliverable 的 requiredSkills，辅助方法保持可选；不要把全部安装依赖强塞每个任务。同步权限时显式保留“纯分析/设计无工具”边界；PM 用户自定义交付语义及 VD 设计/生产确认应单独核对，不能靠专家 ID runtime 特判。

收到 wire/session 后再核对：task/session/run 精确绑定、assignmentSnapshot 的 E/C/permissions/bindings/brief.outputSpec、最终请求 model 与完整 messages；区分专家 SOP、Skill L0 清单、skill.explicit-content L1 正文；逐方法记录源 ID/来源、hash、字符数、truncated 和模型后续读 Skill 记录。再检查最终工具定义/实际调用/回执及正文是否被平台替换。没有这些证据时，L0/L1、实际工具可见性、专业输出原因均记**待观察**。before-packages 的 runtimeSourceMatchesR26=true 只是归档标记，不能证明当前磁盘等于 QA 已加载的全部传递模块。

本次源码锚点 SHA256：expert-runtime `ed6871457ebe22734132f9a15e6ce7515f79e089967402945559ff68d3e70248`；expert-execution-profile `6abf263e45dd934afcd12ff1ac334b2c30ad4451365f25cec0e044d4fce70bd0`；expert-task-runtime `505049371302d1e99105bda6481dfc44b828e7668c8aa104b70027256c35e3d1`；agent-context-assembly `0ec09e0da814c542c6bc9717bfdc512f77b53fcf018d21613525ac14d979b620`；skill-runtime `5b1dbf2a1dfaf989080ed1137036a9719949dd2b469dc5e48f24b8a479750823`。没有新增测试或执行 fullcheck。

## 追加：前四位 wire / 前三位 task-session 核对（2026-09-06）

本节只追加装配事实，不评分，也不推断专业成败原因。读取主线导出的请求体与 task/session；没有读取 profile 或发起任何实际调用。分母仍为六位：已有 wire 标签覆盖 4/6、task/session 归档 3/6；本批共 5 条请求，不能当作五个独立 run。KC 初次请求因观察器安装错误漏捕；PM 此时缺 task/session，RA/VD 此时无可读运行归档，不填零、不补造。

### 同 run 绑定与观察窗口

wire 记录本身**没有 taskId/sessionId/runId 字段，body 内也没有 runId**，不能仅凭 label 宣称原生带 run 的传输日志。前三位通过以下交叉绑定：归档 task.id=session.taskRef.id；task.execRef.id=session.id；session user/assistant.runId 与 executionEvidence.runId 一致；wire messages[5].content 逐字符以该 run 的完整 user.text 结尾（KC 1878、LE 2622、PW 1634 个 UTF-16 字符），label/专家身份吻合，startedAt 位于对应任务执行窗口。PM 两请求同 label 且 messages[5] 完全一致，但缺上述 session 闭环；标为待绑定，不虚构 task/run。

| 案例 | task / session / run | wire 索引（从 0 起）与 UTC startedAt | 归档状态与观察限制 |
|---|---|---|---|
| KC | task-mtpnlv8k-go6pp / wb-expert-task-mtpnlv8k-go6pp / expert_task-mtpnlv8k-go6pp_mtpnlvl8 | records[0]，10:14:04.318Z | needs_input；只有 FINALIZE 请求，首请求不可见，不能断言全 run 无 L1 |
| LE | task-mtpnpkea-dluao / wb-expert-task-mtpnpkea-dluao / expert_task-mtpnpkea-dluao_mtpnpkrn | records[1]，10:16:18.672Z | review；已见初次请求，未观察到本标签的后续请求 |
| PW | task-mtpnsh9f-ii2nj / wb-expert-task-mtpnsh9f-ii2nj / expert_task-mtpnsh9f-ii2nj_mtpnshml | records[2]，10:18:34.708Z | review；已见初次请求，未观察到本标签的后续请求 |
| PM | task/session/run 待归档 | records[3] 10:31:21.259Z、[4] 10:31:49.046Z | 标签侧初次+FINALIZE；不据此宣布最终状态或同 run 闭环 |
| RA / VD | 待证据 | 本文件无记录 | 主线报告 RA 失败、VD 将运行，尚未独立核验，不纳入已审运行分母 |

5/5 已捕获请求的 body.model 都是 qwen3.8-flash。max_tokens 均被导出为 [redacted]，不得从本文件报告实际请求 cap 或修复倍率。observation 明示只抓请求、无响应体；FINALIZE 判别由主线说明及 messages[6] 的长度中断重整指令支撑，不把请求中的描述充当原始 provider finish_reason 回执。

### 模型实际收到的专家 SOP / Skill L0 / L1

5 条请求的 messages[5] 均包含完整冻结题面；前三 session.user 正文也完整位于其中，不因旁边“材料正文未提供”的摘要提示就声称题面未传入。四个专家的受限 persona SOP 块与冻结 installed EXPERT 经 parser 得到的旧 SOP **逐字符一致**，不是源码新增五步方法：KC/LE/PW/PM 为 72/63/73/99 字符。前三 assignmentSnapshot 版本 2.0.0，agentHash 分别为 b745d7d0a7a04439 / 1cc9e171143baa2a / 56f90a4676603317，匹配冻结 installed E 的 hash 前缀；bindings 分别是 knowledge-steward / writing-polish / writing-polish，permissions={}。本批 session 未附完整原始 canonical 文件，不能由 E 短 hash 反推 C 全文已验证。

| 已观察请求 | Skill L0 摘要 | 可见 L1 正文 | 结论边界 |
|---|---|---|---|
| KC FINALIZE [0] | knowledge-steward，1 个摘要块、1 个 ID，336 字符 | 未见 `# 技能 …` 正文块或加载结果 | 仅证明该 FINALIZE 带 L0；首请求漏捕，不能推断整个 run |
| LE 初次 [1] | writing-polish，1 个摘要块、1 个 ID，228 字符 | 未见 L1 正文；归档 toolCalls=[] | 已见的是描述摘要，不是 writing-polish 完整方法 |
| PW 初次 [2] | writing-polish，1 个摘要块、1 个 ID，228 字符 | 未见 L1 正文；归档 toolCalls=[] | 同上，不把 available/loaded 工具计数当 Skill 载入 |
| PM [3]/[4] | 两请求均未见 L0 摘要 | 均未见 L1 正文 | 仅针对已导出请求内容，待 task/session 绑定后收口 |

本轮没有 contextAudit block manifest 或显式 loadSkillL1 回执；实际 skillRefs payload 字段也不在该 wire 中。前三 brief.deliverables[0].requiredSkills 确为 []，但它不是传输日志里的 skillRefs 字段。L1 的实际正文 hash/chars/truncated **不可提供**，不填 0 字符/false 冒充成功加载。这里用完整可见内容及官方块标题识别 L0/L1，不仅依靠名称关键词；“# 技能”与 skill.explicit-content 在 5 条可见请求中均无正文证据。后者本来可能仅在审计 manifest 出现，因此其字符串缺失本身不是否定加载的充分条件。

可重算指纹（UTF-8 SHA256；字符数为 JS UTF-16 length；L0/SOP 不含外层受限上下文框）：

| 请求 | messages[5] 字符 / SHA256 | persona SOP SHA256 | L0 SHA256 |
|---|---|---|---|
| [0] R27-KC-N01 | 3915 / `bffb71335b2903029601a82d9d327bb595edaee7d9deb73399a56ed2d6cbbdde` | `f299240626e453aa2041ac54183ced2db39b3c13c55401ebe38f87bdd801f80f` | `6a8c1ad3263335fa5664ffb845725856ca9fa320c22d84cac96f0c75493102dc` |
| [1] R27-LE-N01 | 4470 / `d14a0bf3ec9b6a5e778b5222d5e52056a389505de28454b6bb6d117a511d23fc` | `2613fb917d5c4460c0505de65b78cde2c0dc1227ecc7af52e353385d1b92132b` | `9814f660ecd80e20b4e7d5e011eac209b6f8c25ec4a5c45f9e6a523f9f86f224` |
| [2] R27-PW-N01 | 3446 / `7e660c3871732df025e6eed5387f4196a3d0c6c5a1d531b9239556d216ca39cf` | `4929352fde7002bebb3f28de19016e6aab91a7951ce8a14db3b389fcd5bf6ace` | `9814f660ecd80e20b4e7d5e011eac209b6f8c25ec4a5c45f9e6a523f9f86f224` |
| [3] R27-PM-N01 | 3427 / `b35bfbae243958644ebae5395da81194e38911bef18193429f439f19fa5d70da` | `59598687c8c54d0876cd76ba0bb968da1596616377469f01a67ba7df1536969c` | 未出现，不生成空串 hash |
PM [4].messages[5] 与 [3] 同 hash/3427 字符；不是另一个独立样本。

### 工具可见性、执行与最终状态分轴

- LE 首请求 tools 为 discover_tools、discover_capabilities、request_capability_access、list_skills、load_skill、grep_files、read_file、list_dir（8项），tool_choice=auto。
- PW、PM 首请求各为上述前五项加 grep_files、write_file、read_file（8项），tool_choice=auto。**用户禁止工具不等于宿主 schema 已硬禁**；PW/PM 实际仍展示 write_file。只证明能力暴露，不证明调用会越过权限/审批，也不证明已经写文件。
- KC/PM FINALIZE 请求没有 tools 字段；不能据此推断其初次请求无工具。KC session.expertTaskDiagnostics.loadedNames 报告包含 write_file 等 8 工具，但它是任务摘要，不是漏捕首请求的替代传输证据。
- 前三 session.executionPolicy 都是 tools-allowed；brief 默认 primary/document，requiredTools/requiredSkills/requiredEvidence/requiredArtifacts/completionConditions 均空、minArtifacts=0。其 executionEvidence.toolCalls 都为 []。这是本批真实归档可见状态，区别于上一节的内存推演；没有据此认证全系统无副作用。
- KC 最终为 needs_input/evidence_incomplete/retry，gateStatus=blocked，违例是 ungrounded_external_fact，claimLabels=[责任人]；session assistant 为 46 字的平台提示，核验候选指纹另指向 1723 字内容。不要当作 review 或专业成果评分，也不在本装配审查判断字段门禁是否正确。LE/PW 为 review/verified，依旧不等于专业通过。
- 可见装配还带有“所有回答须可由知识库检索”的历史偏好、空知识库摘要及“材料正文未提供”的内容理解摘要；完整本轮材料实际同时存在。它们是潜在提示张力，**不是本轮失败的已证因果**。仅记录已导出上下文，不复述其它个人背景，不访问偏好来源 profile。

### 归档 hash 与后续边界

- [rqa27-baseline-wire-first4.json](D:/aispace/knowme/openspec/changes/production-qualify-all-experts/evidence/rqa27-baseline-wire-first4.json)：`44610372e2655226648748e3b7017ed83f48b647c253ce173e66e7c7ce195c89`
- [rqa27-r27-kc-n01-actual.json](D:/aispace/knowme/openspec/changes/production-qualify-all-experts/evidence/rqa27-r27-kc-n01-actual.json)：`2e35f13fe387193c8de9d6f9bbabf51a5f85c2aed1b1af597e03c00bd221f89a`
- [rqa27-r27-le-n01-actual.json](D:/aispace/knowme/openspec/changes/production-qualify-all-experts/evidence/rqa27-r27-le-n01-actual.json)：`e5520e60411bdcebe9d940f686613a7aa5a595bd3d9b571d084c1ba30ce8b7db`
- [rqa27-r27-pw-n01-actual.json](D:/aispace/knowme/openspec/changes/production-qualify-all-experts/evidence/rqa27-r27-pw-n01-actual.json)：`3faea9d7560e3c9a4c2d8079e4b16ef870b73a93a9dafed088bedc59a81d3d59`

保留 observation.redacted=true 的限制：已核对的 messages 文本无 [redacted] 或截断标记，不等于证明观察器捕获了全部真实请求；KC 明知缺首请求。未抓响应、未提供完整 contextAudit manifest、PM/RA/VD task-session 尚缺。六位的实际方法加载率因此**暂不计算**，不能写成 0/6 或把当前 3 个 L0 当成 3/6 完整方法加载。后续仅随主线指定归档补齐同 run 证据，不修包、运行时或观测基础设施。

## 全量归档补充：六个基线与 KC 诊断 retry 分开（2026-09-06）

本节更新上节的归档可用性，不覆盖当时的观察。只读新 `rqa27-all-wire.json`、六份 `rqa27-r27-*-n01-actual.json` 与 `rqa27-verification-observed.json`；未访问 QA/profile，未调用模型、工具服务或重跑任务，不评分。使用 gitnexus-debugging：query 无流程结果且提示 FTS extension 不可用；context(verifyClaims) 返回 GROUND 调用与 checkProvidedFieldClaims 等被调用符号、processes=[]、lower-bound 索引限制，因此按当前源码核对，未重建索引。

### 同 run 绑定与方法可见性补齐

全量 wire 共 10 请求：基线六位占 [0..7]；同一 KC task 的诊断新 run 占 [8..9]，不是第七位专家，也不是第二个独立基线。`observation.omitted=0` 不抵销已声明的 KC 首请求漏捕。除下面明确含 repair packet 的请求外，wire 不自带 runId：沿用 label、task.execRef/session.id、session.taskRef、同 run 用户全文精确后缀和任务时间窗交叉绑定，不冒称传输层原生 run 标识。

| 补齐基线 | task / session / run | wire（UTC） | 归档状态 |
|---|---|---|---|
| PM | task-mtpo8wwc-p4a49 / wb-expert-task-mtpo8wwc-p4a49 / expert_task-mtpo8wwc-p4a49_mtpo8x95 | [3] 10:31:21.259；[4] 10:31:49.046 | needs_input，日期字段 blocked；session 仅提交 46 字平台提示 |
| RA | task-mtpobz00-npnqc / wb-expert-task-mtpobz00-npnqc / expert_task-mtpobz00-npnqc_mtpobzej | [5] 10:33:44.106；[6] 10:34:22.095 | failed/retryable_failure，未提交 assistant 正文；不是 review |
| VD | task-mtpoekri-9ket3 / wb-expert-task-mtpoekri-9ket3 / expert_task-mtpoekri-9ket3_mtpoel4s | [7] 10:35:45.527 | review/verified，4765 字文本；不是实际图像生成 |

PM/RA/VD 的绑定断言均通过：messages[5].content 以对应 session 用户全文结尾（1952/1825/2290 字），请求时刻均在 task.createdAt–updatedAt 内；RA [6] repair packet 还直接携带相同 taskId/runId。三者真实 primary/task成果/document 契约均 requiredSkills/requiredTools/requiredEvidence/requiredArtifacts/completionConditions=[]、minArtifacts=0，assignment permissions={}；与先前静态安装包判断相符，不等于权限硬拒绝所有工具。

| 基线 | 实际已捕获方法上下文 | 完整 L1 结论 |
|---|---|---|
| KC | [0] FINALIZE 有 72 字安装 SOP、knowledge-steward L0 | 首请求未知；不得推断全 run 未加载 |
| LE | [1] 有 63 字安装 SOP、writing-polish L0 | 可见请求无完整 L1 块或 load_skill 结果 |
| PW | [2] 有 73 字安装 SOP、writing-polish L0 | 同上 |
| PM | [3..4] 有 99 字安装 SOP，无 L0 | 同上；不能按已安装 writing-polish 推定实际收到 |
| RA | [5..6] 有 71 字安装 SOP、knowledge-steward L0；未见 writing-polish L0 | 同上；repair 不构成方法加载 |
| VD | [7] 有完整 566 字安装 SOP、visual-brief-prompt L0 | 同上；完整专家 SOP 不等于完整 Skill L1 |

新补上下文指纹（UTF-8 SHA256；chars=JS UTF-16 length；块不含外层包装）：

- RA [5..6].messages[5]：3676 / `bbc06192d7c256322baf2fa4cca5d719627d8cc973fd7352e79a00d4720c3501`；SOP 71 / `7118086222dbfb0fc9c9bc77721017172f7c45c7ddc9c5e6f2e767340e7b911a`；L0 336 / `6a8c1ad3263335fa5664ffb845725856ca9fa320c22d84cac96f0c75493102dc`。
- VD [7].messages[5]：4847 / `73e9e6d13b4114a557091133f1c28fda7da936ef7e5127e81bf3d1dfbf5f820b`；SOP 566 / `2785f2facb77c066fa815a7d6895601d8f1e09e7f889b5ece4aafa40ceb7c7fe`；L0 330 / `c86724513ddbbf2a5992f161d16c22b65f3be56f03a2b1e0eff869b1c308b663`。SOP 与冻结 installed EXPERT 明文一致。
- KC 诊断 [8..9].messages[7]：3915 / `1a76a1d16cece5511e9d4a339d8b83dc21f5b82dd8998a001c28fc2f3531f974`；SOP/L0 与基线捕获块同值；此前用户全文与平台拒绝保留在 messages[5..6]。

六个基线的可见请求中，5/6 可见 L0（含 KC 的仅 FINALIZE），不是 5/6 L1。最终同 run L1 判定明确收束为：**LE/PW/PM/RA/VD = N（完整已捕获请求确认未含 L1 正文），KC = U（首请求漏捕，不能否定全 run）**。在可判定的五个基线中是 0/5 有 L1 正文，另一个未知；不是 0/6 全覆盖。10 条全部可见消息均无完整 Skill L1 官方块或 tool-role 加载结果；缺 contextAudit manifest/loadSkillL1 receipt 不妨碍对完整实际请求作这个正文判断，但不能额外声称内部未调用装载函数或报告不存在的 L1 chars/truncated 回执。真实 requiredSkills=[] 也不能替代未导出的 payload.skillRefs。

全部请求 model=qwen3.8-flash、max_tokens=[redacted]，不能核实 cap。初次 RA 与 KC 诊断展示公共五工具加 search_knowledge/grep_files/write_file，VD 展示公共五工具加 write_file/mkdir/create_file，tool_choice=auto；FINALIZE [0,4,6,9] 无 tools。未见 tool-role 结果；PM/VD executionEvidence.toolCalls=[]，RA 未形成 executionEvidence，故后者不填“已验证零调用”。用户禁止操作与工具 schema 可见仍是不同轴，不推断权限绕过。

基线状态分母固定六：LE/PW/VD review 三个，KC/PM needs_input 两个，RA failed 一个；这是运行状态，不是专业成绩。PM [4] 明示长度恢复；RA [6] 则是真实 grounding repair（不是按末次失败文案猜初次也 length）。RA 末次归档说模型未返回完整答复，但 wire 无响应 finish_reason，不能凭统计认证具体 token cap。

### 预门禁可确证结果与根因边界

**VD N01：** observer.rows[0] 的 task/run 与上述 VD 完全一致，10:36:22.338Z 检查 4765 字候选，SHA256 `f05fb3d3952aff6a86b402b75e95fc3fb9498afeb00cb36073c951159a988667`，与 session 正文及 executionEvidence diagnostics 相同。结果 passed=true、claims/fieldChecks/violations=[]、toolCallCount=0、hasSupportingEvidence=false；providedMaterials 仅 41 字 user-confirmation。只证明此有限检测器未抽出需拒绝字段，不证明视觉方案专业性、全部事实有来源或有真实图像。

**KC D01 诊断 retry：** 同 task-mtpnlv8k-go6pp，新 run `expert_task-mtpnlv8k-go6pp_mtpohltc`。observer.rows[1..2] 于 10:38:32.234Z / 10:38:48.481Z 检查的全文严格相同：3863 字，SHA256 `1e6fbf5f94803714bcb17642e76a8725b532db17dc9b8ed034c8bc4237e4801a`；[9].messages[9] repair packet 候选也逐字相同。两次都 passed=false，仅日期 unresolved：label=日期、prefix=生效、value=2026-09-01、text=生效日期：2026-09-01，ungrounded_external_fact。不能说修复产生了不同候选。

该日期确在用户 goal 的 C 材料中：`C：正式批准的《差旅餐费报销 v2》，2026-09-01起生效，单日上限800元`；已断言完整 goal 出现在诊断请求当前上下文中。但核验 input.providedMaterials.items 只有 user-confirmation，无 C 内容，tool/evidence ledger 皆空。两层差异可分开复现：

1. **输入覆盖差异。** 当前 [expert-task-runtime.ts:545](D:/aispace/knowme/src/lib/expert-task-runtime.ts:545) 只将 task.brief.materials 传给快照；[provided-materials.ts:42](D:/aispace/knowme/src/lib/provided-materials.ts:42) 有意不从混合 prompt/history 取证。[GROUND:92](D:/aispace/knowme/src/lib/agent-run-executor/phases-ground-persist.ts:92) 验当前 task/run 快照，[ledger:319](D:/aispace/knowme/src/lib/agent-grounding-ledger.ts:319) 收集该材料与合格台账。模型看到 goal 与核验器拿到事实来源并非同一输入集；这里是源头装配覆盖，不是 hash 或当前 run 绑定失效。
2. **有限字段语法差异。** [state:12](D:/aispace/knowme/src/lib/agent-grounding-state.ts:12) 匹配“日期：”；[source-check:28](D:/aispace/knowme/src/lib/agent-claim-source-check.ts:28) 对来源/答复抽字段，再于 [80–81](D:/aispace/knowme/src/lib/agent-claim-source-check.ts:80) 要求相同 label 与完整 value。原句“2026-09-01起生效”没有该字段语法，不会产生对应 source field；unresolved 是未匹配，不是证明日期虚构。

实际执行的纯内存对照（`node -r ./scripts/register-ts.js`，未写测试或修改证据）：固定候选单句“生效日期：2026-09-01”，来源用实际 confirmation → unresolved；换成保存的完整原 goal → 仍 unresolved（原 goal 的 labelledClaims=[]）；来源正控制“生效日期：2026-09-01” → source_excerpt。正控制只是语法隔离实验，**不是修改真实材料后放行，更不是建议改题迎合 gate**。另外用当前 verifyClaims 对 observer 三份真实 input 离线复算，结果与保存 result 全字段 deepEqual 3/3，快照校验亦通过；仅说明当前这些路径与实录一致，不认证 QA 全部已加载模块等于磁盘。

**不得外推到 KC 原 N01。** 原 run 是 `expert_task-mtpnlv8k-go6pp_mtpnlvl8`，诊断记录为责任人 / 1723 字 / hash `41d1f29db9b21f6aeb0253e8ab1f12953dad6ed87dec377dfb703c2685a76c9b`，仍没有原预门禁正文。D01 的日期正文不能证明原责任人候选是什么、是否误拒或是否专业正确。

**另一个已可定位的边界来自 RA，不借 KC 推断：** [6].messages[7] repair packet 自带正确 RA task/run、3978 字原候选 hash `75648440bda5391d31205ce5ed140f0428caa3d61c63a49d6d99096d8ce55746`。其中原句以 `**一句话交付给产品负责人：** 现有证据支持…` 开头，packet 却把收件对象标题中的“负责人”抽成事实 label、把后面的分析建议抽成 value，列为 ungrounded_external_fact。这是有限字段检测与话语角色的可见冲突，不是责任人任命事实。这里有真实 repair 输入，**没有 RA 的透明 verifier 返回实录**（观察器安装在 RA 开始之后），不能冒充 observer.rows 中的结果或据此给 RA 正文评分。

最小通用后续边界：把当前用户明确提供的材料与目标文本以可追溯、当前 task/run 绑定的输入来源接线，保持与 SOP、历史 assistant 文本、执行凭据隔离；同时解决有限字段写法/语义角色的匹配边界，否则“加入 goal”并不充分。不得因同一个日期字符串出现就给错文档、错角色、错生效范围匹配，不靠专家 ID 或堆“日期/负责人”豁免。任何扩展仍须保留 requiredTools/read evidence/完成声明与全局引用身份核验；已给材料只能支持材料内陈述，不能证明执行过操作。修复前至少保留自然生效句正例、不同文档同日期反例、真实负责人字段/收件标题对照、跨 run 旧材料拒绝与失败工具不放行。本轮只定位，不实施或扩大为通用语义认证。

### 本次新增证据与源码指纹

全部路径根为 `D:/aispace/knowme/openspec/changes/production-qualify-all-experts/evidence/`，UTF-8 文件 SHA256：

| 文件 | SHA256 |
|---|---|
| rqa27-all-wire.json | ca397d1d1cd1469d61bfd13b0ef44aea8ee57143a31f33fdeea33587b39193a4 |
| rqa27-verification-observed.json | 5124696955deff63b8437f314212f1844ed2ac642ff6e2d4280360c7e3857060 |
| rqa27-r27-pm-n01-actual.json | 1241d0a84e7f0198f76b19711cbdc45151caa7d9759a7183946b1966606231b7 |
| rqa27-r27-ra-n01-actual.json | 3655e3293fba3ec7fc469d00d4094ecf2385aa29fd3180cdff915d2c4759c888 |
| rqa27-r27-vd-n01-actual.json | e234f331833aac8b3277804066a3fbcad5b03ea58127a75849fb4a234cbb857a |

当前只读源码 hash：expert-task-runtime `505049371302d1e99105bda6481dfc44b828e7668c8aa104b70027256c35e3d1`；provided-materials `a7c9842b41387a3e47eb2e2da5f4af46806a73cdb62246ea96328ddc006c14f7`；agent-claim-source-check `b19b2f9da8bf6405fab8761e0ee1f3c47748763fd92676a5bfa1645f8fef9072`；agent-grounding-ledger `04043928c418cf186adb07e0efa9f5de646cfff9b204a314cb51ee49a01d91c9`；phases-ground-persist `b90d266470ce60e8d5654721f7dcd57b245297efa0d8149694c160da47059c17`。仅追加本报告，保留旧观察、分母和不确定；不改源码、包、测试、评分或冻结题面。

### F01 单列收尾：用户反馈 revision，不增加六题基线分母

只读 `rqa27-vd-f01-revision-actual.json` 与 `rqa27-vd-f01-observed.json`。同 VD task/session，新 run `expert_task-mtpoekri-9ket3_mtpotlnl`，用户 10:47:23.923Z changes_requested 后进入 revision，最终 review。产物 version=2，previousVersionId 指向 N01 原产物；不是升级包或 Skill A/B。主线告知观察器已恢复、PID40792；这里未访问该进程，仅依据落盘观察，其 observation 也记载 restored after terminal。

- **L1=N。** 两个完整请求（10:47:26.084Z、10:47:52.553Z）均只有同一 visual-brief-prompt L0 与既有 566 字专家 SOP，没有 L1 正文或 tool-role 装载结果。messages[7] 均为 9980 字，SHA256 `95fa117ccb3ecfef74d914cb963fc4b79cf3f839463d41cfed228ecf16e55e0a`；以本 run session 用户全文 7423 字精确结尾（hash `f94d3b9138b64daa0981ff4f446aa01402e03274ad6389378b808b77e713cec3`），含完整 215 字反馈（hash `7d9375b2773470e3faec05a571a5af6089db4762a1106370122f9138816bfa4b`）。历史 assistant 消息压为 4007 字，但当前 revision prompt 内含完整 4765 字原产物，不能据前者断言修订时原文丢失。第二请求明示长度恢复；max_tokens 仍脱敏，未猜预算。
- **权限与执行分轴。** expert snapshot 仍 2.2.0、permissions={}，primary requiredTools/requiredSkills/evidence/artifacts/conditions 空、minArtifacts=0，session.executionPolicy=tools-allowed。用户反馈明确仅授权对话修订，不授权工具、生成、文件、外部交接或付费，全文已进当前请求。但首请求仍暴露公共五工具加 write_file/mkdir/export_artifact_pdf，tool_choice=auto；因此禁止操作没有表现为 schema 硬禁。这里只确认暴露，不说能绕过下游审批。实际 F01 toolMessages=[]、ToolLedger.calls=[]、Evidence.entries=[]、executionEvidence.toolCalls=[]；本次无执行调用回执，不是付费 revision 或真实图像修改实证。
- **候选/提交绑定。** observer 唯一预门禁候选与同 run assistant 原文精确一致，4773 字，SHA256 `e922dec4f64dfcd30dbb61c9dc7e8ce20a037e4934141ff2333e877ee255e80e`，亦与持久化 verificationDiagnostics 相同；passed=true、claims/fieldChecks=[]，来源仍只有 confirmation。有限 gate 通过不等于尺寸/重试策略已专业合格，本报告不评分。

新增文件 SHA256：`rqa27-vd-f01-revision-actual.json` = `574d7153908b2f8d08123acd7dbfe9a1f2dccd4aa12fc4340eef0dd0fcd764ac`；`rqa27-vd-f01-observed.json` = `fbf57653c3dd61ce6ea99b94d39a7fdf21d6d51dc69a49e3b2838843f6bac0dd`。最终范围：六题基线 **5 个 N、1 个 U**；KC D01 与 VD F01 仅是另列诊断/反馈 run。已完成本轮装配审计，不为已完整捕获的五例继续悬置结论，也不以工程装配审计代替专业评分或正式验收。
