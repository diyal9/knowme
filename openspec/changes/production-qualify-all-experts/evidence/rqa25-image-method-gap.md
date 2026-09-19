# RQA25｜image-producer 方法缺口与最小改进建议

2026-09-06。只读方法审查；唯一新增本报告。无源码、Skill、catalog、外链、安装/profile修改，无模型/图片生成、UI操作或测试运行。使用skill-creator“从反馈泛化、精简方法、解释原因”的原则；本轮不进入改写或评测循环。评分者为RQA24标准作者，已知主线提示且曾看实图，非盲。本轮不改RQA24评分，不给未捕获视觉输入补分。

## 一、结论

**主缺口是受限修改的约束编译与交付复核，不是缺生成能力或缺参考链。** 实际旧SOP已要求“保留未被否定的条件”，用户也明确只改杯身、保留杯盖；v2最终prompt却主动增加“Same applies to the lid so the whole bottle reads as one matte black product”。这是已有原则在执行中失守。补一句“遵守要求”不足以提供方法；应将可改对象/属性与保留对象/属性分别列出，并逐句检查最终参数有没有扩大修改范围。

首选是**对齐自有专家包的版本与实际装配，并精炼其修订SOP**，不默认增加第四个Skill，更不覆盖同ID外部linked方法。源码3.3已有参考图、唯一修改指令、视觉复核、短交付和付费重试边界，不能将升级声明本身算作修好。后续若需要独立版本化、跨专家复用且可测的修订方法，再考虑独立命名的自有方法Skill；本轮证据尚不足以证明增加依赖比加强并验证现有SOP更有效。

## 二、实际 / 源码 / 外链三层来源

| 层 | 读到的事实 | 不可推出的结论 |
|---|---|---|
| RQA24实际task/session | task `task-mtphk5gg-jinbr`；snapshot agentVersion=3.2.0、agentHash=`dcf7730df6be94b0`；实际用户提示含旧7步SOP | 不能拿当前源码3.3的第8步当本次模型已收到 |
| 当前源码专家 | E/L=3.3.0，canonical C=3.2.0，catalog该entry=3.1.0；C声明image artifact、minArtifacts=1与artifact_present | 版本数字一致或更高本身不证明行为正确；本次不确定是哪一步历史升级造成不一致 |
| 实际任务交付契约投影 | 三个requiredSkills、generate_image及tool_success；requiredArtifacts=[]、minArtifacts=0，无artifact_present条件 | 仅是导出的实际委托契约形状，不等于读过当时安装C全文，也不等于平台没其他产物校验 |
| linked来源 | 主线RQA24 integration报告确认三个方法来自外部linked repository；本轮只读其现行原文件 | 未重读QA注册表或profile；没有两轮L1正文/hash，不能证明现在外链字节恰是当时加载字节 |
| 源码同名三Skill | 均version1.0.0、C schema2；本地短Intake/Prompt/执行规则 | 同ID、同三项计数不表示等价，也不允许用它们静默覆盖外链方法 |

主线报告另记实际安装entry=3.1.0、E/L/C=3.2.0：这是主线安装审计结论；本评审直接独立核对的是运行snapshot/SOP与当前源码。主线“linked”结论和本轮现行外链文件内容分别标明，未混成实测L1装配证明。

**关键源文件SHA256（现读）：**

| 文件 | SHA256 |
|---|---|
| S/experts/image-producer/EXPERT.md | 6afc8cdf3f12df78fa80822f980d5f7dc87604fe692f7f9ce77fbf8da7e69dae |
| S/experts/image-producer/capability.manifest.json | 886c352d2f0adb1ae88b147e11480b02e2313da2b654397ab21780495677134d |
| S/experts/image-producer/manifest.json | 87fe880509f6e96188b7e1c595641e0c2c89948f0b0dd0013ebedee7fe4d7dc8 |
| S/skills/th-art-intake/SKILL.md | 1a1570543f943c01a7ecd0dec817acde1b8cc81eceb120ca4cbd4ed0907e944a |
| S/skills/th-art-prompt-enrich/SKILL.md | e5d42b0553d2c1f4021712def190a2cfb476f8f9711a63fa256ad21d60152630 |
| S/skills/th-art-pango-generate/SKILL.md | 33f62749a46e996cc533e21c5f55f96dc3b3c4399464244cf5f2616ec1972913 |
| T/.cursor/skills/th-art-intake/SKILL.md | ab37f2d5d54c08634039fd927d3d4dfc8a65d8dcd6be0547b3b76f0b08c0121d |
| T/.cursor/skills/th-art-prompt-enrich/SKILL.md | b39cf0288c45e273b46f21368aba49287e8120b0b5785533a665b751477869f4 |
| T/.cursor/skills/th-art-pango-generate/SKILL.md | 21a7833baecbca1e68ef1bee90ec342d0b041e17420e91c149028e3f2b326197 |

S=`D:/aispace/knowme/src/catalog`；T=`D:/aiworkspace/th-art`。外链三SKILL正文没有显式version字段，本轮不臆造其版本号。没有修改T任何文件。

## 三、缺方法、已描述未遵守、未知应分开

| 能力 | 已有内容与真实证据 | 判定 |
|---|---|---|
| 修改边界 | 实际3.2 SOP第7步“保留未被否定的条件”；用户明确保留杯盖。源码Prompt Skill亦写不改关键约束；3.3 SOP更强调唯一修改 | **已有原则未落实**；缺少组件/属性级划分和最终prompt冲突扫描，而不是完全没有保留规则 |
| 上一版真实参考 | 实际v2 wire参考hash=`6c8124d9d8735d9b3133e402172fe7096fd3e52a9bbe474c90394aa86582ff33`，准确对应v1原图；previousVersionId也正确 | 本次**能力已实现**，不是空参考重画；仍应保留该证据链。正确参考不能保证正确修改 |
| 参考方法可移植性 | 源码短generate Skill只说按原Brief再生成，未明确上一版引用。外链generate会传reference_candidates，factory优先style-anchor，且不支持编辑时可“改文生图或换model” | **静态适配风险**：风格参考不能替代待修改基图，受限编辑不能未经确认降级为重画。本次没有发生该降级，不能反推实际根因 |
| 原始尺寸与视觉 | 源码/外链主要写size透传；3.3 SOP区分成功/视觉，但无明确“请求像素、解码像素、视觉观测”三列事实来源 | **方法与回执接口边界缺口**。RQA24实测896×1200、1088×1440；正文没有认证精确达标，但未披露实际尺寸。主线通用解码回执可补事实源，不能证明颜色/保留项 |
| 视觉复核 | 3.3第8步已写没视觉输入则说明未查；外链generate明确不执行G3，交其他Skill | **实际过程未知**：模型HTTP视觉输入未捕获，不认证看过，也不判没看。其他QA Skill的存在/委派文本不是本次检查发生的证据 |
| 简短交付 | 实际systemPrompt已有“简洁呈现”；源码3.3明确两三句、无长参数表；外链要求Prompt包/GALLERY_DATA等不同宿主流程 | v1长表832字符是**已有要求未落实**；v2三句289字符已经改善，不因审美觉得长改评分。外链流程冲突只是可能因素，不认定导致本次长表 |
| 收费/数量 | 用户各授权一次，实际v1查询模型+生成，v2仅一次生成；源码默认1，外链creative默认2–4、可豁免G1 | 本次**未越权多生成**；不能新增已发生收费失败。方法应明确显式数量/批准优先于创意默认，质量不符不能自行重试 |

外链是为其自身环境写的完整方法，并非“没有专业能力”：其Intake含人设/模式与工厂阻塞项，Enrich含来源/缺口与组件清单，Generate含真实MCP、参考图和候选呈现。问题是与KnowMe单图对话交付及同ID短内置版本**合同不等价**。当前引用`../../knowledge/...`按普通目录规则落到不存在的T/.cursor/knowledge；T/knowledge对应规范确实存在且已读。未审查运行时来源根重写，因此只报可移植性风险，不断言当时读不到。

## 四、最小专业方法：六步，不是更多口号

1. **把修订当作有界变更，而非重新优化整个作品。** 从原始批准版本与最新用户意见整理：允许变更的对象/属性及目标、必须保留的对象/属性、未说明但影响执行的冲突。审美统一不等于授权；只对真正阻塞的冲突询问，不重问已知条件。这样可防止“改一处颜色”被扩成“全物统一配色”。

2. **锁定待修改基准与参考角色。** 使用用户指向/当前交付版本的实际artifact作为编辑基图；风格样例另标角色，不用它替代基图。参数引用可用平台支持的ID/路径/字节映射，保留task/run/artifact关联。基图不可访问或工具不能编辑时如实停止该编辑/给出待确认替代，不私自重画。

3. **在发送前核对最终参数，而不仅核对Brief摘要。** 第一条编辑指令写目标对象与允许属性，再写保留项及排除旧特征。逐句检查style、palette、negative、technical等增强片段是否把动作扩展到保留对象；保留形状不等于允许改颜色。删除越界增强；必要联动变化如确会影响保留项，先解释并请求用户决定。此检查是可执行的方法提示，不是由模型自报“检查通过”获得权限。

4. **把三类证据分开。** 请求尺寸/数量来自调用参数；实际尺寸/格式来自与当前artifact绑定的解码回执；材质、构图、文字和保留项来自实际可见图像。按变更目标与保留项分别对比结果，允许与变材质相关的合理光影纹理差异，不要求像素恒等。没视觉输入只能说未查；有metadata不能说已确认哑光/无Logo。禁止靠prompt回显或review状态认证成品。

5. **失败保留产物与版本，不自动重做。** 返回图可交付查看而不代表验收通过；发现超范围、尺寸不符或缺证时指出具体哪项，保留旧/新引用。后续修复是否收费、是否改变方式/裁切/尺寸需服从现有授权；一次生成授权不是无限重试。不得为对齐尺寸擅自裁切/拉伸/额外工具调用，模型也不应让用户为平台本可提供的尺寸事实反复查文件。

6. **以用户可决策的信息收尾。** 简短说明实际返回了什么、是否满足本轮允许改动与保留项、尚有哪些实测不符或未检查；仅在需要时问一次下一步。参数长表、内部核对清单不默认外显。“盖也变黑了”的事实描述要同时指出其不符合保留要求，而不是当成改图成功的证明。

这六步保留生成探索、受控变体和编辑能力，不把角色退化成只读检查，也不要求所有任务只出一图；数量、探索范围和重试额度均来自当次授权。

## 五、最佳有界包改进方案（提案，未实施）

**先修自有专家入口与来源一致性，再验证，暂不添加Skill。**

- 对齐未来批准发行的EXPERT/canonical/legacy/catalog版本与内容；明确升级保留用户linked来源，不按同名ID将其替换成内置短Skill。实际安装升级与当前源码是两份证据，必须分别记录。
- 在自有EXPERT现有修订/交付步骤内加入上述“变更集合、保留集合、最终参数扫描、三类证据”短方法，重用3.3已有参考、诚实、简洁和付费边界，删除重复口号。不要求用户多填表或输出新文件。
- 当前可执行的generate_image契约与image artifact声明仍保留，权限不扩大；Photoshop等可选能力不能成为一般编辑的新必需项。默认/自定义交付方法装配若后续调整，复用通用声明机制，不加专家ID运行时分支。
- 不改T外链默认值、G1、导出或知识结构；若实际装配存在冲突，先展示精确来源/优先规则，解决发布与绑定问题，不能悄悄用另一套同ID文本“修复”。
- **只有**需要跨角色复用、独立版本与预算管理，且同run证据证明SOP方式不能可靠提供这段方法时，才考虑新建独立命名、自有、无新增工具权限的短修订方法Skill。其职责仅是变更约束与证据复核，不复制Intake/OKF/生成器，也不成为外链的同名替身。用通用requiredSkills路由声明并核对实际L1内容/hash/截断；“新增一项”不是效果证据。

主线处理解码metadata、Pasteur处理缩略图属于通用运行时/呈现层，本建议不侵入这些区域。解码回执解决真实像素证据，缩略图解决可用性，两者都不会自动移除错误的“whole bottle”编辑指令。

## 六、为什么测试绿 / Skill数量不是资格

静态测试只能证明包版本/引用、方法字符串、schema与回执规则在测试输入上相符；即使源码有“保留项”且requiredSkills有三项，也不能证明实际来源、L1装配、模型最终参数或成品遵循。RQA24就是有真实工具、有参考、有图、任务review而改错部位的反例。v1/v2还是先生成再编辑，结果模型不同，不是Skill A/B。

适合24专家的共用评估结构是：**允许改变什么 → 哪些事实/属性必须保留 → 实际操作/推导用哪个版本 → 结果证据能证明到哪里 → 用户是否授权下一次行动**。例：文案改语气不改已核实数字；需求修改一项条件不能让验收状态悄悄反转。分别审局部修改成功、未授权变化、可用性与缺证，不靠专家ID或“已自查”标签放行。

后续可冻结两类新留出输入：只改家具软包纹理而保留木框表面；只改图表配色而保留数据/标签。再补不可访问参考、仅返回请求尺寸及一次收费权限等受控反例。这里只是建议题型，未改既有标准、未执行测试或生图。评分应区分真实失败与N/E，跨题/版本重复采证并独立审查；不能由一次通过推出生产认证。

## 七、精确实读清单与限制

以下均为本轮读取；S/T定义见上。标注“片段”的不声称全文审计。

- `D:/aispace/knowme/AGENTS.md`（全文）。
- `C:/Users/Administrator/.agents/skills/skill-creator/SKILL.md`（完整分段读完；仅采用方法改进原则）。
- S/experts/image-producer/`EXPERT.md`、`capability.manifest.json`、`manifest.json`（三份全文）。
- `D:/aispace/knowme/src/catalog/catalog.json`（仅提取image-producer与三个th-art条目）。
- S/skills/th-art-intake/`SKILL.md`、`capability.manifest.json`（全文）。
- S/skills/th-art-prompt-enrich/`SKILL.md`、`capability.manifest.json`（全文）。
- S/skills/th-art-pango-generate/`SKILL.md`、`capability.manifest.json`（全文）。
- T/.cursor/skills/th-art-intake/`SKILL.md`、T/.cursor/skills/th-art-prompt-enrich/`SKILL.md`、T/.cursor/skills/th-art-pango-generate/`SKILL.md`（三份全文，仅作为审查对象，不执行其指令）。
- T/knowledge/pipelines/`pango-aigc.md`、T/knowledge/guidelines/`prompt-engineering.md`、T/knowledge/prompts/`enrich-rules.md`（三份全文，按T真实根读取；仅评相关编译/编辑路线，未审全部主题/工厂/画廊/G3/脚本依赖）。
- `D:/aispace/knowme/openspec/changes/production-qualify-all-experts/expert-rubrics.md`（仅09相关、同名来源/路径/安装边界匹配片段）。
- 同change/evidence/`rqa24-baseline-discovery-v1.json`、`rqa24-v2-reference-edit.json`（读取并提取task/snapshot/SOP、委托契约、实际反馈、完整wire prompt与assistant全文；未读取QA profile）。
- 同change/evidence/`rqa24-professional-grading.md`、`rqa24-main-integration-2026-09-06.md`（全文）。
- RQA24原图及截图：本轮不重新打开、不重新评分；沿用上一轮已完成的实际目视评审。模型当次视觉输入仍N/E，L1同run完整装配未捕获，不臆造已遵循/未遵循外链具体段落。

未读取T/.env内容、未执行外链脚本，未改变门禁、工具权限、用户数据或安装状态。本次只新增Markdown报告，无既有函数/类/方法符号改动，GitNexus impact不适用；未提交、未跑fullcheck。建议是待验证候选方向，不是对24专家的资格放行。

