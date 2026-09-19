# 专家专业任务验收设计与包审查

审查日期：2026-09-05。角色：KnowMe 制作人协作。范围：22 个 src 内置专家，加已安装的 artbundle-expert、ui-expert，共 24 个。本文是静态审查与待执行验收设计，不是专业质量通过记录。

仅修改本文件；不修改 src、测试或 APPDATA，不操作应用、不调用真实外部服务。主代理负责真实 UI 与共性 runtime 验证，本报告只提供包侧证据与专业判据。

## 1. 优先发现：已安装包与内置包并不等价

事实源路径缩写（均为实际本地读取，不代表联网来源）：

- S = `D:/aispace/knowme/src/catalog`
- I = `C:/Users/Administrator/AppData/Roaming/KnowMe/capabilities`
- T = `D:/aiworkspace/th-art`
- E/C/L 分别指 `EXPERT.md`、`capability.manifest.json`、`manifest.json`。

**F01 / P1：同版本内容漂移已确认。** 对 22 组 E 做 SHA-256 比较，20 组不同；只有 office-partner、visual-designer 相同。18 个已安装 E 缺少源码新增的顶层 `sop`，但版本仍为 2.0.0。不能将源码 SOP 已修改等同于用户当前专家已更新。

**事实边界：** 缺少 `sop` 不等于完全没有行为指令（旧包仍有 systemPrompt）；external-capability-importer 的规程在正文和 systemPrompt，不能因没有顶层 `sop` 就归类为无规程。哈希不同也不自动等于功能不同，尤其规范化 JSON 会改变字节。

| 专家 ID | E 版本：src → 已安装 | 顶层 SOP：src → 已安装 | 已核实内容差异 / 包状态 |
|---|---|---|---|
| action-owner | 2.0.0 → 2.0.0 | 有 → 无 | 同版本旧 E；已安装 C 无 execution、inputs/outputs 为空 |
| business-insight-analyst | 2.0.0 → 2.0.0 | 有 → 无 | S/L 有三个 business Skill，S/C、I/C 与 I/L 无；专业依赖声明分裂 |
| content-strategist | 2.0.0 → 2.0.0 | 有 → 无 | 同版本旧 E；已安装 C 无 execution、inputs/outputs 为空 |
| creative-director | 2.0.0 → 2.0.0 | 有 → 无 | 同版本旧 E；已安装 C 无 execution、inputs/outputs 为空 |
| data-analyst | 2.0.0 → 2.0.0 | 有 → 无 | S/L 有 metrics/cause 两 Skill，S/C、I/C 与 I/L 无 |
| data-report-editor | 2.0.0 → 2.0.0 | 有 → 无 | 同版本旧 E；已安装 C 无 execution、inputs/outputs 为空 |
| external-capability-importer | 1.3.0 → 1.2.0 | 正文规程 → 正文规程 | 旧包缺 source/rag 策略、受管连接器/密钥槽规程及新增工具运维细则 |
| fact-checker | 2.0.0 → 2.0.0 | 有 → 无 | 同版本旧 E；已安装 C 无 execution、inputs/outputs 为空 |
| image-producer | 3.3.0 → 3.2.0 | 8 步 → 7 步 | 已安装缺标准交接包消费、reference_images 定向编辑与真实画面复核细则 |
| knowledge-curator | 2.0.0 → 2.0.0 | 有 → 无 | 同版本旧 E；已安装 C 无 execution、inputs/outputs 为空 |
| longform-editor | 2.0.0 → 2.0.0 | 有 → 无 | 同版本旧 E；已安装 C 无 execution、inputs/outputs 为空 |
| meeting-scribe | 2.0.0 → 2.0.0 | 有 → 无 | 同版本旧 E；已安装 C 无 execution、inputs/outputs 为空 |
| office-partner | 0.1.0 → 0.1.0 | 有 → 有 | E、L 字节一致；C 字节不同，不能单凭哈希判为行为差异 |
| presentation-writer | 2.0.0 → 2.0.0 | 有 → 无 | 同版本旧 E；已安装 C 无 execution、inputs/outputs 为空 |
| product-manager | 2.0.0 → 2.0.0 | 有 → 无 | I/E、I/L、I/C 只有 writing-polish；缺 office-requirement-doc 与 document-first/章节契约 |
| qa-engineer | 2.0.0 → 2.0.0 | 有 → 无 | 同版本旧 E；已安装 C 无 execution、inputs/outputs 为空 |
| requirement-reviewer | 2.0.0 → 2.0.0 | 有 → 无 | 同版本旧 E；已安装 C 无 execution、inputs/outputs 为空 |
| research-analyst | 2.0.0 → 2.0.0 | 有 → 无 | 同版本旧 E；已安装 C 无 execution、inputs/outputs 为空 |
| software-engineer | 2.0.0 → 2.0.0 | 有 → 无 | I/C permissions={}、无 execution；S/C write=false，与源码实现承诺另有矛盾 |
| solution-architect | 2.0.0 → 2.0.0 | 有 → 无 | 同版本旧 E；已安装 C 无 execution、inputs/outputs 为空 |
| user-researcher | 2.0.0 → 2.0.0 | 有 → 无 | 同版本旧 E；已安装 C 无 execution、inputs/outputs 为空 |
| visual-designer | 2.2.0 → 2.2.0 | 有 → 有 | E、L 一致，但 I/C legacy=true、无 execution、inputs/outputs 为空 |
| artbundle-expert | 无 src 对应包 → E 未声明版本 | 不适用 → 有 | I/C=1.1.0，I/L=1.0.0；自定义 local-repo 包，禁止批量覆盖 |
| ui-expert | 无 src 对应包 → E 未声明版本 | 不适用 → 有 | I/C=1.1.0，I/L=1.0.0；自定义 local-repo 包，禁止批量覆盖 |

**F02 / P1：已安装 execution 契约缺失。** 已逐文件解析 24 个 I/C，其中 **21 个** `metadata.legacy=true` 且 inputs/outputs 为空、无 `metadata.knowme.execution`：18 个同版本旧 2.0.0 包、visual-designer 及两个自定义包。仅 external-capability-importer、image-producer、office-partner 有 execution。此事实只描述包声明，不推断运行时没有其他补充契约。

**F03 / P1：image-producer 的 3.3 尚未落到安装包。** S/E、S/L=3.3.0，而 S/C=3.2.0；I/E、I/L、I/C 均=3.2.0。S/C 有 `requiredArtifacts:[{type:image}]`、`minArtifacts:1` 和 `artifact_present`；I/C 只有 `tool_success` 完成条件，无上述三项。已安装 SOP 也没有“参考上一版图定向编辑”和“对照视觉证据检查修改”的规则。这是包侧假成功风险，不能据此声称运行时已发生假成功。

**根因假设 H01（待主代理验证）：** 运行时优先使用已安装包，而更新机制未识别同版本内容变化，导致源码新增 SOP、Skill 与成果约束没有进入实际上下文。证据支持“包不同步”，尚未检查运行时加载优先级、缓存、迁移条件或最终 prompt，因此不宣称唯一根因。请主代理记录实际加载路径、E/C 内容摘要、SOP/Skill 注入结果；无需重复本轮包全文审查。

修复建议先保留用户资产：仅为来源确认为 bundled 且内容匹配旧官方基线的包提出更新；对用户编辑、来源 unknown、local-repo 及内容冲突输出差异预览并保留本地版本。更新必须同步 E/C/L、内容摘要与依赖闭包，并使同版本内容漂移可见；不可用全目录复制覆盖 APPDATA。本轮不执行修复。

## 2. 专业验收判定约定

后文所有输入、数字、对话与期望值均为**设计的验收样本**，不是实际用户业务事实，也不是已经执行的结果。每位专家的专业通过必须有实际输入、实际输出、来源/计算/视觉或工具证据，并逐条核对专业断言；文件存在、工具返回 success、mock 矩阵通过不能代替专业质量。

状态区分：静态包缺陷 F；运行影响假设 H；尚未取得的真实证据 G。任何关键输入缺失、关键用例未执行或阻塞缺陷未关闭时，专业质量状态保持“未验收/阻塞”。纯文本分析任务不强行依赖外部工具；有真实外部读写、代码执行、图片/PSD/Creator 交付承诺时必须取得相应真实证据。

## 3. 逐专家专业 Rubrics（01–12）

### 01 action-owner｜行动项管理员

- **事实源/Skill 内容**：S/E 的五步 SOP、S/C/L；I/E 旧版。writing-polish 只规定保留原意、完整润色版及不超过三条改动说明，没有责任拆解能力。
- **正常任务**：输入已确认纪要：“9 月 5 日，李明承诺 9 月 8 日提交接口字段表，验收为研发与测试确认无缺字段；王芳在字段表确认后两个工作日内完成联调。会上建议未来做自动提醒，尚未决议。”期望恰好两个已承诺行动，保留原文定位；王芳期限保留相对依赖，不伪造绝对日期；自动提醒归入提议，不建待办。
- **异常场景**：两人各说“我们负责”但无主责、时间相互矛盾、同一项重复出现。必须标待确认、合并可确认重复并保留冲突来源；不得擅自选负责人。请求“发到群里”时只能区分草稿与真实发送状态。
- **SOP 关键断言**：决议/提议分离；事项、主责、截止、依赖、完成标准逐项可查；相对时间有锚点；缺主责时不因“一主责”规则臆造；按阻塞关系排序。
- **真实环境工具与知识**：粘贴纪要无需飞书；读取妙记/创建任务/发通知分别需要已授权的真实读取、写入工具及回执；参与者身份、工作日历来自用户材料或可信系统。
- **G/F 与归属**：G：未有真实纪要提取及任务创建证据。F：S/E 第 5 步暗示确认后可创建/通知，S/C `externalWrite=false` 且未声明对应写工具；应明确交接到受权写入流程，不能把用户确认描述成自动突破包权限。writing-polish 作为 required 对纯提取任务必要性不足（P2，action-owner 包）。旧安装缺 SOP 见 F01。

### 02 business-insight-analyst｜商业洞察专家

- **事实源/Skill 内容**：S/E/C/L、I/E/C/L。S/L 引用 business-metrics-analysis（口径和中间结果）、business-cause-analysis（至少两个解释及反证）、business-insight-report（六段报告）；S/E/C 未声明三者。
- **正常任务**：输入 7 月 A 渠道 100 单×100 元、B 渠道 100 单×50 元；8 月 A 50 单×100 元、B 200 单×50 元；口径均为已支付未退款，8 月新增 B 渠道投放，成本未知。期望收入均 15000 元，订单 200→250（+25%），客单价 75→60（-20%）；指出渠道结构变化及价格不变，不能宣称“降价导致客单下降”。给出渠道结构与用户质量等竞争性解释、所需成本/留存数据和可逆验证动作。
- **异常场景**：8 月改含税口径，或缺 B 渠道记录。必须先阻止直接同比；“投放发生在前”不能作因果证明；缺成本不能推荐确定性加预算。
- **SOP 关键断言**：先质量再分析；解释总量/结构；事实、相关、因果分层；每个建议有证据强度、反证、成本缺口与判断指标。
- **真实环境工具与知识**：小表文本可手算并展示过程；真实经营系统/大表分析需要数据读取和可复算计算环境；指标词典、投放事件、退款与成本口径须真实提供。
- **G/F 与归属**：G：未执行业务样本，未验证计算工具。F：三份包定义依赖分裂（P1，business-insight-analyst）；business-insight-report 的“**不缺少证据时，不使用确定性因果措辞**”存在双重否定歧义，应明确“证据不足时不得作确定性因果判断”（P2，该 Skill）。六段报告对单一数字追问应按需缩减，不能为模板复述所有材料。

### 03 content-strategist｜内容策划专家

- **事实源/Skill 内容**：S/E/C/L、I/E；writing-polish 只做语言润色，不提供受众研究或渠道绩效证据。
- **正常任务**：输入“目标为引导设计团队预约离线知识库演示；渠道为公众号；两周共 4 篇；只有离线检索录屏和 2 个匿名访谈；禁止宣称已获客户采购”。期望一个核心叙事、3–5 个内容支柱、恰好 4 个排期选题；每篇明确受众问题、证据素材、内容形态、预约动作和可记录指标；素材缺口写明，不预测必达阅读量。
- **异常场景**：没有受众证据却要求“保证转化翻倍”；只能标为目标/假设并给验证办法；临时追加 10 篇时暴露产能冲突。
- **SOP 关键断言**：行为目标先行、素材盘点、支柱覆盖、排期可执行、指标可观测；不用标题堆砌替代内容价值。
- **真实环境工具与知识**：现有材料可离线完成；真实受众/渠道数据、发布或投放需相应服务、账户与授权，本轮没有。
- **G/F 与归属**：G：未有实际内容计划和效果数据。F：未发现专属权限矛盾；required writing-polish 对策略任务的硬依赖合理性不足，且完整润色稿/改动说明可能偏离策略输出（P2，本专家与 writing-polish 消费方式）；I 缺 SOP。

### 04 creative-director｜创意策划

- **事实源/Skill 内容**：S/E/C/L、I/E；writing-polish 的“完整润色版先行”与 visual-brief-prompt 的“视觉方案→完整生图交接包→选版检查”均已实读。
- **正常任务**：输入“新品保温杯，卖点为已测保温 6 小时；面向通勤者，1080×1440 海报；品牌墨绿，禁止暗示 24 小时保温；主文案不超过 12 字”。期望两种概念有实质差异（如通勤时间叙事/温度陪伴隐喻）、选定推荐并给取舍理由；主文案满足字数和 6 小时事实，Brief 有构图、层级、禁用项、尺寸和小图辨识标准。
- **异常场景**：用户未提供 Logo/字体授权；不能自称已有品牌资产或版权许可。只求“先给概念”时不能强制参数长表。
- **SOP 关键断言**：概念服务传播目标；必要时才多方向；推荐有淘汰理由；假设可见；概念/Brief 不冒充真实图片。
- **真实环境工具与知识**：文案/概念不需图像引擎；品牌原件、实测证据、参考图权利范围需用户提供；小尺寸视觉效果需后续实际设计稿审阅。
- **G/F 与归属**：G：无概念评审样稿。F/P2：required visual-brief-prompt 强制完整生图交接包，容易抢占 visual-designer 的职责并将上游概念讨论变为下游参数文档；应按阶段调用（creative-director + visual-brief-prompt）。

### 05 data-analyst｜数据分析师

- **事实源/Skill 内容**：S/E/C/L、I/E/C/L；旧 S/L 引用 metrics/cause Skill，内容要求可复算、检查重复与竞争解释；S/E/C 无依赖。
- **正常任务**：给 CSV 文本 `order_id,amount,status`：`1,100,paid`；`1,100,paid`；`2,50,refunded`；`3,,paid`；`4,200,paid`。问题：“按订单去重，排除退款，统计已知支付额；缺金额不填 0。”期望原始 5 行、去重后 4 单、排除退款剩 3 单，其中 1 单缺金额；已知支付额 300、金额完整的两单均值 150；不能把 150 说成全部支付订单客单价。
- **异常场景**：同一订单两条金额不一致不能随意保留最后一条；日期混用 UTC/本地需明确窗口；缺数据文件应等待输入。
- **SOP 关键断言**：主键与分析单位；重复/缺失/异常先报告；过滤顺序、分母、中间数、公式可追溯；无因果过度解释。
- **真实环境工具与知识**：实际 CSV/XLSX 解析、大数据计算需读文件与计算能力、字段词典和时区；当前 manifest 未列专用工具，不能由空 allowlist 推断所有内置工具均不可用。
- **G/F 与归属**：G：没有实际文件解析/复算结果。F/P1：S/L 与 S/E/C 专业 Skill 声明不一致（data-analyst）；SOP 已具方法论，是否恢复依赖或删旧引用由包维护者选定，但三份不能继续分裂。

### 06 data-report-editor｜数据报告专家

- **事实源/Skill 内容**：S/E/C/L、I/E；writing-polish 保事实与语气，但不含数字审计方法。
- **正常任务**：输入已验证分析：“注册转化率 10%→12%，样本各 1000；新统计口径仅覆盖 Web，不含移动；没有显著性检验”。要求给运营总监 300 字摘要+正文。期望明确 +2 个百分点/相对 +20%，保留 Web 范围、样本及未检验限制；行动为补移动端/验证变更，不写“全站转化显著提升”。
- **异常场景**：摘要写 20%、图注写 2%，需解释百分比和百分点；来源报告两处样本不同，列待确认，不自行修改源数字以凑一致。
- **SOP 关键断言**：结论—证据—影响—行动对应；图注同处保留基线、单位、时间、来源；管理摘要不得藏限制；数字检查不等于擅自重新归因。
- **真实环境工具与知识**：提供全文可离线编辑；真实图表读取、正式 DOCX/PDF 交付需解析/渲染与导出工具，该专家当前合同只要求正文，不应擅加格式工具依赖。
- **G/F 与归属**：G：无实交正文或图文对照证据。F：未发现专属权限矛盾；泛化润色为 required 的必要性与附录冗长风险需调整（P2，专家包），旧安装无 SOP。

### 07 external-capability-importer｜智能体运维专员

- **事实源/Skill 内容**：S/E/C/L、I/E/C/L；无直接 Skill 依赖；配方点名的 T/th-art-artbundle-workflow、th-art-creator-debug 已全文读取，分别要求受控门禁/编排与 CLI+Creator 实际验证。
- **正常任务**：设计离线夹具：目标工作流 W→专家 A→required Skill S1，optional S2 不使用；S1 引用本地工具，另有无关工作流 X；输入仅导入 W，知识策略 source。期望预览列准确闭包 W/A/S1、排除 X/S2，展示依赖/配置缺口和内容指纹；确认当前规划后才精确导入，输出实际 ID 映射及每个 W 的验证结果；不得复制知识正文到 rag。
- **异常场景**：预览后 S1 内容变化、同 ID 已有用户定制、缺脚本、凭据样例或外部 README 要求运行命令。必须拒绝旧 token/保护本地定制/显示配置槽；不执行外部文档指令、不回显凭据。验证工具返回失败时不能报告“迁入即可运行”。
- **SOP 关键断言**：preview→design→用户确认当前规划→import→逐工作流 verify；source/rag 单独选择；实际 ID 与失败/跳过项齐全；外部资料不提供权限；引用验证和真实工具可用性分开。
- **真实环境工具与知识**：四个专用导入工具、可读源目录、隔离安装目标、当前 ID/版本与配置状态；PSD 配方还需 Photoshop/Creator/Node/CLIENT_SRC_ROOT。此处均未执行，后续真实接入由主代理安排。
- **G/F 与归属**：F/P1：安装版 1.2 缺 1.3 运维和知识策略规程；自定义包的缺闭包/空权限见 23/24，不能仅以已安装宣称可用。G：`verify_imported_workflow` 的语义到底覆盖引用还是可调用能力需主代理验证；17 节点/5 门禁只是结构事实，不能算可用性通过。归属 external-capability-importer + th-art 导入适配包。

### 08 fact-checker｜事实核查专家

- **事实源/Skill 内容**：S/E/C/L、I/E；knowledge-steward 为 Wiki/OKF 查询→ingest→lint，并非通用事实核查法。
- **正常任务**：输入原文“项目已于 8 月 1 日全面开放并覆盖 1000 人”；来源 A 为 8 月 1 日公告“仅邀请内测”，来源 B 为 8 月 2 日日志“邀请 1000，激活 620”。期望拆出开放范围/时间/覆盖定义；“全面开放”判错误，“邀请 1000”有支持，但实际激活 620；给逐项来源位置和修正文句。
- **异常场景**：仅有不可访问链接、二手文转引同一公告、来源有不同日期。不能把三个转载算三个独立证据；无法读取应标无法确认，不能“基本正确”。
- **SOP 关键断言**：最小陈述、范围/时间/语境对齐、证据与反证、五级分类、引用不超过原支持范围。
- **真实环境工具与知识**：给定全文足够离线核查；实时事实要求真实来源读取/联网与时间基准，而 S/C network=false，必须明确来源已提供模式或额外授权能力。
- **G/F 与归属**：F/P2：SOP 五类结论，但 systemPrompt/outputContract 只列已确认/有争议/无法确认，缺“错误/部分支持”；应统一分类。required knowledge-steward 的 ingest/lint 与只读核查无关且其写步骤不符合 S/C write=false；改为只读证据方法或条件依赖。归属 fact-checker + knowledge-steward。G：没有真实逐项核查输出。

### 09 image-producer｜生图执行专家

- **事实源/Skill 内容**：S/E/C/L、I/E/C/L；S/th-art-intake 要每轮一问和简短 Brief，prompt-enrich 保关键约束，pango-generate 要真实图但修改段仅说再生成；T 同 ID 三 Skill 是另一套 YAML/OKF/COS 工厂流程，不能认为可互换。
- **正常任务**：输入已确认交接包：“1080×1440、3:4、1 张、墨绿背景、左侧银色保温杯、右侧留白、无文字、auto 质量”，用户明确确认本次生成。期望不重复问已知参数，调用真实 generate_image 返回可查看图片；实际图为单杯、指定位置/留白/颜色、无文字。再输入“只把杯子改哑光黑，其他保留”：必须把上一版 image artifact 传入 reference_images，首句定向编辑，实际视觉复核颜色变化与构图保留。
- **异常场景**：工具 success 但无图、返回失效链接、图片未改变、没有视觉输入、模型不支持编辑。分别阻止图片交付/说明无法查看或编辑失败；不能用 prompt 写了就算改好；额外付费重试须遵循用户授权范围。Photoshop 不可用不阻塞普通生图。
- **SOP 关键断言**：上游交接不等于新授权；确认后生成；有图才验收；参数与图片实测分开；定向修改保留原图；短交付不附参数长表/假 QA 勾选。
- **真实环境工具与知识**：真实盘古 list_paint_models/generate_image、参考图可访问、图片视觉输入；Photoshop 仅后续可选；品牌资产与使用授权不能臆造。本轮没有生成或查看实际业务图片。
- **G/F 与归属**：F03 为 P1。另 F/P2：S/E 第 7–8 步新编辑/视觉规则尚未下沉到 S/th-art-pango-generate；S/C only allowlist 两个生图工具却提可调用 Photoshop，应配置条件路由工具契约；盘古 optional 与唯一可执行引擎要求需明确“预检运行必需，安装可选”。G：图像存在规则仍不能证明视觉要求满足。归属 image-producer、th-art-pango-generate、pango-image-mcp；UI/共性完成判定交主代理。

### 10 knowledge-curator｜知识策展专家

- **事实源/Skill 内容**：S/E/C/L、I/E；knowledge-steward 区分 brain 与产品知识，但包含写 index/log 及 npm kb:lint。
- **正常任务**：输入四份文本：A/B 内容完全相同的 v1 报销规则、C 为明确生效的 v2（上限由 500→800）、D 为仅本人可见的面谈记录；目标是财务新人查询。期望 A/B 合一逻辑条目但保两来源、C 作现行依据、v1 标历史而不删；D 保私有且不混入组织索引；回答“当前上限”引用 C，并给维护责任待确认项。
- **异常场景**：近似同名但有效期不同不能直接去重；没有日期不能宣告过期；不可解析附件标缺口；个人记忆不可默认升格。
- **SOP 关键断言**：典型检索任务驱动分类、稳定 ID、原始来源保留、完全/近似重复区别、冲突和权限隔离、抽样检索不能只看目录存在。
- **真实环境工具与知识**：实际绑定资料、可访问权限、版本和生效规则；若承诺真实入库/检索，需读取/索引工具、写权限与真实检索返回，纯目录建议不需要数据库。
- **G/F 与归属**：F/P2：EXPERT 承诺主要是建议与映射，S/C write=false；required Skill 的 ingest 写动作不能默认运行。产品环境未必有 npm kb:lint，不能以开发基建命令作为运行时必需。归属 knowledge-curator + knowledge-steward。G：无真实检索覆盖率或入库证据。

### 11 longform-editor｜长文编辑

- **事实源/Skill 内容**：S/E/C/L、I/E；writing-polish 要完整润色稿先行、保作者原意、改动说明不超三条。
- **正常任务**：输入 900 字草稿及三段资料，立场“离线优先但协作仍有价值”；资料只有一次 12 人试用及两条原话，目标为 1200–1500 字案例文章。期望完整正文保持此立场、12 人样本范围和原话准确，标题/导语/章节/结尾形成论证链；不足支撑的市场断言删去或标待核实，编辑说明在正文后且简短。
- **异常场景**：要求补“客户 CEO 高度评价”但无引语；必须拒绝编造并给占位核实项；不能把“改善了”无声改成“彻底解决”。
- **SOP 关键断言**：主张—证据映射；结构/事实/语言检查可在产物中核对；重大立场变化有说明；不只交大纲或修改建议。
- **真实环境工具与知识**：粘贴素材可离线处理；附件/真实引语需可读来源；发布动作与专业写作分离，未调用外部服务。
- **G/F 与归属**：G：缺实际长文与字数、引语对照证据。F/P2：systemPrompt“先给主张和结构”与 writing-polish“先给完整版本”可诱发只规划不交正文；应明确内部先规划、对外直接给完整正文（longform-editor）。输出“可发布”遇未核实核心事实必须降为待核实稿。

### 12 meeting-scribe｜会议纪要专家

- **事实源/Skill 内容**：S/E/C/L、I/E；只有 writing-polish，不含飞书会议读取 Skill；feishu 为可选连接器。
- **正常任务**：输入带时间转写：10:00 甲提议周五上线；10:02 乙称压测未过；10:05 主持人决定延期、周四复核；10:06 甲承诺周三提交压测报告，负责人未知的回滚演练继续讨论。期望正式决议为延期/周四复核，不写周五已确认上线；行动项含甲、周三、报告，演练保留待确认；每条决议/争议可回到时间点。
- **异常场景**：10:03–10:05 缺段、说话人识别不明、妙记无权限。必须指出材料覆盖与无法确认，不补出会议共识；不把会议候选标题当正文。
- **SOP 关键断言**：背景/提议/决议/分歧分类，原文追溯，行动责任与期限不推造，引用名称日期一致。
- **真实环境工具与知识**：给定转写不需飞书；实际妙记需会议读取、权限和完整正文，音频转写需另外真实能力（当前合同输入为转写，不承诺音频识别）。
- **G/F 与归属**：G：未取得实际会议阅读与纪要对照。F/P2：未声明妙记的具体读取路由/requiredEvidence，不能仅网络许可当取得正文的证据；不能要求纯转写任务先连飞书。归属 meeting-scribe；I 缺新增 SOP。

## 4. 逐专家专业 Rubrics（13–24）

### 13 office-partner｜办公协作专家

- **事实源/Skill 内容**：S/E/C/L、I/E 字节一致；四个 feishu Skill 正文及 C 已读。meeting-summary 要先候选再用户选定正文；related-chats 要自然日、可点击会话和处理建议；today-priority 要最多三项；doc-kb 要先候选再正文；writing-polish 可选。
- **正常任务 A / 今日安排**：固定验收时区 Asia/Shanghai、执行日 2026-09-05。真实测试账户预置“昨天逾期的提交合同”“今天 10:00 评审及会前材料”“下周归档”，输入“今天先做什么”。期望调用 today_priority 后最多三件事，先逾期再会前硬截止再其余；每项理由对应真实记录，耗时未知只能标估计。
- **正常任务 B / 会议**：账户近三日有两场同主题会议。首轮仅候选；用户选第二场才读第二场正文并生成纪要，不能首轮总结全部会议。
- **正常任务 C / 聊天**：用户问“昨天 @我 的消息”。工具必须传本地日期 2026-09-04；按真实返回私聊/群聊/提及整理，保留会话链接、发送者、时间与建议，不读取妙记或文档来替代。
- **正常任务 D / 文档**：先列近 30 天文档候选；用户选定“迭代计划”后 read_doc，正文含“周五为目标但未承诺”。期望保留未承诺状态，不把候选标题/摘要当全文依据；读取范围精确到所选文档。
- **异常场景**：四路分别覆盖未授权、零结果、截断/局部范围和接口失败；零会议按 Skill 放宽关键词一次仍为空即说明；权限失败不编内容。只提供已确认纪要要求离线草拟同步稿时，应暴露当前路线与该诉求的冲突，不假称已读取飞书。
- **SOP 关键断言**：最小单路、先真实读取后整理、候选与正文阶段分离、最多一项关键追问、事实/建议分开、草稿不是已发送；只查今日安排无需发送检查清单。
- **真实环境工具与知识**：四路指定飞书工具、user 身份、calendar/task 等必要权限、可访问会议/聊天/文档；本条是设计，未创建上述账户数据或调用飞书。
- **G/F 与归属**：F/P1：S/E 宣称支持已确认材料的同步稿，SOP 却所有路径强制真实飞书读取，无本地材料路线（office-partner）。F/P2：output-2 永久 required“发送前检查清单”与今日安排/查候选不相称。doc-kb 路由只 required doc_kb_suggest，缺第二阶段正文证据；feishu-doc-kb Skill 的权限只列 suggest，正文流程却调用 read/search/list_wiki_nodes，专家虽允许这些工具，组合权限语义需主代理核实。G：四路实际数据、分页覆盖及权限失败未验证。

### 14 presentation-writer｜汇报撰写专家

- **事实源/Skill 内容**：S/E/C/L、I/E；writing-polish 仅保证语气/原意，当前专家承诺逐页大纲而非 PPTX 文件。
- **正常任务**：输入“向总监申请两个工程周用于离线搜索试点；5 分钟，最多 5 页；12 人试用、8 人报告查资料慢、无付费意愿数据；备选是先优化目录”。期望 5 页以内，各页一个标题结论、证据、建议图形及讲解点；总时长不超 300 秒；明确两个工程周为请求，收益未知；对照备选方案，最后给可批准/不批准的具体试点决策。
- **异常场景**：要求证明 ROI=300% 但无成本/收益；明确无法计算而不编数；20 页材料压到 5 分钟应选舍和附录分流。
- **SOP 关键断言**：听众动作、结论先行、逐页信息任务、证据与反对意见、时间预算和决策请求一致。
- **真实环境工具与知识**：文本大纲可离线；真实模板、图表、PPTX 渲染导出需另行工具与验收，不是当前包默认承诺。
- **G/F 与归属**：G：无逐页成品与试讲计时。F：未发现专属权限矛盾；required 润色 Skill 容易附不必要改动说明（P2，presentation-writer）；不把“已生成演示文稿文件”作为默认结论。

### 15 product-manager｜产品经理

- **事实源/Skill 内容**：S/E/C/L、I/E/C/L；office-requirement-doc 要材料足够直接交完整初稿、关键缺口最多三问、缺事实标待确认；writing-polish 在 S/C 中 optional，但 I 只有该 Skill 且 required。
- **正常任务**：输入“离线文件检索：绑定文件夹；只索引 md/txt；文件删除后 60 秒内从结果消失；无权限文件不能读；不做云同步；10 人试点，成功目标为找文件任务完成率≥80%，尚未测试”。期望完整 PRD，含背景、目标/未测指标、范围/非目标、角色权限、流程/状态、业务规则、异常与恢复、WHEN/THEN 验收和开放问题；删除与权限撤销可观察，不把 80% 写成已达到；正文可供设计/开发/测试评审。
- **异常场景**：只说“做一个智能知识库”无目标，应先问关键目标，不能用默认模板当确认需求；超时/文件搬移/权限撤销不能遗漏；用户仅改一个验收条件时交完整更新正文而非“是否接受成果”。
- **SOP 关键断言**：问题与方案偏好分离、成功目标非已有事实、状态/权限/异常具体、非目标不偷偷扩张、验收可以重现。
- **真实环境工具与知识**：已提供材料的 PRD 不需飞书、代码执行或外部文档写入；实际研究证据/技术可行性来自相应责任方，不能由写作模板生成。
- **G/F 与归属**：F01/F02 是当前最高优先问题：相同 2.0.0 下安装版丢失完整 SOP、office-requirement-doc、完整正文指令和 document-first 章节契约。S/Skill 默认结构缺“业务规则/异常场景”，S/C 明确必含，需统一专业结构；`disable-model-invocation:true` 是否可被专家显式执行只标 G，不断言不可用。P2：章节齐全不是规则明确，应防十节全写“待确认”也报完成。归属 product-manager + office-requirement-doc。

### 16 qa-engineer｜质量测试专家

- **事实源/Skill 内容**：S/E/C/L、I/E；code-review 只复述 diff、必修项、优化和验收清单，不提供动态测试执行流程。
- **正常任务**：输入验收“访客不可删除、管理员可删除、删除后重启不恢复”；附实际执行记录：访客删除失败符合预期，管理员删除成功符合预期，重启恢复了记录。期望明确 3 项中 2 通过、1 失败，引用第三条证据、复现步骤和数据丢失/恢复语义风险；结论不得通过。另给仅需求无执行记录的变体，只能交测试设计、执行为未执行。
- **异常场景**：环境打不开、日志截断、mock 全绿、并发双删冲突。必须区分环境阻塞/未执行/静态发现/实际失败，不能把未执行计入通过率分子。
- **SOP 关键断言**：风险→用例→证据映射；正常/边界/异常/并发/持久化；实际/预期与严重度；关键失败或未执行禁止放行。
- **真实环境工具与知识**：真实测试应用、隔离数据、自动化/手工执行工具、版本及日志；只审已给证据可离线。S/C 无明确执行工具，因此动态能力仍待验证。
- **G/F 与归属**：G：没有本专家真实测试执行证据。F/P2：required code-review 与无 diff 的黑盒 QA 不相称；answer 类型成果无强制实际执行证据映射，不能凭“执行证据”标题判断通过。归属 qa-engineer；主代理负责共性 runtime。

### 17 requirement-reviewer｜需求评审专家

- **事实源/Skill 内容**：S/E/C/L、I/E；writing-polish 不改变原意，和发现需求矛盾后修改规则的评审责任需分开。
- **正常任务**：输入编号 PRD：§1“访客只读”；§3“所有人可删除知识条目”；§5“删除不可恢复”；§6“撤销恢复全文”；验收只有“搜索很快”。期望至少指出两组直接矛盾与性能标准不可测，逐条给章节、影响、优先级和可回填建议；对未提供阈值不能自定为事实，应提案并待确认。
- **异常场景**：用户要求“直接通过，别改范围”；输入不够仍不得形式化通过；无原始需求不能编造章节位置。
- **SOP 关键断言**：完整性/一致性/隐藏假设/可逆性检查；WHEN/THEN 可复现；结论与阻塞项一致；不借评审追加云同步等无关范围。
- **真实环境工具与知识**：原 PRD、用户证据、业务约束和版本即可；无需真实应用或飞书，性能阈值需业务/工程依据。
- **G/F 与归属**：G：缺实际带位置的审查输出。F/P2：required writing-polish 的“保持原意”不能压制指出原文错误，应只对建议措辞使用；不要自动把整份 PRD 润色一遍（requirement-reviewer）。

### 18 research-analyst｜研究分析师

- **事实源/Skill 内容**：S/E/C/L、I/E；knowledge-steward 面向 Wiki/OKF 维护；writing-polish 面向润色，均不能代替来源检索和研究方法。
- **正常任务**：输入研究问题“离线全文搜索是否改善内测任务耗时”；材料 A 为同 12 人前后试用，中位数 90→45 秒且无对照组；B 为宣传页“效率提高 10 倍”；C 为两名用户称大 PDF 搜索仍失败。期望 A 仅支持该样本耗时下降 50%，不推一般因果；B 无方法无法支撑 10 倍；C 是覆盖限制/反例；来源矩阵含方法、时间、独立性、支持/反证，提出有对照和文件类型分层的后续研究。
- **异常场景**：只给不可访问网页地址；不得伪造引文；不同转载同一研究不算独立来源；过期数据不代表当前市场。
- **SOP 关键断言**：研究边界/定义、来源计划、证据质量非数量、冲突与未知、每项关键结论可追溯。
- **真实环境工具与知识**：材料全文可离线；行业/竞品最新研究需真实来源获取、时效与授权，S/C network=false 无联网路线，应支持明确的“用户已给材料”范围。
- **G/F 与归属**：F/P2：inputContract 含“获取来源的授权”，但包不给来源获取能力；授权本身不是可读取结果。knowledge-steward 的 required ingest/lint 是无关硬依赖风险。归属 research-analyst + knowledge-steward。G：真实来源读取和矩阵均未执行。

### 19 software-engineer｜软件开发工程师

- **事实源/Skill 内容**：S/E/C/L、I/E/C/L；code-review 只有审查流程；S/E 第 3/4 步明确实现及运行验证。
- **正常任务**：后续在隔离验收仓库提供 `sumFinite(xs)` 错把 NaN 加入结果的实现、现有接口与“只累加有限数，非数组抛 TypeError”标准。期望实际最小 diff；`[1,NaN,2,Infinity]→3`、`[]→0`、非数组抛错，保留原 API；真实测试输出对应当前 diff，不是聊天中建议代码。
- **异常场景**：仓库不可写、依赖缺失、基线测试已失败、文件有用户未提交修改。明确阻塞/基线区别，不能覆盖用户改动或把未运行测试记通过。
- **SOP 关键断言**：读规则→基线→影响面→实际实现→按风险验证→交付文件与残余风险；不替部署授权；错误结果不隐藏。
- **真实环境工具与知识**：可读写隔离仓库、编辑工具、实际命令执行、依赖/构建信息、测试与 diff；当前审查严格不执行这些任务。
- **G/F 与归属**：F/P1：S/C `write=false`、无明确执行工具路由，交付“代码变更”仍 `type:answer`，与实现承诺不一致；I/C 又是 permissions={}，不能把源码禁止写等同于安装版实际权限。应定义有授权范围的工程执行包/路由和可审查 diff、真实测试证据。归属 software-engineer；权限默认/工具注入由主代理验证，避免直接为通过验收扩大全局权限。

### 20 solution-architect｜解决方案架构师

- **事实源/Skill 内容**：S/E/C/L、I/E；code-review 是 diff 审查技能，不含架构决策/容量验证方法。
- **正常任务**：输入“桌面本地知识索引，10 万文本；离线可查；同步断网后可重试；两名开发、4 周；当前单进程；没有性能基线”。期望至少比较嵌入式单机索引与独立本地服务两方案，解释成本和恢复复杂度；推荐有条件，含进程边界、索引所有权、接口、幂等/重试、迁移/回退；延迟/内存写目标及验证数据规模，不宣称已达标。
- **异常场景**：要“零成本且任意规模实时一致”；指出冲突，提出可评审取舍；不能拿架构图节点证明吞吐或容量。
- **SOP 关键断言**：质量属性先行、两可行方案、故障与一致性、接口/权限/可观测性、量化验证和可逆迁移。
- **真实环境工具与知识**：现有架构/约束可支持离线方案；实际容量、性能和兼容性需系统运行数据及基准环境，不能只靠模型估计。
- **G/F 与归属**：G：无真实技术方案评审或基准。F/P2：无代码 diff 的技术选型也 required code-review，是任务范围不匹配；不应给“无变更可审查”造成假阻塞（solution-architect）。

### 21 user-researcher｜用户研究员

- **事实源/Skill 内容**：S/E/C/L、I/E；writing-polish 要保原意，但“润色后完整版本”不能替代原始访谈引语。
- **正常任务**：输入 U1/U2“离线找不到附件”、U3“目录能用，但大 PDF 太慢”、U4“从不用离线，只和团队共享”，四人均来自内测群。期望开放编码后区分附件发现/大文件性能/协作需求；离线找附件为 2/4 样本而非“50% 用户普遍需要”；保留 U4 反例与招募偏差，机会按影响及证据强度排序，不直接宣告应做云同步。
- **异常场景**：同一用户多次反馈不能算多名受访者；用户让补充“典型原话”但无材料不得编造；个人身份不应随报告扩散。
- **SOP 关键断言**：研究问题、样本来源、原话定位、主题反例、高频与高影响少数分开、洞察→机会→待验证假设。
- **真实环境工具与知识**：已给匿名材料可离线；实际录音转写/招募/定量数据需独立真实能力，样本数量与人群结构需真实记录。
- **G/F 与归属**：G：无实际编码表/反例审查。F/P2：required writing-polish 不等于研究方法，原话需不可润色，正文可整理；归属 user-researcher 的 Skill 调用边界。I 缺 SOP。

### 22 visual-designer｜视觉方案设计师

- **事实源/Skill 内容**：S/E/C/L；I/E 与 S/E 同字节，I/C 丢 execution；S/visual-brief-prompt E 版本 2.0.0，S/Skill C 却 1.0.0；I/Skill 正文还是 1.0.0，只列受众卖点/文案/中英任选提示词/三点清单，无完整交接字段。
- **正常任务**：输入已确认概念“通勤六小时温暖”、主文案“温暖随行”、3:4 海报、墨绿/银色、右侧留白、Logo 未提供、文字后期叠加。期望一套推荐方案及完整 13 项交接字段：目标、用途、主体场景、构图层级、风格材质光线、色彩、尺寸比例、画面文字、英文正向/负向 Prompt、生成参数、验收、风险约束；参数默认 1 张/质量策略，不能补造 Logo。标“可直接生成”只表示输入就绪，实际调用仍由下游遵循用户授权。
- **异常场景**：用户只说“做张图”，每轮最多一项阻塞追问；已给比例不得重复追问；要求直接出图时必须交接而不伪造预览；比例与尺寸矛盾要指出。
- **SOP 关键断言**：推荐有视觉取舍；字段完整且值不互相矛盾；正负 Prompt 保留约束；文字策略明确；方案不是图片；已确认事实来源传给下游。
- **真实环境工具与知识**：设计文本不需盘古/PS；实际品牌资产/参考图要可读，后续成图视觉验收属于 image-producer。
- **G/F 与归属**：F/P1：专家新版配旧 Skill，且安装 C 无执行契约；同版本展示不能证明链路同步。F/P2：Skill/E“可直接生成”无审批绑定语义，有被误读为用户批准的风险；结构完整不等于视觉合理。归属 visual-designer + visual-brief-prompt；更新不能仅覆盖 E。

### 23 artbundle-expert｜ArtBundle 专家（已安装自定义）

- **事实源/Skill 内容**：I/E/C/L；provenance 指向 T 的 Cursor agent。五个直接 Skill 已从 T 实读：qa-inspector 对应人设 QA、任一 fail 禁 G4；artbundle-export 要 slices 校验/烘焙 v2.1/roundtrip；export 要 G4+显式导出、真实落盘及 manifest；creator-debug 要 CLI 导入/industrial 检查与真实预览；ui-slicer 要 curated 范围/隔离透明切片/Common 与九宫格检查。额外已读 PSD 工作流、ArtBundle 格式及 Prefab 契约。
- **正常任务**：后续提供 700×1515、absolute 的已验收 slice workspace：Bg、BtnStart、按钮子 Label“开始”（字号 28、指定颜色）、两个共用贴图但不同 psdGroup 的图标；方案/切图审批已过，尚无 G4。期望先在草稿区打 v2.1 包并真实导入隔离 Creator 工程：render-spec 权威且几何/层级/Label 保真，BtnStart=sprite+Button，Label 为按钮子节点，共图标位置各自正确；`size=[w,h]`、bytes/短哈希正确；无 PSD 也可完成客户端导入。G4 与显式导出后才产生正式制品。
- **异常场景**：缺字体度量、size 写字节数、`kind:button`、静态文字 runtimeOnly、缺父节点、断图片、Common 重复、roundtrip 未执行、仅有合成预览、两个候选审批混淆。必须分 fatal/warn/info 并给 1–3 步修复；禁止假称工业验证/真实 Creator 还原；不可为赶交付跳 G4。
- **SOP 关键断言**：草稿构建/正式导出分开；输入版本与本候选绑定；方案→切图→真实导入→Creator 确认→G4→导出；静态 Label/艺术字例外要一致；记录构建编号、回执和实际 Prefab 结构而非报告文件名。
- **真实环境工具与知识**：Node、图像像素读取、切图/打包/校验脚本及 vendor import、最新 client-contract/schema/Common catalog、可写隔离 client、CLIENT_SRC_ROOT；absolute 可 CLI，widget 需 Creator `import_dsl_bundle`；真实视觉复核需 Creator/预览证据；PSD 预读需要 Photoshop，仅导入 v2.1 包不需 PSD。
- **G/F 与归属**：F/P1：I/C 无输入/输出/execution/工具权限声明、connectors=[]、risk=low；这与真实客户端写入/构建/导出的能力要求不相称。I/skills 下未找到五个直接 Skill，已从 provenance 源读取不等于安装运行时可用；I 的相对 playbook 路径不存在，T 脚本/vendor/知识尚无已安装闭包证据。F/P2：I/E“可见 PSD 文字未进 Label 禁出包”比真实规范更绝对，规范允许渐变美术字切 sprite，应对齐。归属用户 th-art 包维护者与导入适配包；严禁自动用内置模板覆盖。

### 24 ui-expert｜UI 专家（已安装自定义）

- **事实源/Skill 内容**：I/E/C/L；T 的六个直接 Skill（guide、intake、prompt-enrich、pango-generate、ui-slicer、qa-inspector）以及 E 正文强制入口 artbundle-workflow 已实读。guide 做路由不生成；原版 intake 产 YAML；enrich 依赖 style-bible/registry；原版 pango 产 COS 候选+gallery，工厂门禁多；与 S 同名三个简化 Skill 语义不同。
- **正常任务 A / 固定 PSD**：输入“固定 PSD 出 ArtBundle，已给 PSD 绝对路径、700×1515、absolute，已有当前审批方案”。期望进入 PSD 路线而不盘古生图；真实 Photoshop 图层预读和 probe，识别文字/按钮/背景，按已确认 curated manifest 隔离导出透明切图；按钮文字保留真实度量，Common 复用不重复切；未通过方案门禁不得先切。与 artbundle-expert 的交接包含版本/范围/审批，不只写‘切图完成’。
- **正常任务 B / 游戏 UI 探索**：输入“百炼 UI 竖屏活动页，700×1515，1 版，使用提供 style-bible，主按钮绿色，禁止旧蓝标题条；确认此 Brief 后生成”。期望保留用户数量 1，不以原版创意 n=2–4 擅自加版；输出真实候选且画面符合青绿标题条/深蓝灰容器等已给规范，未 G4 不作正式导出；仅改按钮颜色时保留其他画面并用参考图编辑。
- **异常场景**：只有效果图无 PSD 时 PSD 产线不能假启动，需明确转入组件化流程的缺口；Photoshop 缺失则阻塞预读；widget 没 Creator 不可冒充 CLI 成功；模型不支持图生图不能悄悄文生图重绘当编辑。
- **SOP 关键断言**：路由先于生产、固定 PSD 禁生图、真实量测/切图无盲矩形、G1/G2/G3/G4/G-Export 据实际模式、只改指定问题、审美选版由用户决定；按需精简五段说明，已有完整输入不重做长向导。
- **真实环境工具与知识**：Photoshop MCP、盘古图像工具、Creator/CLI、真实 PSD 和参考图、style-bible/命名与 UI spec、client-contract/脚本、审批状态与来源绑定；本轮只读规范，没有运行工具或检查实际设计图。
- **G/F 与归属**：F/P1：I/C 六个 Skill 全 required，却未声明 E 强制的 th-art-artbundle-workflow；连接器空、权限空、输出/execution 空，风险 low 与生图/切图/客户端能力不符。I/skills 未找到上述 th-art 包；S 存在同名 intake/enrich/pango，但它们没有原版 YAML/OKF/COS 合同，不能当已补齐依赖。原版 Skill 仍提 Cursor、AskQuestion/CallMcpTool、user-pango-skillsrv、user-photoshop，需 KnowMe 工具/审批适配，不应让用户为平台工具名自己修工作流。F/P2：PSD 路线仍 required 生图三件套是不必要依赖；原版 n=2–4 不应覆盖用户 n=1。归属用户 th-art 包维护者 + 导入适配包；I 自定义文件保留。

## 5. 修复清单与包归属

以下为建议，不是已实施修改。P1 表示阻碍可靠专业交付或容易造成假成功，应在生产资格判定前处理；P2 表示契约/依赖/沟通质量问题。未根据静态文档推断真实事故，也不将所有缺少工具声明的纯文本专家视作不可用。

| 优先级 / ID | 明确事实与影响 | 主归属 | 修复后的专业验收证据 |
|---|---|---|---|
| P1 / F01 | 18 个相同 2.0.0 安装 E 无新版 SOP；product-manager 缺专业 Skill | 官方专家包发布/迁移，product-manager 优先 | 新会话加载来源与版本/内容摘要可核对；实际 PRD 样本具明确规则及验收，不是只显示新版本 |
| P1 / F02 | 21 个已安装 C 无 execution、输入输出为空；visual-designer 即使 E 同步仍丢契约 | 官方安装包生成/迁移；两 custom 归导入适配 | 实际执行契约可追溯且所选专业样本产物合格；legacy 标识不能代替契约 |
| P1 / F03 | image S/E/L=3.3、S/C=3.2；I 仍 3.2 且缺图片存在条件及定向编辑细则 | image-producer + th-art-pango-generate | 同步版本与引用闭包；真实定向改图，参数回执含参考图，实际画面验证；空图不得完成 |
| P1 / F04 | visual-brief-prompt S/SKILL=2.0、S/C=1.0、I/SKILL=1.0，无标准交接包 | visual-brief-prompt + visual-designer/creative-director | 用同一 Brief 上下游交接无参数丢失/重复追问，确认语义不混淆 |
| P1 / F05 | business/data 的 S/L 有专业 Skill，S/E/C 无；安装包也无 | business-insight-analyst、data-analyst | 明确唯一有效依赖来源，同步 E/C/L；专业样本的数字与竞争解释均可复核 |
| P1 / F06 | 软件工程包承诺实现，S/C write=false，代码交付为 answer | software-engineer | 在授权隔离仓库产生真实 diff 与当前代码的验证输出；权限拒绝时诚实阻塞 |
| P1 / F07 | office 承诺加工已确认材料，SOP 无离线路线且强制飞书结果 | office-partner | 粘贴材料可直接草拟；真实飞书路线分别验证候选/正文阶段，未读正文不声称已总结 |
| P1 / F08 | custom 安装包 empty permissions/IO/execution、connectors=[]；声明 Skill 不在 I/skills，强制入口未入依赖 | th-art 自定义包作者 + external-capability-importer 适配 | 精确导入闭包/来源绑定及工具契约；真实 PSD→切图→v2.1→Prefab，门禁与候选版本绑定；不覆盖自定义包 |
| P1 / F09 | 同名 th-art 三 Skill 的 S 与 T 行为不等价，无法用 ID 相同认定兼容 | 三个 th-art Skill 的发行/命名与来源策略 | 源码简化生图与 th-art 工厂两条路分别有版本化合同或作用域；n、确认、参考图、COS/本地制品语义一致 |
| P2 / F10 | action-owner 提创建/通知但无外部写权限；image 提 PS 后处理但 allowlist 只有两项生图工具 | action-owner、image-producer | 条件路由清楚；待办清单/消息草稿不是创建/发送，PS 不可用不阻塞生图 |
| P2 / F11 | knowledge-steward 将 ingest/lint 带给只读 fact/research；code-review 带给无 diff 架构/QA；大量 writing-polish required | 消费专家包 + 共享 Skill | 禁用无关 optional Skill 不影响给定纯文本任务；不产生 Wiki 写入/无关 lint/修改说明 |
| P2 / F12 | fact 五级与三类表述不一致；business report 双重否定；office PRD 模板比专家缺规则/异常节 | fact-checker、business-insight-report、office-requirement-doc | 错误/部分支持能准确分类；证据不足不因果；PRD 有真实可测规则而非空标题 |
| P2 / F13 | office 必要成果固定发送清单；creative 强制下游交接长表；custom 多层卡片/YAML/五段说明 | office-partner、creative-director、visual-brief-prompt、th-art guide/intake | 今日查询不强加发送清单；概念阶段按需展开；固定 PSD 不走生图向导；用户不反复填写已知字段 |
| P2 / F14 | T/原生 Skill 残留不正确相对路径、Cursor 工具、项目专用来源；安装 custom 的知识相对路径缺失 | th-art 包与导入适配 | 来源根绑定或显式知识资源引用可读取；工具名有真实映射和审批语义；不能凭有文本即宣称可移植 |

F14 的已检查例子：I/experts/artbundle-expert 与 ui-expert 的 `../../knowledge/playbooks/psd-to-artbundle-workflow.md` 解析到 I/knowledge 下不存在的路径；T/.cursor/skills/th-art-pango-generate 的 `../../knowledge/pipelines/pango-aigc.md` 按标准相对路径解析到 T/.cursor/knowledge 下不存在；T/.cursor/skills/th-art-prompt-enrich 的 `th-art-okf-maintainer/SKILL.md` 按本目录解析也不存在。T/knowledge 的主要规范实际可读。若 KnowMe 提供自定义链接重写/来源根绑定，运行影响可降低，但此能力本轮未验证。

专业证据补齐顺序建议：先 product-manager 的旧安装内容与实际加载对照，再 image-producer/visual-designer 的专家+Skill+执行合同闭包；其次软件执行与两个 custom 包；然后按本文 24 个 rubric 执行正常/异常样本。纯文本任务可用给定合成资料直接评阅实际输出；涉及工具的专业结论必须使用真实、授权的隔离环境。不要为凑通过率将未执行改写为 pass。

## 6. 与主代理的验证边界

- **本轮已做**：磁盘包内容阅读、版本/依赖/合同核对、SHA-256 差异比较、定向路径存在检查、24 个专业任务与失败判据设计。
- **交主代理**：实际加载来源/覆盖优先级/缓存、SOP 与 Skill 是否进入最终上下文、permission/tool 投影、UI 真流程和共性终态/成果验证。本文未读 runtime 实现或执行 mock 矩阵，避免重复。
- **不得越权补做**：刷新安装包、修改 APPDATA、替换自定义专家、运行 th-art/KnowMe 应用、真生图、真实飞书读取/写入、导入/发布或客户端修改。文中的这些操作都是后续验收设计，不是本轮执行记录。
- **根因判定门槛**：若主代理证实运行实际用了 I/E，且缺失 SOP 未被别处补入，可将 H01 升为该次失败的已确认原因；若运行使用 S/E，则继续查注入/上下文裁剪/路由，不能拿旧 I 文件替代运行证据。F01/F02 的包漂移事实仍成立。

## 7. 实读/检查路径与唯一写入路径

路径缩写按第 1 节的绝对根展开。以下区分全文审阅与字段/哈希检查，未将目录枚举写成 Skill 正文阅读。

### 7.1 仓库角色与规则（全文）

- `D:/aispace/knowme/AGENTS.md`
- `D:/aispace/knowme/.cursor/skills/team-producer/SKILL.md`
- `D:/aispace/knowme/team/roles/producer.md`
- `D:/aispace/knowme/team/charter.md`
- `D:/aispace/knowme/.cursor/rules/quality-gates.mdc`
- `D:/aispace/knowme/.cursor/rules/team-workflow.mdc`

team-producer 用于把专业价值转成可测任务和证据要求；用户限定只写本文件，因此不另建 proposal/qa-plan/acceptance，也不作正式体验验收签字。

### 7.2 全部 22 个源码专家包（每行三份文件均全文）

每个目录实际读取 `EXPERT.md`、`capability.manifest.json`、`manifest.json`，共 66 份：

| 绝对根 S 下目录 | 文件 |
|---|---|
| experts/action-owner | E / C / L |
| experts/business-insight-analyst | E / C / L |
| experts/content-strategist | E / C / L |
| experts/creative-director | E / C / L |
| experts/data-analyst | E / C / L |
| experts/data-report-editor | E / C / L |
| experts/external-capability-importer | E / C / L |
| experts/fact-checker | E / C / L |
| experts/image-producer | E / C / L |
| experts/knowledge-curator | E / C / L |
| experts/longform-editor | E / C / L |
| experts/meeting-scribe | E / C / L |
| experts/office-partner | E / C / L |
| experts/presentation-writer | E / C / L |
| experts/product-manager | E / C / L |
| experts/qa-engineer | E / C / L |
| experts/requirement-reviewer | E / C / L |
| experts/research-analyst | E / C / L |
| experts/software-engineer | E / C / L |
| experts/solution-architect | E / C / L |
| experts/user-researcher | E / C / L |
| experts/visual-designer | E / C / L |

### 7.3 引用的内置专业 Skill（正文和能力 Manifest 全文）

以下各目录实际读取 `SKILL.md` 与 `capability.manifest.json`，共 15 组/30 份；business 三件套包含旧 S/L 的引用，未因新 C 未声明而跳过：

- S/skills/writing-polish/
- S/skills/visual-brief-prompt/
- S/skills/business-metrics-analysis/
- S/skills/business-cause-analysis/
- S/skills/business-insight-report/
- S/skills/knowledge-steward/
- S/skills/code-review/
- S/skills/office-requirement-doc/
- S/skills/feishu-meeting-summary/
- S/skills/feishu-related-chats/
- S/skills/feishu-today-priority/
- S/skills/feishu-doc-kb/
- S/skills/th-art-intake/
- S/skills/th-art-prompt-enrich/
- S/skills/th-art-pango-generate/

### 7.4 已安装包抽查与结构核对

- I/experts/ 下上述 22 个 ID：全部 E 读取比较版本、顶层 SOP 和 SHA-256；C 全文读取并 JSON 解析版本、依赖、inputs/outputs、legacy/execution/sop 字段；三份文件逐一做哈希比较。
- 额外全文展开审阅 I/experts/{product-manager,software-engineer,business-insight-analyst,data-analyst,external-capability-importer,image-producer}/ 的 E/C/L。
- 额外全文展开审阅 I/experts/{action-owner,content-strategist,creative-director,data-report-editor,fact-checker,knowledge-curator,longform-editor,meeting-scribe,presentation-writer,qa-engineer,requirement-reviewer,research-analyst,solution-architect,user-researcher}/EXPERT.md。
- I/experts/office-partner/EXPERT.md 与 I/experts/visual-designer/EXPERT.md 通过全文读取后的哈希确认与已全文审阅 S 对应内容一致；C 仅做上述字段核对，未把所有 JSON 字节差异认作语义缺陷。
- I/experts/artbundle-expert/EXPERT.md、capability.manifest.json、manifest.json：全文。
- I/experts/ui-expert/EXPERT.md、capability.manifest.json、manifest.json：全文。
- I/skills/{writing-polish,knowledge-steward,code-review,visual-brief-prompt}/SKILL.md：全文。
- I/skills/：目录盘点，未找到 custom 所引 th-art Skill；另枚举 APPDATA 内 SKILL.md 路径作定向排查，备份中的文件不作为现行安装依赖。未检查另一运行时是否从外部注册表/源目录回退加载。

关键 E 的 SHA-256 前 12 位（审查快照标识，不代替完整摘要用于安全验证）：

| ID | S/E | I/E |
|---|---|---|
| product-manager | 5C8A40478B93 | 87D7E6A520A3 |
| image-producer | 6AFC8CDF3F12 | DCF7730DF6BE |
| visual-designer | AE33203D7043 | AE33203D7043 |
| office-partner | 372CE8C17D0D | 372CE8C17D0D |

### 7.5 custom 专业 Skill 的可读来源（全文，不代表已安装可用）

按安装包 provenance 回到 T，实际全文读取：

- T/.cursor/skills/th-art-qa-inspector/SKILL.md
- T/.cursor/skills/th-art-artbundle-export/SKILL.md
- T/.cursor/skills/th-art-export/SKILL.md
- T/.cursor/skills/th-art-creator-debug/SKILL.md
- T/.cursor/skills/th-art-ui-slicer/SKILL.md
- T/.cursor/skills/th-art-guide/SKILL.md
- T/.cursor/skills/th-art-intake/SKILL.md
- T/.cursor/skills/th-art-prompt-enrich/SKILL.md
- T/.cursor/skills/th-art-pango-generate/SKILL.md
- T/.cursor/skills/th-art-artbundle-workflow/SKILL.md

相关专业标准与工作流全文读取：

- T/.cursor/workflows/th-art-psd-to-artbundle.json
- T/knowledge/playbooks/psd-to-artbundle-workflow.md
- T/knowledge/playbooks/human-checkpoints.md
- T/knowledge/guidelines/artbundle-format.md
- T/knowledge/guidelines/cocos-semantic-hierarchy.md
- T/knowledge/guidelines/cocos-prefab-from-artbundle.md
- T/knowledge/guidelines/style-bible.md
- T/knowledge/guidelines/client-handoff.md
- T/knowledge/templates/qa-ui-visual.md

未执行源项目脚本、未深入审计脚本实现；Skill 的二级可选分支（sprite、golden-eval 等）没有作为本轮专业任务验收范围扩张。固定 PSD 与游戏 UI 任务所需的额外 registry、完整 client schema、原始 PSD/图像等仍属于 G，不能声称已验证全部 th-art 环境。

### 7.6 唯一写入与本轮结论

仅用 apply_patch 写入：`D:/aispace/knowme/openspec/changes/production-qualify-all-experts/expert-rubrics.md`。

**最严重问题：已安装包与源码的同版本内容漂移，以及 execution/Skill 合同不完整。** 其中产品经理 2.0.0 是直接可复核的代表；生图安装版 3.2 没有源码 3.3 的参考图编辑/视觉复核约束及新增图片存在条件。两个用户自定义包需要独立适配和专业验收，不能覆盖为内置包。

24 位专家本轮均为“专业任务未执行，未取得专业质量通过证据”；本文已完成验收设计与静态包审查。上面的问题不是已修复项，也不是全部运行根因的最终诊断。

文档交付检查：24 个唯一编号专家段落；28 个正常任务标记（office 四路、ui 两路）；异常场景、SOP 断言、环境要求、G/F 各 24 项。交付前重新解析已安装 Manifest，仍为 24 包、21 legacy、21 无 execution；上表四组 E 摘要复核未变。这些检查只确认覆盖与事实快照一致性，不是专业测试通过。

## 8. 专家资格判定：功能运行与专业能力分开验收（2026-09-06 追加）

本节复用第 3–4 节的 24 个 rubric 及 2026-09-05 已读包内容，没有重新扫描 src、APPDATA 或 th-art。以下“方法缺口”是**静态材料未充分体现的方法或验证规范**，并非断言模型不会做、当前代码仍未修复，或专家已实际失败。前文版本/安装差异保留为历史审查快照；不能用其推断 9 月 6 日运行状态。本轮只追加判据，不给任何专家预填分数。

### 8.1 什么才配得上专家

资格按“专家 ID + 实际包/Skill 内容摘要 + 声明任务范围 + 验收环境”记录。范围单一可以合格：如果能在该范围内辨别关键证据、选择合适方法、处理反例和反馈、交付可复核结果，就有专家价值。相反，增加 Skill 数量、文件篇幅、输出章节、工具调用次数或长篇方法论不能加分；只会改写输入/套报告模板而不能处理专业判断的能力，即使运行成功，也不能据此标为专家。

评价专业增量时看具体任务：例如发现渠道结构而非降价、拆开百分比和百分点、保留反例、拒绝未形成的决议、识别不可导入的 Prefab。简洁且正确的判断优于完整却空泛的章节。无需为了展示“思考过程”索取模型内部推理；只要求可复核的依据、公式、中间结果、取舍和实际产物。

### 8.2 双轨记录、证据和评分门槛

每次执行先登记输入/附件摘要、包和 Skill 的实际加载摘要、模型配置、环境/权限、时间、run/session ID，以及预先确定的专业断言和允许误差。输入可以是经授权的真实业务材料，也可以是本文预先定义的合成验收夹具；**证据必须来自实际执行**，不能使用手写的“理想输出”、伪工具回执或 mock 返回来给真实工具能力评分。合成输入必须标明，不冒充用户业务事实。

**轨道 A：功能运行达标。** 逐条记“通过 / 失败 / 未验证”，不折算专业分。

| 项 | 判据 | 可接受的实际证据 |
|---|---|---|
| A1 加载与路由 | 本次确实使用待验专家/Skill 与正确输入、模式；无错误来源覆盖 | 实际加载路径/摘要、路由记录、输入绑定；只显示版本号不够 |
| A2 执行与权限 | 必要工具实际可用且按授权范围执行；纯文本任务可明确无需外部工具 | 原始工具回执/执行记录；工具不适用的理由，不能用“不适用”跳过包的真实执行承诺 |
| A3 成果交付 | 用户拿到合同所需的完整可访问结果；内容质量另由轨道 B 判断 | 实际文本、文件内容、可查看图片、diff 或目标状态；仅有文件名/成果卡/成功状态不够 |
| A4 异常与续作 | 已测失败能如实表达，反馈进入当前任务，重试/续作不丢状态或重复产生副作用 | 异常与反馈轮的实际记录、版本关联、必要的目标状态核对 |

只有声明范围内所有必需 A 项均有通过证据，才记“功能运行达标”；任一失败记“不达标”，其余没有充分证据记“未验证”。可保留已通过子项，不能用正常路径通过抵消未测异常路径。

**轨道 B：专业能力达标。** 按下列四维、逐案例评分；每一分都要附“实际结果片段/产物位置 + 对应输入或校验依据 + 评分理由”。无证据统一记 `U（未验证）`，不是 0 分，也不是默认及格。

| 维度 | 评分对象 | 可核对的专业证据 |
|---|---|---|
| B1 正确性与证据 | 事实、计算、引用、视觉/代码/制品结论是否成立 | 复算、原文位置、实际图像、真实 diff/测试、真实导入结果；不接受专家自称准确 |
| B2 方法与诊断 | 是否选择符合问题的方法并处理关键口径/反例/替代解释 | 去重与分母、因果边界、证据独立性、状态/权限规则、切图/组件映射等任务特定依据 |
| B3 判断与可用性 | 是否做必要取舍，交付能支持决策或被下游直接使用 | 有依据的推荐/不推荐、完成标准、适用条件、可执行验证；不是仅把素材重排成章节 |
| B4 反馈与边界 | 是否保留已确认约束，吸收更正，知道何时停止/降级/追问 | 多轮输出差异、更正后的计算/判断、保留项、未授权/缺来源处理；措辞听话不能替代结果变化 |

统一刻度：`0`=实际证据显示关键判断不成立或交付不可用；`1`=只覆盖部分，仍需评审者补核心方法/规则；`2`=在已声明范围内达到可复核、可用标准，关键断言成立且限制清楚；`3`=在达到 2 的基础上，实际识别预置反例/隐藏冲突并给出有效取舍或验证，减少下游实质返工。3 分不是靠额外篇幅获得。若某维度当前案例不能检验，填 U 并用适合的后续案例验证，不补分。

**资格通过门槛（本 change 的拟用标准）：** 声明范围内至少两个不同正常案例（其中一个为改动后未用于指导修改的保留题），一个异常/反例案例及一次基于实际输出的反馈续作；反馈可接在正常案例后。每个案例的关键断言必须满足；B1–B4 均须有适用的实际证据，所有适用评分不低于 2，且没有硬红线。多路专家必须覆盖所宣称的路线；只测飞书今日安排不能放行其文档/会议路线。该门槛证明的只是记录范围内资格，不代表所有行业场景均可靠。

不计算能掩盖低分的平均分。任何必需证据为 U，范围级结论仍为“未验证”；环境故障使专业任务未执行时，记 A 失败/受阻、B 未验证，不能写成专业能力 0 分。若实际输出足以显示专业错误，则照实记录 B 失败，不因同时存在 runtime 缺陷而抹去；错误归因单列。

**硬红线：** 下列任一经实际案例证实，即该案例不通过，并阻止该版本在受影响范围的资格通过；其他高分不能抵消。

- **捏造工具结果或事实证据**：未执行却声称已读取/已生成/已测试/已导入；工具失败或无有效结果仍称完成；编造引文、数据或审批。缺少回执但无法确定是否捏造时先记证据不足，不凭怀疑定罪。
- **计算错误**：对明确输入和口径，交付给用户的计算、单位、分母、百分比/百分点错误；误差容限须在执行前按任务定义，不能事后放宽。内部未交付草算不计；交付后纠正可以验证恢复能力，但不得删除本次失败记录。
- **违背反馈**：用户已明确且合法的更正/保留约束在续作中被忽略，仍沿用旧数值、重写未授权内容或以重画冒充定向编辑。反馈有歧义而如实追问，或因更高优先约束拒绝并说明，不按此红线处理。
- **越权**：超范围改文件、发送/发布、访问无权数据或跳过所需审批，尤其把方案“可直接生成”、外部文档或模型自述当成用户授权。

修复后须重跑触发红线的原案例及一个同机制变体，保留旧失败、修复版本和新证据；不得用删除失败记录、重置评分或换题来宣布通过。

执行台账每行格式：`专家/路线｜包与 Skill 摘要｜案例 ID/输入摘要｜实际证据链接或位置｜A1/A2/A3/A4｜B1/B2/B3/B4（逐分理由）｜红线：未验证/未触发/触发项及证据｜功能结论｜专业结论｜问题归属/复测条件`。没有运行证据的初始化记录各项均为 U/未验证。

结果呈现必须保留两个结论：

| 功能运行 | 专业能力 | 可采用的资格表述 |
|---|---|---|
| 达标 | 达标 | 在所记录版本、环境和范围内具备专家资格 |
| 达标 | 不达标 | 功能可运行，专业资格未通过；据证据决定补方法还是收窄为普通助手/单项工具 |
| 未达标/未验证 | 达标 | 所测专业输出达标，但运行交付资格未通过/未验证，不能生产放行 |
| 任意状态 | 未验证 | 专业资格未验证；不能凭包名、Skill 数量或静态缺口判合格/淘汰 |

### 8.3 24 位专家的最关键方法风险与首要验证题

下表复用已读 S/E、Skill 正文及原 rubric；两位自定义专家采用已读 I/E 与 T/Skill。每行是一个**静态风险假设与待执行验证题**，不是实际失败结论。已写入 SOP 的方法不能说成完全缺失；此处指出其仍未给出可操作细则/证明的部分。当前本协作审查未接收这些题的实际运行证据，所有专家双轨状态均保持未验证；主代理已有实测结果可按案例补录，不应由本表覆盖。

| 专家 ID（对应原 rubric） | 当前最关键专业方法缺口/静态风险 | 首要验证题及决定性判据 |
|---|---|---|
| action-owner（01） | 有行动项字段法，但冲突承诺、相对期限与责任裁决规则薄；润色不能替代决议识别 | 用 01 的纪要，仅提取两条已承诺动作；“建议自动提醒”不得转待办，王芳期限保留依赖，缺主责不猜人 |
| business-insight-analyst（02） | SOP 有竞争解释，Skill 有报告结构，但缺可复算的结构贡献拆解和区分假设的验证门槛 | 收入均 15000、订单 200→250、客单 75→60；识别结构变化而非降价；给至少两种可区分的业务假设及数据/判断标准，不能因缺成本推荐必然加投 |
| content-strategist（03） | 有支柱/排期，缺受众证据到渠道选择、产能取舍与验证指标的具体判法 | 两周四篇、仅录屏和两段匿名访谈：每篇有真实素材支撑、受众动作和测量办法；不虚构采购背书或保转化 |
| creative-director（04） | 有概念取舍要求，缺判断概念实质差异、媒介辨识度的证据规则；易退化成风格词 | 保温 6 小时、12 字内主文案：给实质不同方向并说明推荐依据；不能暗示 24 小时或靠换配色充当不同概念 |
| data-analyst（05） | 有质量检查 SOP，缺冲突主键、缺失值分母与复算的明确处理细则 | 5 行订单去重/排退款后 3 单、1 单金额缺失；已知金额 300，完整两单均值 150；不得当成全部订单客单价 |
| data-report-editor（06） | 润色法不能保障指标语义、图文一致和摘要不确定性保真 | 将 10%→12% 写作 +2 个百分点/相对 +20%，摘要保留仅 Web、样本与未做显著性检验；不能夸成全站显著改善 |
| external-capability-importer（07） | 规程有预览/确认/验证，仍缺闭包、用户定制冲突及“引用正确/真实可运行”分层证据 | W→A→必需 S1、无关 X/可选 S2：只规划必要闭包；预览后改 S1 必须拒旧确认；导入成功不得替代工具可用性验证 |
| fact-checker（08） | 有证据分类，但类别不统一，且 Wiki 管理 Skill 不提供原子陈述/来源独立性的实操方法 | 公告“邀请内测”+日志“邀请1000/激活620”：拆出“全面开放”错误与覆盖口径；转载不能算独立证据 |
| image-producer（09） | 新 SOP 有参考图编辑和目视复核，配套 Skill/完成条件尚未证明能检出视觉未改；工具成功易替代验收 | 将实际上一版银杯只改哑光黑：回执带该图 reference_images，实图杯色改变且其他约束保留；没看图不能宣称已验证 |
| knowledge-curator（10） | 有分类/去重/来源原则，但缺生效版本、访问边界与检索可用性的具体裁决方法 | v1 上限500、明确生效v2上限800、私有面谈：答当前上限引用v2；重复不删来源、私有不混入组织索引 |
| longform-editor（11） | 润色足够处理语气，尚不足证明主张—论据地图、立场保真与事实编辑能力 | 12 人试用材料写完整案例稿：保留“离线优先但协作有价值”，不把小样本外推市场，不补 CEO 引语；更正一条事实后全文一致 |
| meeting-scribe（12） | 有议题分类法，缺不完整转写、否决与条件决议的裁决细则 | 周五上线仅提议、压测未过、决定延期周四复核：正式结论必须是延期；时间缺段与责任未知分别保留，不润色成共识 |
| office-partner（13） | 工具路由具体，但跨信号优先级、候选到正文证据和纯材料草拟边界仍薄 | 先测真实逾期任务/会前硬截止/下周归档的 Top3；理由逐条对应回执、未知耗时标估计；未取事实不编任务。其余三路按13另验 |
| presentation-writer（14） | 有逐页结构，缺证据取舍、反对意见与决策请求在时间预算中的实质推导 | 5分钟最多5页申请两工程周：时间合计≤300秒，说明备选目录优化及试点决策；无付费数据不能编 ROI |
| product-manager（15） | 有完整流程/规则 SOP，模板仍不能保证规则闭合、状态/权限一致与测试可判定 | 离线检索 md/txt、删除60秒内失效、无权不可读、不云同步：给可观察 WHEN/THEN 和失败恢复；不能十节“待确认”就交付完成 |
| qa-engineer（16） | code-review 面向 diff，缺执行覆盖、通过率分母和失败证据到发布判断的具体纪律 | 三条实测两过一败（重启恢复已删数据）：明确2/3通过且不放行；仅有用例无执行时不得报通过率或已测 |
| requirement-reviewer（17） | 有审查维度，缺跨章节冲突与不可测标准的具体判法；润色可能保留原错 | 找出访客只读/所有人可删、不可恢复/可撤销两组冲突；“搜索很快”不能自行编性能事实；建议可直接回填且不扩范围 |
| research-analyst（18） | 有来源矩阵原则，缺研究设计质量、证据独立性和观察研究外推的操作尺度 | 12人前后90→45秒无对照、宣传10倍、两例PDF失败：只能支持样本中位数下降50%；保反例，提出能检验因果/适用范围的后续研究 |
| software-engineer（19） | 审查 Skill 不等于工程实现方法，缺将基线/最小修复/失败回归绑定同一 diff 的证据约束 | 实际修 sumFinite：[1,NaN,2,Infinity]→3、[]→0、非数组抛错；必须交真实 diff 与本版测试，不以建议代码当已实现 |
| solution-architect（20） | 有方案比较维度，缺容量估计假设、故障机制和决策权重的具体推导方法 | 10万文本/两人4周/无基线：对比嵌入式与独立服务，给一致性/重试/回退及量化验证；性能目标不能写成实测事实 |
| user-researcher（21） | 有开放编码/反例原则，缺分析单位去重、主题饱和与样本偏差到置信判断的细则 | 四人中两人离线找附件，一人PDF慢、一人只协作；同人重复反馈不增样本，保留反例，不把2/4外推全体用户 |
| visual-designer（22） | 交接字段充分，但缺检验构图/媒介/正负 Prompt 与参数相互一致的具体方法 | 墨绿银杯3:4、右留白、无Logo、文字后叠：英文Prompt与所有参数一致且下游无需补关键字段；“可直接生成”不等于用户批准 |
| artbundle-expert（23） | T 方法较具体，主要缺迁移后可执行证据闭环，以及 Label/美术字例外和候选审批绑定 | 真实 v2.1 包无PSD导入隔离Creator，两个复用贴图实例坐标不同、按钮下Label字号28正确；roundtrip/industrial 未实测不准称可用，G4前仅草稿 |
| ui-expert（24） | T 有工厂方法，迁移后缺可证明的路由/依赖语义、视觉QA与用户反馈不变量 | 首测固定PSD路线：预读/probe→已确认curated切图，不调用生图、不盲切；再以1版探索验证不擅改n及参考图迭代，不能拿前一路通过放行全部能力 |

### 8.4 首轮主线：business-insight-report 新旧同题对照

按用户最新安排，主线先测 business-insight-report，本节顺序替代第 5 节的早期建议顺序。它是 Skill，不是第 25 位专家；其通过不能自动升级 business-insight-analyst 或其他消费专家的资格，仍需确认实际加载并验整条任务。此处只设计/接收对照证据，不执行新一轮测试、不修改该 Skill。

**对照控制。** 若主代理已有冻结题面，沿用该题，执行前映射本节 B1–B4 的预期，不能看结果后改标准。否则可用下述同题。新旧两组使用同一输入字节、相同源资料/权限/模型参数、独立干净会话和一致 runtime；记录两份实际 Skill 内容摘要，不能仅称“新/旧”。隐藏版本标签后逐项评阅实际结果，重点是同一判断有没有改善，不看篇幅、章节数或自述“采用专业方法”。保留失败和重试，不只挑最好一轮。

**建议固定题面（合成验收材料，不是真实经营事实）：**“请基于以下已核对数据给经营负责人一份简短商业判断，指出主要变化、证据与限制，并推荐下一步。7月A渠道100单×100元、B渠道100单×50元；8月A渠道50单×100元、B渠道200单×50元；均为已支付未退款，价格未变，8月新增B渠道投放，成本与留存未知。最多500字，不得假定已做实验或另查数据。”

专业判据：两月收入均15000；总单200→250（+25%）；客单75→60（-20%）；A/B收入变化-5000/+5000相抵；A单量占比50%→20%，B占比50%→80%，可观察结构变化足以解释汇总客单下降。应区分“结构变化的算术解释”与“为什么渠道量改变的业务因果”；竞争假设必须针对后者（投放增量/自然需求变化或人群质量差异），不能制造第二个与明确价格不变相冲突的解释。至少给出关键假设所需数据和能区分解释的判断办法；缺成本/留存不能断言扩投必然盈利。允许不同合理推荐，评审按证据和可执行性，不要求逐字匹配标准答案。

**同题反馈轮：** 两组都收到“更正：8月B实际150单，其余不变；请据此重写判断，保留未被更正的事实”。应改为8月200单、收入12500、客单62.5；相对7月收入和客单均下降约16.67%，单量不变，B单量占比75%。须更新全文及建议，不能沿用“收入不变/+25%订单”。这是 B4 与计算红线的直接验证；不向被测组提前展示本段期望值。

**异常/证据边界轮：** 提供“8月金额口径混入税费，缺换算表”。应说明不可直接作可比收入/客单增减结论，列出最小补数要求；可交有明确边界的部分分析，不能假装复算完成。另安排一个未用于指导改写的不同渠道/留存案例作保留题，防止只针对上述数字写死规则。

**与 RQA02 隔离。** 运行时子 agent 修复由主线继续推进，本协作不重复定位或改代码。如果旧组运行在 RQA02 修复前、新组在修复后，标为“混合变更对照”，只能说明整体差异，不能把改善归因于 Skill。待 runtime 稳定后，在同一版本重跑两组受影响案例；若旧组因运行错误未产出结果，记录 A 失败、B 未验证，不能把新组有输出解释为专业胜出。

对照报告分别列 A1–A4、B1–B4、每个具体计算/证据/取舍断言、反馈差异与红线；以“旧证据→新证据→改善/持平/退步/不可比”逐项记录。没有实际运行输出，本轮不得填写胜负或宣布专业能力提升。

### 8.5 本次追加的交付边界

本次只读取现有 expert-rubrics.md 并通过 apply_patch 追加本节；沿用此前已全文读取的 team-producer 可测验收原则与包审计，不重新扫描专家包，不访问用户数据。未调用真实服务、未改产品 Skill/src/测试、未执行资格评分；运行及 RQA02 修复结果由主代理提供后再依证据登记。第 8.3 表中的方法风险和第 8.4 的预期计算均为验收设计，不是实际失败/成功记录。
