# RQA23：数据分析方法、装配与升级只读复核

日期：2026-09-06。范围：当前仓库 data-analyst、三个绑定 Skill、保存的 RQA22 证据及通用装配/安装源码。未修改源码、包、评分或用户数据，未调用模型、QA、安装 API 或完整检查。本报告不重新评分，也不证明方法升级的专业效果。

## 结论

1. 未发现 data-analyst persona/SOP 要求把相关性说成因果，或与方法相反的指令。核心方法已有因果限制；可选 business-cause-analysis 更明确写着“组内变好也不能证明改版无害”。因此不能把失败简单归因于完全缺少原则。
2. **绑定/安装三个方法不等于三个方法正文进入模型。** 当前正式执行默认与每个交付物只要求 data-analysis-method；另外两个是可选依赖。本次保存的 RQA22 导出不足以证明可选因果方法的具体警告进入同 run L1，也不足以证明模型忽略了该句。
3. RQA22 答复的专业矛盾确实存在：数字正确，但用观察到的组内优势否定改版伤害。此次首次验证通过、没有 FINALIZE，不能归因于 repair，也不能用于证明 repair 有效。
4. 存在独立的版本漂移：两个 business-* Skill 的正文/sidecar 为 1.1.0，catalog 仍为 1.0.0。通用 curated 安装会使用 catalog 版本记录安装项，但规范化 sidecar 可保留其自身版本。后续修改必须对齐，不应只改正文。

## 专业矛盾与方法边界

证据：`evidence/rqa22-data-analysis-run.json`、`rqa22-data-analysis-grading.md`、`rqa22-main-integration-2026-09-06.md`。

- task：`task-mtpfjl7x-wrrq6`
- session：`wb-expert-task-mtpfjl7x-wrrq6`
- run：`expert_task-mtpfjl7x-wrrq6_mtpfjlqo`
- 正文 SHA256：`41c3400fa60852148d7751c358a712c6eb657e45552f652109eb9f923a34ad79`

原答复写“总体数字反映的是……结构性差异，而非改版本身的伤害”，并称“新版伤害所有客群”与分群数据“直接矛盾”；随后虽补充非随机混杂限制，前面的排除性判断仍未成立。保存评分为 6/7、E4 失败，算术 40%/-10pp 及组内变化正确。非随机组间优势不能识别同一目标群体的反事实效果；原评分提供了仍符合观测、但两组均可能受到伤害的反例。本报告保留该结论，不重写期望或评分。

三方法的现有职责：

- `src/catalog/skills/data-analysis-method/SKILL.md`：行/实体、集合分母、缺失冲突、逐项复算；第 34 行附近区分观察差异、算术分解、因果假设，要求最小对照与支持/削弱解释的结果。未明确展开“组内更好仍可能有害”的反事实检查。
- `src/catalog/skills/business-metrics-analysis/SKILL.md`：口径与可复算分解、随机设计和分析人群检查；分解不是因果识别。计算工具不可用时允许简单手算，不允许伪造执行。
- `src/catalog/skills/business-cause-analysis/SKILL.md:22`：明确未识别与无害不可证，要求竞争机制/最小反事实、可逆决策和护栏，而非只在末尾添加“不确定”。

最小候选方向：在核心必需方法中用简短通用步骤强制检查“决策结论是否需要尚未识别的因果前提”，对兼容观测的竞争机制做反例检查；将建议的可逆性、护栏与待识别效果分开。共享因果方法可同步精简强化这一操作，但不能只重复警告、嵌入本题数字/答案，或为专家 ID 加运行时豁免。若选择把因果方法升级为每次任务必需，须明确承担额外上下文成本和任务适用性；不是本报告的默认建议。

## persona、路由与实际上下文

`src/catalog/experts/data-analyst/EXPERT.md` 的五步 SOP 已要求证据、口径、竞争解释、因果边界及修订后全量复算；systemPrompt 要求完整可靠交付，但没有要求得出正向效果。canonical 权限全 false/空，绑定三个方法不授予外部工具权限。

源码链路：

- `expert-runtime.ts`：`loadExpert` 加载正文、legacy 元数据与 canonical manifest；`createSessionSnapshot` 保存专家配置与 Skill hashes，不复制 Skill 正文；`getSessionPersona` 优先会话快照。
- `expert-agentic-profile.ts`：显式 SOP 已存在时，不再把 systemPrompt 当作另一套 SOP。未见相反 persona 或重复的因果结论要求。
- `expert-execution-profile.ts`：`resolveOutputSpec` 合并默认 route 与选中交付物契约，去重 requiredSkills；自定义 primary 保留用户 id/title/type，同时得到默认核心方法。不会把全部安装依赖变为必需方法。
- `expert-task-runtime.ts`：必需 Skill 预检；执行传入 `skillRefs: outputSpec.requiredSkills || []`。
- `agent-context-assembly.ts`：显式 refs 才进入完整 L1 加载路径，截断会拒绝；自动匹配主要生成 L0 摘要。persona.sop 的装配优先级 86、显式 Skill 内容 74，表示上下文选择/预算优先级，不能据此推定冲突时的模型行为。
- `context-engine/assembler.ts`：普通 persona/Skill 不是提升工具权限的系统授权。绑定、依赖、路由和 L0 多处出现，不等于重复加载多份完整正文。

RQA22 保存导出中，`session.session.expert.source` 为 `snapshot`；即使 snapshotPath 为空，也不能反推没有快照。保存 SOP 与上述五步一致，soul 为空；assignmentSnapshot agentVersion 为 2.1.0，agentHash 为 `42dacb9aa498a21d`。三个绑定均显示 ready，自定义 primary 的 requiredSkills 仅为 data-analysis-method、requiredTools 为空。导出的 available/loaded=0 是工具诊断，不是 Skill L1 数量。未保存足以复核该 run 完整 Skill manifest/L1 正文的内容；不能用此前 RQA20 的另一个 run 代替此次接收证据。

## business-cause-analysis 的 catalog 消费者

对 `src/catalog` 全部文件进行精确引用检索，当前专家消费者只有：

| 专家 | 依赖/交付关系 | 改共享方法的影响 |
|---|---|---|
| data-analyst | canonical 可选依赖；默认及两个交付物仅必需核心方法 | 安装、绑定不保证当前任务加载该正文 |
| business-insight-analyst | canonical 必需依赖；合并的主交付物同时要求 metrics、cause、report | 实际加载共享方法的任务将受正文升级影响，需回归 |

其余 catalog 引用为该 Skill 自身条目/sidecar，以及 `src/catalog/snapshots/catalog-contract-{business-insight-analyst,data-analyst}/manifest.json` 历史契约快照，不是额外活跃专家。Skill experience 还声明 `businessCauseAnalysis`，可用于 scene/workflow；影响不限于 data-analyst。不要为此次候选自动改历史快照或共享运行时。

## 安装/升级接口及版本对齐

通用路径是 preload `window.knowme.capability.install(payload)`（兼容别名 `capabilityInstall`）→ `capability-hub/ipc.ts` → `capability-hub/lifecycle.ts:installCapability` → `capability-import.ts:installCurated` → `capability-store.ts:installFromStaging`。没有发现需要另造的公开 capabilityBuild API；Skill 目录由通用 staging/manifest 构建安装，不要求重编应用或 renderer。

`installCapability({id, enabled, riskConfirmed})` 从当前解析到的 curated catalog 取目录并复制当前内容。同 ID 可走已有替换安装路径，不会递归升级全部专家/依赖。`updateCapability({id, riskConfirmed})` 复用安装但设置 enabled=true；若需保留禁用状态，应显式传入 install 的 enabled。目标 profile 由服务创建时的 `getUserData()` 决定，payload 不选择 profile。因此仅 main 应在已确认身份的隔离 QA 进程调用，只升级指定方法 ID；本轮未调用这些接口。

关键实现：`capability-import.ts` 的 `buildUnifiedManifest`/`finalizeInstall`；`capability-manifest-v2.ts` 优先 raw.version；`capability-catalog.ts` 从 sidecar 补元数据但不覆盖 catalog 外层 version。若版本不齐，安装 store、正文与 canonical 可产生不同版本。实际解析目录也可能受 catalog overlay/bundledRoot 影响，不能仅凭仓库目录推定 QA 将安装什么。

| 对象 | 正文 | canonical sidecar | legacy manifest | catalog.json |
|---|---|---|---|---|
| data-analyst | 2.1.0 | 2.1.0 | 2.1.0 | 2.1.0 |
| data-analysis-method | 1.0.0 | 1.0.0 | 无 | 1.0.0 |
| business-metrics-analysis | 1.1.0 | 1.1.0 | 无 | **1.0.0** |
| business-cause-analysis | 1.1.0 | 1.1.0 | 无 | **1.0.0** |
| business-insight-analyst | 2.2.1 | 2.2.1 | 2.2.1 | **2.0.0** |

需要对齐的精确文件：每个实际修改的 Skill 的 `src/catalog/skills/<id>/SKILL.md`、同目录 `capability.manifest.json`、`src/catalog/catalog.json` 对应 entry。若同时改专家 SOP/依赖/路由，再对齐 `src/catalog/experts/<id>/{EXPERT.md,capability.manifest.json,manifest.json}` 与 catalog 专家 entry。仅改共享 Skill 正文时，无须机械抬升所有消费专家版本，但必须披露下游方法变化；已有 business-insight catalog 漂移应由主线明确处置，不由本审查代改。

`skill-runtime.ts` 每次查找/加载从已安装目录读取 Skill 正文；`capability-hub/runtime.ts` 使用安装根创建 runtime。Skill-only 升级不等于刷新旧任务专家快照。建议 main 等运行结束再升级，对新任务保存安装回读版本/hash，以及同 task/run 的 skillRefs、L1 hash/chars/truncated 与上下文接收证据；不要覆盖旧记录，不把安装成功视为模型接收成功。保持其他包、工具权限及 QA 进程身份可比；若修改了多项，明确这是整包/多方法对照而非单 Skill 因果结论。

## 取证与限制

使用 gitnexus-exploring；query 无匹配且 FTS 降级，context 找到 installCurated 直接调用者但无可追踪 process。query 的索引时间警告与 repo context 的 2026-09-06 时间不一致，且 scope-extraction-unverified，因此以当前源码复核为依据，不以 UNKNOWN 或索引结果证明安全。本轮未做全系统认证、测试重跑或真实安装验证。

只读检查时 SHA256：

```text
data-analyst/EXPERT.md 42dacb9aa498a21d49061b0f9caa36654a3d6a09d586d96553360039df1eca2b
data-analyst/capability.manifest.json 642774880ab8e5a8234ab5ca3820ab8e304e614971c49fa092c9325a68cd2c66
data-analyst/manifest.json 6007ec37f979060ac12ce34d2a2939239660780a49c24ce87f1e759373503569
data-analysis-method/SKILL.md c3a2650715fe87dca6a8fd139c61457b8ea8656ef9c5b3a3ed25589f349ecfc2
business-metrics-analysis/SKILL.md 3ef3e084c6c28bded806a70992559e6c0870cbb2ae8c47bc4350797415770c76
business-cause-analysis/SKILL.md 7c682168641059e6bc4fce450e7923ddddbb53c895dda6cc0a3c19439007f736
catalog.json 48a64a89f76eefeaf6b5ec5f0efcd4318a1c44a3f7ff31ae7c0a5029296826f8
```

以上是审查时磁盘内容，不代表隔离 QA 的安装字节或已加载模块；并行改动后应由主线重新锁定候选 hash。

## 追加：核心方法 1.1.0 有界复核

主线告知仅修改核心方法正文、canonical 与 catalog 版本后，重新全文读取当前方法并核对版本/hash。未读取新冻结案例内容，未运行模型或安装；以下是相对于本报告先前已全文读取的 1.0.0 的内容复核，不冒称 Git 提供了完整历史差异（该路径的本次 git diff 未输出可用差异）。

结论：未发现本次方法改动的阻断项，不需要运行时 ID 特判或额外权限。原有集合、分母、缺失/冲突、计算及修订后重算约束仍保留。新增重点是：先区分观察差异、反事实影响和行动；区分被证据支持、被事实反驳、尚未识别；用兼容观测的竞争机制检查方向；核查条件句的前提是否充分，并同步撤回依赖过强结论的建议。它比重复“相关不等于因果”更可执行，也允许可信识别设计支持相应范围的效果结论，并未一概禁止分析推断。

未发现旧题专属数字、任务 ID、固定答复或强制输出数字反例；对选择偏差、未测因素、缺失及等效/安全结论的约束具有通用性。明确不要求所有问题做随机实验、不把核查等同因果证明、允许受约束的条件行动，降低了一律拒答或无限收集资料的风险。残余风险是模型仍可能只复述原则而未实际检验关键推论，以及在简答预算中投入过多解释；只有新旧同题真实结果能评估，文本审阅不能宣布专业达标。

核对结果：

- 核心方法正文、canonical、catalog entry 均为 **1.1.0**；canonical 权限仍全 false/空，无新增依赖。
- data-analyst 三件套 hash 与上表一致，仍 2.1.0；business-cause-analysis 正文 hash 与上表一致。此次不是把可选因果方法改为必需。
- 当前核心 SKILL.md 全文件为 **2111 个 JavaScript 字符**（含 frontmatter），不是实测 L1 chars，也不据此断言未截断或模型已收到。
- 核心正文 SHA256：`447bc23b8c56af9859c815e2d61b13a231d520ce50195c33cc701482bdc81a02`。
- 核心 canonical SHA256：`ed8684b82794cdfb87822d44551a0a488352379cdf07d92d61943872689d97a2`。

主线声明隔离 QA PID 9072 仍装核心 1.0.0，将先跑两个冻结基线，再通过 capabilityInstall 只更新该 Skill 并复跑相同输入。本轮未独立读取该 profile 或确认进程状态。后续四 run 审计应分别绑定 task/session/run、安装版本与正文 hash、实际 skillRefs、L1 chars/hash/truncated、上下文 manifest；有保存请求体时再核验实际模型输入。若只证实装配而无请求正文，应明确这一证据层级，不把目录 hash 当作模型接收证明。保留旧运行与安装证据，升级前等待基线结束；不会以同 PID 声称全部传递依赖冻结。

## 追加：四次真实运行的同 run L1/context 审计

本节依据实际读取的指定隔离日志、四个 run 的 state/events，以及随后落盘的 `evidence/rqa23-old-runs.json`、`evidence/rqa23-new-runs.json`。不再仅依赖主线口述安装结果；未写入 profile，未调用模型/安装/API，也未评分新题正文。

隔离根：`D:/USERCA~1/Temp/knowme-expert-qualification-e3808573825e42908aef0a0f2d0f20de`，文件系统展开为 `D:/UserCaches/Temp/knowme-expert-qualification-e3808573825e42908aef0a0f2d0f20de`。下表行号属于其 `logs/knowme-2026-09-06.jsonl`。每个 run 均由 `agent-runs/<runId>/state.json` 的 sessionId、同目录 events.jsonl，以及导出 task.executionEvidence.runId / session.run.artifacts.meta 交叉绑定，不用相邻日志时间猜测身份。

| 阶段/案例 | taskId | sessionId | runId | 装配日志行 | 核心 L1 chars / manifest hash |
|---|---|---|---|---:|---|
| old / R23-DA-N01 | task-mtpge9a6-jdxnm | wb-expert-task-mtpge9a6-jdxnm | expert_task-mtpge9a6-jdxnm_mtpge9rz | 575 | 1358 / 0182b3392b9b2792 |
| old / R23-DA-H02 | task-mtpgeadj-xerjm | wb-expert-task-mtpgeadj-xerjm | expert_task-mtpgeadj-xerjm_mtpgeaxg | 577 | 1358 / 0182b3392b9b2792 |
| new / R23-DA-N01 | task-mtpgg65w-xx9wa | wb-expert-task-mtpgg65w-xx9wa | expert_task-mtpgg65w-xx9wa_mtpgg6o5 | 583 | 1981 / 031ed971d9b5b4c2 |
| new / R23-DA-H02 | task-mtpgg795-3ix1x | wb-expert-task-mtpgg795-3ix1x | expert_task-mtpgg795-3ix1x_mtpgg7sx | 585 | 1981 / 031ed971d9b5b4c2 |

### 实际装配与完整性：4/4 有证据

四条 `llm-system-prompt` 均明确记录 `skillRefs=["data-analysis-method"]`，包含 `skill.explicit-content`，`truncated=false`；manifest 各 included=16、omitted=0、conflicts=0，全部 included block 均未标截断。核心块投影为 user、authority=data，不是权限提升。未见另外两个可选方法作为显式 L1；存在相同 `skill.auto-summary`，不能把它算成可选方法全文。

为避免仅凭版本或文件 hash 推断正文，按读取到的解析/装配规则做了纯内存复算：保留 frontmatter 后原始 body，前置 `# 技能 data-analysis-method\n`，再按 context block 规范 trim 首尾。**保存的 installed.text 可完整重建日志中的 chars 与 hash 前 16 位**；不是重新调用 runtime 或模型：

- old：单个 Skill header，1358 chars；完整 SHA256 `0182b3392b9b2792b9bb4350b5ebbc1680aa34398def88804b8559ec0e161e0b`。
- new：单个 Skill header，1981 chars；完整 SHA256 `031ed971d9b5b4c2a8e55d8735bfa96b3a48bec0294f85ade881124d75622eb3`。

口径来自 `skill-runtime.ts:parseSkillFrontmatter`、`agent-context-assembly.ts:buildSkillL1Block`、`context-engine/types.ts:normalizeContextBlock`，manifest hash 为 SHA256 前 16 位。复算旧、新全文均吻合实际同 run 日志，支持升级后的完整新增段落进入了宿主装配，而不是只变化了版本标签。此处未声称磁盘全部 runtime 与 QA loaded 模块逐文件相同。

装配对照还显示：四次 persona.sop 均为 283 chars/hash `90e11fd3a9340e78`，attributes 为 `c7ffa6d634510336`；自动摘要均为 565 chars/hash `d0f77382b1ad57d4`。核心/场景、偏好、memory 的 manifest hash 均保持一致；同题 grounding hash 分别保持 `f6627f5945be5e38`、`9ccdc3ee62bd92dd`。除核心 L1 外，另有一个被日志脱敏为 `dat***or` 的 task_fact hash 每 run 不同，不能据名称猜定内容或声称完整请求只有 Skill 一处差异。上下文估算 token 为 2458→2850、2451→2843；这是 manifest 估算，不是账单或 provider 实测。

### 安装、输入与专家快照对照

两份导出 installed.pid 均为 **9072**；old manifest.version=1.0.0，new=1.1.0，均 dependencies=[]、权限全 false/空。installed.text 全文件 SHA256 分别为 `c3a2650715fe87dca6a8fd139c61457b8ea8656ef9c5b3a3ed25589f349ecfc2`、`447bc23b8c56af9859c815e2d61b13a231d520ce50195c33cc701482bdc81a02`，匹配前述旧/新磁盘审查值。

new.install 回执 ok=true、id=data-analysis-method、source=curated、version=1.1.0、warnings=[]，installDir 在指定隔离根内，installedAt=`2026-09-06T06:53:00.587Z`。旧两次分别于 06:51:44.248Z、06:51:49.739Z 结束，候选装配分别于 06:53:01.923Z、06:53:03.393Z；时间顺序符合先完成 baseline 再安装并执行 candidate，没有旧运行跨越此次安装的证据。安装 entry.contentHash 是目录/安装内容口径，不与 SKILL.md 或 L1 block hash 混用。

逐对比较导出的 input、materials、payload 均完全相同；input 字符串 SHA256 独立复算匹配保存值：

- R23-DA-N01：`23082c0eb55d6e5798a51ff146556267a76810cb8f943c4f405d3e543c0eef41`。
- R23-DA-H02：`e01c84c476d1c875b70e6e5ec4b9d197c4d0a6ae97c44dc30b7aa3b31dde23ef`。

四份 assignmentSnapshot 均为专家 2.1.0、agentHash=`42dacb9aa498a21d`，session.expert.source=snapshot，保存 SOP 字符串 SHA256 均为 `b08f7dbb4a2a75b4ea4e89095d50c5e1938f6ea190abc70c4743e2ef0577b0a3`。自定义 primary 保持 requiredSkills=[data-analysis-method]、requiredTools=[]。这证实核心方法升级未在这些保存配置中变成专家/SOP/必需工具更换。

### 运行结果及证据上限

四份 events.jsonl 第 3 行 terminal report 均为 DONE，阶段依次 PREPARE/CONTEXT/MODEL/GROUND/VERIFY_CLAIMS/PERSIST/DONE；每次 rounds=1、modelCompletions 仅 MODEL/stop、toolCalls=0。四份保存 task/session 均为 review。没有 FINALIZE，不能把这些答复变化归于 repair 或用本批证明 repair 改善。执行诊断的工具 available/loaded=0 与上述 Skill L1 已加载并不矛盾。

四条日志 model 均为 qwen3.8-flash。附近网络请求/响应行分别为 576/581、578/582、584/589、586/590，记录 streaming 请求及 HTTP 200，但这些网络条目没有完整 runId/请求正文；时间及 bytes 对照仅作辅助，不当作独立 exact-run 请求绑定。当前两份导出的 captures 是验证前答复 observer（text/providedMaterials/verification），不是模型请求体。**已证实同 run 宿主装配及全文指纹；尚未逐字节证明最后发送的 messages，也未核实最终 max_tokens/temperature 参数。** 不从输出 token 数猜预算。

四次 verificationPassed=true，诊断 scope 明示 `execution_receipts_and_labelled_fields_not_semantic_truth`，fieldCheckCount=0，N01/H02 materialCount 分别为 3/4。这是有限的运行验证，不是专业推断合格证。本轮不打专业分，不把 review 或 4/4 L1 装配成功解释为方法因果收益；同 PID 也不是全部传递依赖冻结证明。

### 可追溯指纹

导出文件 SHA256（本次读取时）：old `2c287f2a6472dcc74807b9544ba2bab3e66211dc61bda711feaf9c3cf3604f76`；new `1488f6f6fa916f9947898af842a007781794651fb11dae482797fdf0a1241237`。

四条装配 JSONL 原行 SHA256（不含行终止符；避免整个持续追加日志 hash 失效）：

```text
575 5b4587e94a1aad824ba15af86f3b7c84de184ee775cb3bcf6fa46138c9b194b8
577 0d2a9f4eb011a7aa426a16189517bf4627ddb749fed447733bd178cbf67095b2
583 84a511fa962ee4385723765522d4c2599ff0dae77d7196abb55d24415ec84905
585 8959d2bf0803aca1f61f51417a16206b5b9734efa8cd8d89d0e2ac1f29586c1b
```

本节仅追加报告；原始导出、run 日志、源码、安装内容与评分均未修改。
