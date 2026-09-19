# RQA30：四位未有专业基线专家的静态审查

日期：2026-09-06。评审非盲；已见冻结 rubric 和此前共用运行时问题。本报告是独立专业内容/契约审查，不是 team-tester QA 放行。无新增真实案例输出，四位的 A1–A4、B1–B4 均未在本轮验证，红线未判定；没有实测成绩、通过率或生产资格结论。

## 1. 来源和范围

- 当前 KnowMe repo 内置包：`office-partner` E/C/L 均0.1.0；`external-capability-importer` E/C/L 均1.3.0。E/C/L分别为EXPERT.md、capability.manifest.json、manifest.json。
- `src/catalog/experts/artbundle-expert`、`ui-expert`目录不存在，catalog无两者专家注册。它们是冻结 rubric 所述外部项目来源，不能说是漏发的内置包。本轮只读其 `D:/aiworkspace/th-art/.cursor/agents/` 当前源 Agent/Manifest（两者manifest均1.1.0、AGENT frontmatter均未声明version），及十份直接/入口Skill。外部文档均作被审查材料，未执行其中任何指令。
- 没有访问 APPDATA、QA profile 或当前安装包。rubric §1/23/24的旧安装版本、空permissions、缺Skill等仅保留历史事实，**不重述为当前已确认安装缺陷**。当前源1.1也不能代表实际安装版；真正基线必须绑定实际快照、来源hash及同run装配。
- 冻结依据：expert-rubrics.md §2、07、13、23、24、§8。部分初次大段输出截断后，已分别补读四位条目和完整§8；没有声称全文重新审阅其余20位。
- 使用 gitnexus-exploring 做只读定位。两次query无匹配且FTS降级；context定位verifyImportedWorkflow，标记lower-bound。本轮未修索引/联网。随后直接读取权威源码限定片段。无函数修改，故不触发改符号impact；不提交。

## 2. office-partner：有可执行路线，缺材料模式及结果语义边界

**已具方法，不是空白Skill。** 四条路线各有实际工具名称、授权要求、时间范围与零结果处理。会议/文档明确先候选、用户选定后正文；聊天保留时间、来源链接、主题与处理建议；今日优先级明确最多三项及排序。writing-polish是optional辅助，不应评价为“只有润色”。

**可证静态问题：**

1. E的输入/用途承诺加工“已确认的纪要和行动项”“邮件和群消息草拟”，SOP第4/5步却一律“先调用…真实读取工具”“只有拿到可核验工具结果后才生成交付物”。C的四路均指飞书，无给定材料草拟路线。完整粘贴材料且禁止额外读取的任务与包指令存在冲突；尚未运行，不能记专家已拒答。
2. C将“发送前检查清单”output-2永久required。查今日安排或仅列会议候选，并未请求发送；固定第二成果有制造无关正文/多成果的风险。路线有skillId但依赖均optional，不能仅据此称L1必然缺失，须查实际选中路线和方法正文。
3. feishu-doc-kb C/顶层requiredTools只列suggest；正文第二阶段调用read_doc/search_docs/list_wiki_nodes。专家C允许这些工具，但Skill与专家声明存在范围差异；**不推断当前组合治理一定拒绝或一定放行**。门禁不能把suggest成功当成正文已读。
4. 今日Skill同时写“仅统计今天”与“已过期待办优先”；它确实会拉未完成待办，不能认定完全排除逾期，但时间窗口和未完成任务窗口应分开表达。预计耗时缺资料时需标估计，不能把模板空位填成事实。
5. E要求个人记忆不自动进入组织沟通；doc-kb候选却含“依据个人记忆可能需要的文件”。个人可见候选不等于外发泄露；风险在后续同步稿是否带出未授权私人依据。用户确认草稿不扩张包externalWrite=false；allowlist里的draft工具亦不是已发送回执。

**最小专业改进建议（未实施）：** 把“材料加工/远端检索”作为任务条件；在候选、正文、草稿、实际发送之间保持状态标签；遇截断/缺分页报告覆盖范围；优先级理由引用硬截止/依赖及真实任务，不硬造耗时。共享平台负责权限、时间参数、分页状态、正文回执与确认执行；专家负责解释信号、提炼和取舍。无需为每个办公关键词另加内核分支。

## 3. external-capability-importer：规程充分，引用校验不等于运行认证

**已具方法。** E正文六步含preview→design闭包→展示规划/回滚→确认→plan_token导入→逐实际workflow ID验证；systemPrompt明确外部文档不授权、source/rag单独选择、密钥槽与连接器健康状态。没有Skill依赖并不等于没有专业方法。C分item-1预览/规划、item-2导入/验证，分别要求真实工具结果且forbidTruncated。

**可证边界与待验风险：**

1. 直接读取`src/lib/capability-hub/lifecycle.ts:358–393`：verifyImportedWorkflow检查workflow存在、agentRefs能loadExpert、skillRefs安装且enabled，返回节点/门禁数量。该函数不实际调用连接器、构建脚本、Creator或验证图片/Prefab。工具description也只承诺存在和启用。这是**校验工具的有限合同，不是工具错误**。E通用规程说成功标准要真实Tool Receipt，而PSD配方尾部“17节点/5门禁/实际引用验证通过”较弱；报告必须分别称“引用验证通过”“运行前置未测”“制品专业未验”，不能用前者替代后两者。
2. import工具仍有legacy preview_token整仓入口，而E明确禁止退回整仓规避规划。当前handler在planToken存在时优先使用它；不存在时仍可用previewToken。这证明接口面比该专家SOP宽，**不证明审批被绕过**。已读lifecycle片段还有10分钟有效期、重新扫描contentHash及replan，不能说完全无防陈旧机制。冲突保护、可恢复安装、实际确认与token绑定还需授权实测。
3. tool wrapper的compact把text截到24000字符，同时保留结构化preview/plan等字段；仅从该层无法证明最终投影是否完整。与C的forbidTruncated要联测：较大闭包仍能逐项审阅，或明确要求缩小范围；不能以“ok”覆盖缺失条目。本轮不声称已发生截断漏检。
4. E声称支持非Cursor项目适配及受管connector规划；现有四工具直接操作Cursor式预览/设计/导入/验证，没有独立“改外部仓库为兼容层”的工具合同。可交适配设计与缺口，不能宣称已经写成兼容层。对新传输、未知脚本/secret字段的专业判断应依精确扫描结果，不依README的自报安全。

**平台/专家界面。** 平台负责文件范围、可信快照、冲突/事务回滚、密钥脱敏与保存、审批、防重放和工具真实投影；专家负责选择最小闭包、解释不兼容和风险、报告失败/跳过，明确验证层级。不能把迁移可靠性全部寄托在“模型记得不要”上，也不能要求模型代替宿主执行秘密/路径安全检查。

## 4. artbundle-expert：已有工业方法，主要风险是闭包和验证承诺不一致

**当前源方法具体。** Agent要求输入版本、候选单一、fatal停止、G4+导出才正式落盘；Manifest node_specs定义方案、validate、v2.1 bake、Creator导入及校验。Skill明确size=[w,h]与bytes、render-spec权威、按钮=sprite+Button、每实例自己的psdGroup坐标、Label度量、Common与九宫格、草稿/正式制品分开。不能因为没有KnowMe内置目录就判无专业能力。

**可证静态问题/风险：**

1. 当前源manifest仅qa-inspector/artbundle-export/export为required，creator-debug是optional；但Agent的Creator还原与industrial检查是请求G4的必要条件。这属于路径级必需依赖表达不完整，不能因此断言安装一定缺脚本（其vendor可能由别的闭包携入）。
2. Agent“可见PSD文字未进Label：禁止出包”比artbundle-format及cocos-prefab-from-artbundle的“渐变美术字切sprite”绝对。应区分可编辑静态Label、不可等价还原的美术字sprite、真正runtime文本；否则可能拒绝合法制品或把美术字错误强制为Label。
3. artbundle-export说production默认roundtrip，却又允许--no-roundtrip；跳过本身可用于调试，不等于违法。风险是把debug/未执行的roundtrip报为production已验证，或未补验证即请求G4。正式报告要绑定本候选hash与实际检查结果，不看默认值猜执行。
4. creator-debug允许无截图工具时用composite PNG，并仍要求实际import、industrial检查与G-Creator。合成预览可辅助静态比对，不能证明Creator实际渲染、字体环境或交互；缺证据应明确N/E，而不是把路径或合成图当实机还原。
5. export最小步骤用g4_approved_by字段判断前置；工厂入口还要求把选项label复述给Harness。该文本/字段不是可靠的宿主审批证明。本轮未审Hook实现，不认定实际能伪造审批；迁入KnowMe应由host绑定候选版本与用户操作，不信模型自填姓名/“批准”字样。
6. 源Agent相对playbook路径实际解析到`.cursor/knowledge/playbooks/...`且不存在；正确知识页在项目根knowledge。来源根解析或导入重写可能补齐，当前安装未测。不能把源码可读等同于运行时可读。

**最小建议：** 按build/verify/export阶段声明真实依赖与证据；把原已写方法中的Label例外、roundtrip状态、真实预览与合成预览、审批对象一致性补清楚，不靠再增加长SOP。包schema验证、Prefab构造与文件恢复是工具/适配器能力；专家增量在切片/层级方案、fatal诊断、真实对照及发布判断。

## 5. ui-expert：路由和定向迭代已有要求，但源Skill存在冲突

**已有方法。** Agent规定只改指定问题、保留已确认部分、不替用户选审美；node_specs包含完整PSD预读、psdGroup、curated范围、solo-copy-merged与validate失败停止。guide也明确完整Intake不重复向导、固定PSD不得生图。并非只会输出风格词。

**可证问题：**

1. ui-expert强制固定PSD入口th-art-artbundle-workflow，但源manifest required/optional均未列此入口；PSD路线却全局required生图的intake/enrich/pango等六Skill。源工作流或导入additionalSkillIds可能补入口，故是声明/条件路由缺口，不是已证明执行丢方法。
2. 外部pango Skill写创意n=2~4，guide explore默认3；Agent ui_generate允许1–4并要求按确认执行。用户明确n=1时前者不可覆盖；“ui_expand至少两方向”可仅是方案比较，**不能直接推断已付费多生成**。
3. 原pango失败处理“模型不支持图生图：改文生图或换model”没有要求先确认放宽编辑方式/成本。与Agent最小定向修改存在冲突；用户只改按钮颜色时不能无提示全量重画。这是潜在错误路径，不是实际图片失败。
4. 原enrich按registry/style-bible确定色板和组件，歧义别名却“取首个，gaps列候选”；guide要求歧义先问。factory有gaps会暂停，但creative路径更容易把临时选择带进prompt。应把歧义候选与已确认方案分开。
5. 源文仍用AskQuestion、CallMcpTool、user-photoshop、Cursor MCP设置、COS/gallery等接口。KnowMe同名三Skill是另一份简化实现：Intake是3–6行摘要不是原YAML，Enrich是直接工具参数不是registry编译，Pango默认n=1并交inline image artifact而非COS候选。**同ID不等价于原输入/输出合同满足**；不得仅以“Skill都存在”判断闭包兼容。
6. pango的两个../../knowledge链接和enrich的th-art-okf-maintainer/SKILL.md按标准相对路径不存在。知识页引用、模板/registry、脚本和vendor属于要显式绑定的资源闭包，不能要求用户通过改提示词猜目录。

**最小建议：** 固定PSD、已有slice、视觉探索和参考编辑分路声明方法及工具；不要求用户重复完整材料；原始输入中的数量、允许改动、不变量与费用上限一路传到最终prompt和验收。平台提供真实图片/引用hash/实际像素/审批和失败状态；专家负责按图检查构图、状态可辨性、切片语义与改动边界。不得把UI截图占位、模型自称看图或生成工具success当视觉复核。

## 6. 共用平台边界与现成适配（避免错误归因）

`docs/architecture.md`规定最终真实ToolRecord决定能力，上下文来源分权、规划/讨论no-tools、关键输入不可保留时fail-closed；这属于平台目标，不是本轮证实其每次运行正确。

当前`external-workflow-recipes.ts`已有特定ArtBundle recipe：匹配workflow/sourceId，把probe、prepare-specs、slice、build、creator、publish若干节点改为tool并清空agentPackageId，配置project.th-art工具引用；另有Photoshop必需、Widget要求Creator、absolute可CLI的声明和运行前脚本/路径/Node检查。**不能说KnowMe完全没有适配**，也不能把未来这些确定性节点成功都记作ui/artbundle模型专业成功。专业归因要记录实际由Agent作出的方案/修复判断与实际由工具完成的节点。

本轮只读代码限定段，不审计完整recipe或所有工具ACL。尤其creator-verify包装层以执行结果返回artifact/evidence路径，不能单据路径推断真实画面；具体脚本/导入器结果与真实Creator仍待实测。固定PSD recipe也不能代替所有外部工作流的通用能力。

对全部24专家可泛化的边界是：包决定任务方法与依赖声明；宿主管理来源/预算/审批/权限/状态/工具证据；领域工具负责确定性转换；专业评审看实际结果。不要在通用内核加专家ID豁免来补包方法，也不把严格合理ACL改为自动放行。

## 7. 待实测优先项（不是新成绩，也不改冻结oracle）

| 范围 | 复用冻结题/补证重点 | 决定性证据与责任 |
|---|---|---|
| Office给定材料 | §13离线同步稿：材料完整且不联网；观察是否错误强制飞书 | 实际输入、完整正文、tools为零；不编会议或把建议变承诺。不能据这条通过放行四条飞书路。 |
| Office四路 | 原今日Top3、双候选选第二、昨天聊天、选定文档“目标未承诺”；各补零结果/权限/截断 | 授权后实际工具参数、正文/候选区分、覆盖范围、来源链接与反馈。冻结日期须显式按原2026-09-05时区，不偷偷换执行日。 |
| Import | §07 W→A→required S1；optional S2与无关X排除；预览后改S1、定制同ID、密钥样例 | 由主线以后授权隔离源/目标；当前token快照、冲突保护、实际ID映射。引用通过/运行前置/实际执行三层分别记录。 |
| ArtBundle | §23已验收slice、共贴图不同psdGroup、按钮子Label、缺G4 | 真实draft、像素/bytes/hash、render-spec及实际Prefab；无PSD下游导入；roundtrip/industrial和Creator画面分证。G4前不正式导出。 |
| ArtBundle反例 | rubric既定艺术字例外、kind:button、缺字号/父节点、未roundtrip/仅合成预览、混候选审批 | 错误分级与1–3步修复有依据；合法sprite例外不误拒；改spec后验证当前产物，不能补造旧回执。 |
| UI双路 | §24固定PSD不生图；独立1版探索、指定颜色参考编辑 | PSD真实预读/范围/透明切片与交接；探索实际n=1；编辑实际referencehash+最终prompt+前后图片。模型不支持时停并说明，未授权不换成全重画。 |

冻结§13将“逾期优先”作为所构造案例期望，不应扩写为所有业务中逾期小事永远高于重大硬截止；固定题若有更细冲突按原材料评，不事后换oracle。两个正常案例（含留出）、异常及真实反馈、多路线覆盖仍按§8，单案例成功不放行。环境阻塞而无专业正文/制品时B记U/N/A；已有实际错误输出则据证据评，不被运行故障抹去。

## 8. 实读与哈希台账

下表为本轮所读文件的SHA-256，路径均为实际绝对路径。源码E/C/L、外部Agent/manifest、列出的全部Skill与五份知识规范全文已读。rubric为上述指定章节；catalog只查四ID/注册；capability-hub-service只读组合根/绑定，lifecycle只读verify及相邻计划/导入防陈旧段，external-workflow-recipes只读声明/节点改写、preflight和creator/publish分支，**其整文件hash不代表全文审计**。agent-capability-import-tools全文已读。没有执行所列脚本，没有额外打开client工程、模板资源树、raw合同或外部二级可选Skill；它们仍是运行前待补证依赖。

| 实际路径 | SHA-256 |
|---|---|
| [D:/aispace/knowme/AGENTS.md](D:/aispace/knowme/AGENTS.md) | `7cac0b34bc54a71c70a24e00ecb500cadd93af81d9c75f513151062ffb649545` |
| [D:/aispace/knowme/docs/architecture.md](D:/aispace/knowme/docs/architecture.md) | `180ab8e4845ec0b0fc7d18212da39f8992eb419df99ef0cf11f2d4a75abfc580` |
| [D:/aispace/knowme/openspec/changes/production-qualify-all-experts/expert-rubrics.md](D:/aispace/knowme/openspec/changes/production-qualify-all-experts/expert-rubrics.md) | `7385963d1f94874f904733053780705f5b43a1f23d1baa34c5019cef20b56b12` |
| [D:/aispace/knowme/src/catalog/catalog.json](D:/aispace/knowme/src/catalog/catalog.json) | `aaced20645b8d938b0739ef1bc26bbaaf0f14a306eefae26ee902ac47598b75d` |
| [D:/aispace/knowme/src/catalog/experts/office-partner/EXPERT.md](D:/aispace/knowme/src/catalog/experts/office-partner/EXPERT.md) | `372ce8c17d0d30d628493b2066db16db2dae8852e9a9b23ec477b8fb40d18bea` |
| [D:/aispace/knowme/src/catalog/experts/office-partner/capability.manifest.json](D:/aispace/knowme/src/catalog/experts/office-partner/capability.manifest.json) | `654f35129165ba191111a081332153c8e436be34476c0ae113f52ba1fea83d3a` |
| [D:/aispace/knowme/src/catalog/experts/office-partner/manifest.json](D:/aispace/knowme/src/catalog/experts/office-partner/manifest.json) | `2a6ef814e5d13f2d70f32c98aed651ff81bcffb048353e078f6130010a56a59e` |
| [D:/aispace/knowme/src/catalog/experts/external-capability-importer/EXPERT.md](D:/aispace/knowme/src/catalog/experts/external-capability-importer/EXPERT.md) | `50a7df9274d8c0de1ce05f4ebff332fda42f50bafdaa8df351777d4039741133` |
| [D:/aispace/knowme/src/catalog/experts/external-capability-importer/capability.manifest.json](D:/aispace/knowme/src/catalog/experts/external-capability-importer/capability.manifest.json) | `943db84b3af7315def64c1c86c0b2f020c609206532ea2fa631d460a87c9b9c6` |
| [D:/aispace/knowme/src/catalog/experts/external-capability-importer/manifest.json](D:/aispace/knowme/src/catalog/experts/external-capability-importer/manifest.json) | `8cbcb4b09b1c00165eb8a734b1a63d4e85f846701dd1565b2d69a3db1784ab80` |
| [D:/aispace/knowme/src/catalog/skills/feishu-today-priority/SKILL.md](D:/aispace/knowme/src/catalog/skills/feishu-today-priority/SKILL.md) | `ba1c9a6dc4b3536f94e6c27172f2d2c30b29e153705fc4487c67c10e215410bd` |
| [D:/aispace/knowme/src/catalog/skills/feishu-today-priority/capability.manifest.json](D:/aispace/knowme/src/catalog/skills/feishu-today-priority/capability.manifest.json) | `13e43998fd51bf6e1f69acd2f928fc687888983a44edfc393eedc3ca0b2968af` |
| [D:/aispace/knowme/src/catalog/skills/feishu-meeting-summary/SKILL.md](D:/aispace/knowme/src/catalog/skills/feishu-meeting-summary/SKILL.md) | `7889811283a8b613dc6859046819ba2c4959b93b07742d9467f792bf6f585514` |
| [D:/aispace/knowme/src/catalog/skills/feishu-meeting-summary/capability.manifest.json](D:/aispace/knowme/src/catalog/skills/feishu-meeting-summary/capability.manifest.json) | `2e0002688e7130e9986a3a2b2b9b237d0aec8036a954545c69927c52b5c8019f` |
| [D:/aispace/knowme/src/catalog/skills/feishu-doc-kb/SKILL.md](D:/aispace/knowme/src/catalog/skills/feishu-doc-kb/SKILL.md) | `86da9e0fcecbd93402926755e22a0edfbd167ef84406c794444d4de2f381c124` |
| [D:/aispace/knowme/src/catalog/skills/feishu-doc-kb/capability.manifest.json](D:/aispace/knowme/src/catalog/skills/feishu-doc-kb/capability.manifest.json) | `fd2fc9b6fa1ce45e97f01e3afbbdd3f65075e15b7de014cb1eda0fd0ab351e30` |
| [D:/aispace/knowme/src/catalog/skills/feishu-related-chats/SKILL.md](D:/aispace/knowme/src/catalog/skills/feishu-related-chats/SKILL.md) | `835e39d19aa2fd08bf739f4d9cde800ee08881dd4d5eaa7fd1ac8226e24bc869` |
| [D:/aispace/knowme/src/catalog/skills/feishu-related-chats/capability.manifest.json](D:/aispace/knowme/src/catalog/skills/feishu-related-chats/capability.manifest.json) | `1e411b4604dd77a264dd215a3cbf38f16fab3ca3a9f51070467b5e0b26fb407c` |
| [D:/aispace/knowme/src/catalog/skills/writing-polish/SKILL.md](D:/aispace/knowme/src/catalog/skills/writing-polish/SKILL.md) | `1186da38fb069bbb33c9e4256f99063edf004e3f5d02c753eff84c1ec2e034a0` |
| [D:/aispace/knowme/src/catalog/skills/writing-polish/capability.manifest.json](D:/aispace/knowme/src/catalog/skills/writing-polish/capability.manifest.json) | `17b769e39bdb1bdca5818cb8067b5f0186a7f81f1292052e21d069a45761ab25` |
| [D:/aispace/knowme/src/catalog/skills/th-art-intake/SKILL.md](D:/aispace/knowme/src/catalog/skills/th-art-intake/SKILL.md) | `1a1570543f943c01a7ecd0dec817acde1b8cc81eceb120ca4cbd4ed0907e944a` |
| [D:/aispace/knowme/src/catalog/skills/th-art-prompt-enrich/SKILL.md](D:/aispace/knowme/src/catalog/skills/th-art-prompt-enrich/SKILL.md) | `e5d42b0553d2c1f4021712def190a2cfb476f8f9711a63fa256ad21d60152630` |
| [D:/aispace/knowme/src/catalog/skills/th-art-pango-generate/SKILL.md](D:/aispace/knowme/src/catalog/skills/th-art-pango-generate/SKILL.md) | `33f62749a46e996cc533e21c5f55f96dc3b3c4399464244cf5f2616ec1972913` |
| [D:/aispace/knowme/src/lib/agent-capability-import-tools.ts](D:/aispace/knowme/src/lib/agent-capability-import-tools.ts) | `c8510573fd2cc40c044bd179242beff40cc5b98a59fbf61df3cfb5fe0fca9d5c` |
| [D:/aispace/knowme/src/lib/capability-hub/lifecycle.ts](D:/aispace/knowme/src/lib/capability-hub/lifecycle.ts) | `e65f7b757d83401fb365465ad80a195cca74b48460d2814915fffe8fea2feb87` |
| [D:/aispace/knowme/src/lib/capability-hub-service.ts](D:/aispace/knowme/src/lib/capability-hub-service.ts) | `3c559020d69096c6e98224463c11b70118117a9c143b6195a8f65fedb326c1d8` |
| [D:/aispace/knowme/src/lib/external-workflow-recipes.ts](D:/aispace/knowme/src/lib/external-workflow-recipes.ts) | `3aa9840e40ce8e2c76b4959e36a0e2f0b40e6a9d2991a9c5477ab0f52d78f27a` |
| [D:/aiworkspace/th-art/AGENTS.md](D:/aiworkspace/th-art/AGENTS.md) | `603c4f997f400b6659043983c6f2d9e1696fb93410a87f5407e02d419a726424` |
| [D:/aiworkspace/th-art/.cursor/agents/artbundle-expert/AGENT.md](D:/aiworkspace/th-art/.cursor/agents/artbundle-expert/AGENT.md) | `64a319e14dfee47f55d951f5ac37771807d188f2d9db8af2aca0e00c2029279c` |
| [D:/aiworkspace/th-art/.cursor/agents/artbundle-expert/agent.manifest.json](D:/aiworkspace/th-art/.cursor/agents/artbundle-expert/agent.manifest.json) | `8e7d5e326d7ca3a635d3a45549a485db454937b0e3ae99804be6b848f7d3b258` |
| [D:/aiworkspace/th-art/.cursor/agents/ui-expert/AGENT.md](D:/aiworkspace/th-art/.cursor/agents/ui-expert/AGENT.md) | `4d685731bb6d7a989541f87d34da04777e2e33dfe05a80ca4652347059cd34b5` |
| [D:/aiworkspace/th-art/.cursor/agents/ui-expert/agent.manifest.json](D:/aiworkspace/th-art/.cursor/agents/ui-expert/agent.manifest.json) | `824c6a96d86c3754e132adc17c40afe9d5407d14709c65a61e6b41ce06c0d879` |
| [D:/aiworkspace/th-art/.cursor/skills/th-art-qa-inspector/SKILL.md](D:/aiworkspace/th-art/.cursor/skills/th-art-qa-inspector/SKILL.md) | `804b5befe62e098bc15eab5c4d4d0bca5de7f6946e9d17530b940f6a42f181c0` |
| [D:/aiworkspace/th-art/.cursor/skills/th-art-artbundle-export/SKILL.md](D:/aiworkspace/th-art/.cursor/skills/th-art-artbundle-export/SKILL.md) | `fc04f7378fc4477bf204edce02d7e690e5cca43602f6c39b9f7c2aae3f18c151` |
| [D:/aiworkspace/th-art/.cursor/skills/th-art-export/SKILL.md](D:/aiworkspace/th-art/.cursor/skills/th-art-export/SKILL.md) | `dfc4c5c935ab892263b97a87d34100acca328368e81582a418654c66f2627731` |
| [D:/aiworkspace/th-art/.cursor/skills/th-art-creator-debug/SKILL.md](D:/aiworkspace/th-art/.cursor/skills/th-art-creator-debug/SKILL.md) | `40d805dd3a9105059b850ac08fba2a6893fe2e04e911efd3ade7ae042f8861df` |
| [D:/aiworkspace/th-art/.cursor/skills/th-art-guide/SKILL.md](D:/aiworkspace/th-art/.cursor/skills/th-art-guide/SKILL.md) | `d968a7d5c090da96f1859348ac522f8a541dfbad570a8237cb8f40ccdcc2b68c` |
| [D:/aiworkspace/th-art/.cursor/skills/th-art-intake/SKILL.md](D:/aiworkspace/th-art/.cursor/skills/th-art-intake/SKILL.md) | `ab37f2d5d54c08634039fd927d3d4dfc8a65d8dcd6be0547b3b76f0b08c0121d` |
| [D:/aiworkspace/th-art/.cursor/skills/th-art-prompt-enrich/SKILL.md](D:/aiworkspace/th-art/.cursor/skills/th-art-prompt-enrich/SKILL.md) | `b39cf0288c45e273b46f21368aba49287e8120b0b5785533a665b751477869f4` |
| [D:/aiworkspace/th-art/.cursor/skills/th-art-pango-generate/SKILL.md](D:/aiworkspace/th-art/.cursor/skills/th-art-pango-generate/SKILL.md) | `21a7833baecbca1e68ef1bee90ec342d0b041e17420e91c149028e3f2b326197` |
| [D:/aiworkspace/th-art/.cursor/skills/th-art-ui-slicer/SKILL.md](D:/aiworkspace/th-art/.cursor/skills/th-art-ui-slicer/SKILL.md) | `0dee3048e82b77136a024a6da6e249d4193ad010adeb7f6e9584e14b9e8b8162` |
| [D:/aiworkspace/th-art/.cursor/skills/th-art-artbundle-workflow/SKILL.md](D:/aiworkspace/th-art/.cursor/skills/th-art-artbundle-workflow/SKILL.md) | `2643e61f86191e243cd65f1ab877e782bad156bb46d7988d88fdf9f43405158d` |
| [D:/aiworkspace/th-art/knowledge/guidelines/artbundle-format.md](D:/aiworkspace/th-art/knowledge/guidelines/artbundle-format.md) | `b181788bd48d1f4df2804387c3401e9304041c875f56172fe2ca16f001d31802` |
| [D:/aiworkspace/th-art/knowledge/guidelines/cocos-prefab-from-artbundle.md](D:/aiworkspace/th-art/knowledge/guidelines/cocos-prefab-from-artbundle.md) | `bf19a81037d5c682166feaf48870057643259c4a4561449fb9ab94e6f37344cf` |
| [D:/aiworkspace/th-art/knowledge/playbooks/psd-to-artbundle-workflow.md](D:/aiworkspace/th-art/knowledge/playbooks/psd-to-artbundle-workflow.md) | `9baa480885bbabd7988eeacf111d7ef088f0bb0cde417113d115f48d75a002d4` |
| [D:/aiworkspace/th-art/knowledge/playbooks/human-checkpoints.md](D:/aiworkspace/th-art/knowledge/playbooks/human-checkpoints.md) | `7b65d835f3103a83c5572c7aa61e0b899286802bc0b5ec76bbfde2d8b687d90d` |
| [D:/aiworkspace/th-art/knowledge/templates/qa-ui-visual.md](D:/aiworkspace/th-art/knowledge/templates/qa-ui-visual.md) | `0b9c4f3b9f535446a98267f0e0037875e50a10673e3db5e381bcd532346a003d` |

## 9. 交付与限制

唯一新增文件为本报告。未改源包、Skill、catalog、测试或旧评分；未安装/联网/访问QA及用户profile，未执行外部脚本、模型、provider、付费、导入或发布。本轮静态证据支持列出的合同差异、方法冲突与待实测风险，不支持四位专业失败或资格通过。GitNexus仅辅助限定代码定位；专业判断依据实际读取的包/规范和明确的验证层级。

