# RQA14：第四批三专家方法绑定与安装源漂移（只读）

日期：2026-09-06。仅审查当前源码与本 change 已保存证据；未访问用户 APPDATA、安装服务、真实模型或网络，未改源码/包/原始输出/评分。下述探针是本地纯函数及注入依赖检查，不是实际任务重跑。

## 结论

**已确认包缺少本轮方法选择声明，同时运行 persona/SOP 与当前源码存在漂移；没有发现这三例的非空 requiredSkills 被通用 runtime 丢弃的证据。** 三例进入运行链前的 `primary.requiredSkills` 就是 `[]`，同 run 的 `skillRefs`、方法 contextAudit 也均为空。绑定/安装依赖与本轮必读方法是不同契约，不能用前者推导已加载，亦不应全量注入每个任务。

当前三个 E/C/L 均为 2.0.0；E/L 绑定 code-review 或 writing-polish，C 的相应依赖为 required:true，但 C 的两个执行交付物均未声明 requiredSkills，也没有 routes。因此，**仅重新安装当前源码包仍不足以使本批方法进入 L1**。

## 真实证据及判定边界

原始证据根：`skill-evals/professional-batch4-workspace/iteration-1/`，每例 `old_skill/live.json` 与 `transcript.json`；同 run 审计：`evidence/rqa13-batch4-context-audit-2026-09-06.json`。以上路径均相对本 change。

| 案例 / 专家 | task / session | 同 run | 绑定；本轮 requiredSkills / skillRefs / methodContent |
|---|---|---|---|
| SE-N01 / software-engineer | task-mtozhwxb-u3xwt / wb-expert-task-mtozhwxb-u3xwt | expert_task-mtozhwxb-u3xwt_mtozhx2v | code-review；[] / [] / [] |
| SA-N01 / solution-architect | task-mtozhx32-ycfem / wb-expert-task-mtozhx32-ycfem | expert_task-mtozhx32-ycfem_mtozhx8j | code-review；[] / [] / [] |
| UR-N01 / user-researcher | task-mtozhx8r-07xq1 / wb-expert-task-mtozhx8r-07xq1 | expert_task-mtozhx8r-07xq1_mtozhxe7 | writing-polish；[] / [] / [] |

三例 assignmentSnapshot.agentVersion 均为 2.0.0，agentHash 依次为 `b47062b9ed246bc0`、`a664beafb619e14c`、`e534d46e81ee3518`。这些是现存运行标识，不与目录 SHA256 混比。

三例 transcript 的“必须遵循的 SOP”均重复简短 systemPrompt；当前 `src/catalog/experts/{上述ID}/EXPERT.md` 则均有独立五步 SOP。当前解析器的隔离探针正确保留五步，不能归因为当前解析器普遍吞掉 sop。主线 `evidence/rqa13-and-batch4-main-2026-09-06.md` 已注明本批是 current installed baseline，而非当前源码新 SOP 的实测。

**精度限制：**live 是选字段导出，没有当时完整安装 E/C/L、安装事件和 session snapshot 原文。能确定“实际使用的 persona/SOP 不是当前源码五步版本”，与旧安装/快照一致；不能凭版本号、空权限或短 SOP 单独确定当时 sidecar 全文、具体哪次安装未升级，或排除历史快照的贡献。方法未加载也不能直接作为专业失分的因果证明。

## 源码链与边界

以下源码简写默认相对 `D:/aispace/knowme/src/lib/`；`main/boot.ts` 指 `D:/aispace/knowme/src/main/boot.ts`。行号为本次读取位置。

1. **安装只建立可用性。** `capability-hub/lifecycle.ts:483` → `capability-import.ts:829` 选 bundled 安装源、stageCopy、finalizeInstall；`:309` 校验已安装依赖（专家缺依赖可作为 warning，不等于自动安装/加载）；`capability-store.ts:425` 复制包到安装目录并记目录 hash。该 curated 安装链不把 dependency IDs 写入 execution.requiredSkills。`expert-task-runtime.ts:892` 创建任务时另按 required 依赖 readiness 检查；“依赖就绪”仍不等于“本轮 L1”。
2. **源码目录 ≠ 已安装包 ≠ 会话快照。** `expert-runtime.ts:306` 从安装 expertsRoot 读取 E/L/C，优先使用有效 sidecar，否则 legacy adapter；`:547` 创建快照保留 capabilityManifest/persona/bindings；`:608` 优先已有 snapshot persona。`expert-task-runtime.ts:866` 新任务从已安装包创建快照；`expert-execution-profile.ts:173` snapshotNeedsRefresh 只比任务记录与快照自身版本及依赖绑定，不比较最新安装/源码 hash。因此不能假设同任务 retry 自动获得新源码包。`main/boot.ts:251` 的 ensureExpertInstalled 对已有启用安装返回 already；`production-catalog-migration.ts:266` 不提供这三专家的通用内容同步。目录列表还可能混合 bundled 版本与 installed manifest（`capability-catalog-merge.ts:70`），不能把卡片展示当装载凭证。
3. **本轮方法来自交付物/路由，不来自依赖合集。** `expert-execution-profile.ts:14,62,109` 从 snapshot 的 `metadata.knowme.execution.deliverables[].requiredSkills` 与被选中 `routes[].requiredSkills/skillId` 合并。本轮输入是自定义 `primary`；声明是两个默认 `output-1/output-2`，不同 ID 且不满足“单请求+单有效默认”的回退条件。即便只给这两个默认项补方法，primary 仍不会继承。这里不存在自动消费 `execution.requiredSkills` 顶层数组的实现，配置必须落在当前实际读取的交付物或路由字段。
4. **非空声明的传递链存在。** `expert-task-runtime.ts:327` preflightSkills 检查绑定、安装、启用、grounding 契约；`:583` 原样传 `outputSpec.requiredSkills` 为 payload.skillRefs；`agent-generate-prepare.ts:143,272,486` 合并显式 refs，正式执行至少 assist tier，再交 `capability-hub/session-context.ts:55` → `agent-context-assembly.ts:216` 显式 L1 分支；受 bindings allow-list 限制，最终 `skill-runtime.ts:585` loadSkillL1。没有 dependencies→全量 L1 的隐式步骤。
5. **L0 不是 L1。** 自动匹配只提供摘要；code-review 的 `disable-model-invocation:true` 会阻止其自动匹配，但 loadSkillL1 不以此阻止明确选择。writing-polish 可自动匹配也不保证正文加载；本批实际审计甚至没有方法摘要。当前共享 code-review 是短 diff 审查法，writing-polish 是结构/语气润色法，均不能替代架构权衡/研究证据方法。

## 只读验证与未覆盖风险

- 直接调用当前 resolveOutputSpec/hydrateDeliverableContracts：三个源码 C 对 primary 均返回 []，默认两个交付物也各返回 []。构造两个默认均 requiredSkills:[method] 的内存反例，primary 仍 []；构造一个有效默认（另一项 mergeInto 它），primary 获得 [method]。这仅验证匹配规则，不建议为了加载方法无条件合并业务交付物。
- 隔离运行当前 assembleCapabilityContext（persona/grounding 辅助模块及 runtime 以无 IO stub 注入）：绑定 [method]、refs=[] 时 loadSkillL1 调用零次且无 L1；refs=[method] 时调用一次并出现 METHOD_BODY。非全链路集成测试，不验证编译预算或模型遵循。
- 隔离当前 parseExpertFrontmatter，保留真实 resolveSoulSop、替换无关 IO 依赖：三 E 均解析为五步 SOP，且不等于简短 systemPrompt。首次直接 require 探针因 `okf-lib.js` 路径解析失败，未得到业务验证结果；上述隔离探针随后成功，不隐藏该探针环境失败。
- 审计中的另一个 RR01 run `expert_task-mtowzdmo-c9tm5_mtozc5xx` 已有 requirement-review → skill.explicit-content，chars=1024、hash=`7df874bae6857343`、truncated=false；仅说明平台存在成功加载路径，不是这三专家的对照或因果结论。
- 尚有通用完整性风险：preflight 不等价于最终 L1 成功；装配中 loaded.ok=false 可跳过，正文有字符预算，后续上下文编译亦可能裁剪。**本批 refs 原本为空，不能把这些潜在风险冒充本次已证实原因。**

## 最小建议及责任范围（未实施）

1. **三个专家包可负责：**各自 E/C/L 一致升版，并在适用交付物或明确路由声明必要方法、同步依赖和 binding。软件的代码审查任务可显式用 code-review；完整实现方法另需需求不变量/回归/证据边界。架构应有质量属性、备选方案、失效与验证方法；研究应有样本单位、编码反例、证据强度、研究计划方法。code-review 对架构只在有代码材料时可选，writing-polish 对研究只在需要润色时可选。不要把这两项通用辅助法强行升级为所有任务的必需方法。新方法若新增 Skill/catalog 注册，单独协调一个维护者。
2. **包配置必须覆盖用户自定交付 ID：**若本质一份整合答复，可选一个有效默认交付契约；若确需多成果，使用有意声明的路由或明确交付映射，不隐式并入所有默认义务。当前用户明确填写的 requiredSkills 会与匹配项/路由取并集，不应被削弱。发布前同时验证 primary、自定义 ID、默认多成果和非适用任务。
3. **安装/快照治理另负责：**修源码包后通过明确、可追溯的升级路径更新受管安装；核对安装 E/C/L 内容 hash 与版本，再新建任务或在受控确认下刷新原快照。保留用户定制和历史任务固定版本，不能后台无条件覆盖。若做通用增强，展示 canonical/installed/snapshot 三源版本与 hash 差异，比加入专家 ID 特例同步更合适。
4. **通用 runtime 的最小增强建议是可观测/必需方法完整性，不是盲目注入依赖：**记录 requested→resolved→loaded→最终进入模型的 method IDs、来源/hash、chars/truncated/遗漏原因；对真正声明 required 的方法加载失败提供结构化配置/加载问题，而非静默视作已使用。独立验证缺失、禁用、越权、加载失败、预算裁剪及安装后原快照重试；保留 optional、普通 chat 和历史固定快照语义。

验收应分为“已选中并完整送入方法”“执行证据可复核”“专业交付达标”三层；新包真实重跑仍是整包对照，不宣称纯 Skill 因果或资格通过。

## 审查完整性

使用 GitNexus exploring/debugging；query 的 FTS 扩展缺失而降级为空，context 返回 lower-bound（scope extraction 未记录），createSessionSnapshot/assembleCapabilityContext 无可返回 process。未以空图证明无调用，关键链逐段核对当前源码；只读范围未重建索引、未改代码，建议均未实施。以上非全仓无缺陷声明。

本次读取 SHA256：

- expert-execution-profile.ts：`6ABF263E45DD934AFCD12FF1AC334B2C30AD4451365F25CEC0E044D4FCE70BD0`
- expert-task-runtime.ts：`48BF68BE9EA5D6641CF3C7E476B5CECC3903FE3EAE5E097C49C5BD5807BFB05E`
- agent-generate-prepare.ts：`4F28B4AD9717C836B60539D742DB90DE3ED03160AB37000BCDF38DCB0DBD54F6`
- agent-context-assembly.ts：`6E86451A74567ADF47843A59F00186F78210B245EA2D8C3DA046480E52704A23`
- rqa13-batch4-context-audit-2026-09-06.json：`01B8D60A15691730B140F5AEE88C8F25C5633B9A4895D57F2390D3B62B35D49D`

## 主线截断修复后的候选收敛（同日补充）

主线回报通用输出截断修复 12/12 绿、fullcheck30749 exit0；本审查未重复执行这些检查。上述四个 method-binding 核心源码 hash 本轮复核未变。输出 finishReason/完整交付治理与输入方法 L1 装载是两个边界，不能据前者通过就认定后者已加载或完整。

最小可行候选：每专家一份紧凑核心方法，不改共享 code-review/writing-polish，不嵌入冻结题答案；先设计、未实施。

| 专家 | 核心方法最小闭环 | 关键约束 |
|---|---|---|
| 软件 | 明确契约和未知项 → 状态/副作用不变量 → 决定性失败时序 → 最小修正与较小方案反例 → 受控测试及证据 | 不发明接口；区分静态推演与实测；覆盖错误、原子性、重入/并发和恢复，仅在材料相关时展开 |
| 架构 | 质量属性与硬约束 → 系统/信任/数据边界 → 至少两个真正可行方案 → 推荐及淘汰理由 → 失效、迁移与验证 | 硬约束不靠加权评分抵消；揭示不可兼得条件和残余风险；容量、成本、时延无依据则标待测 |
| 研究 | 定义样本/事件/记录单位并去重 → 保留原话上下文编码 → 主题与反例 → 观察/推断/建议分层 → 有预算的区分性研究 | 计数可复算；沉默不等于反对；引语不改写；建议中的成本/收益理由也须有据；名额与招募条件可执行 |

实际 L1 接线验收不能只检查 dependency 或技能名称：

1. E/C/L 同版；方法已安装、启用且进入专家 bindings；声明落在 `metadata.knowme.execution.deliverables[].requiredSkills` 或实际选中 route 的 requiredSkills/skillId，而非无消费者的顶层 execution.requiredSkills。
2. 先验证正常自定义 `primary` 的解析结果。单有效默认回退会采用默认交付 ID；多默认不同 ID 不继承。候选需明确整合答复还是多成果，并同时检查交付 ID、数量及验收引用，不能只断言数组非空。关键词路由也不等价于“材料确实含代码”，可选审查不应凭模糊关键词强制激活。
3. 核对已安装来源与新任务快照，再追 requiredSkills → payload.skillRefs → resolvedSlashIds → 同 run `skill.explicit-content`。保存来源/hash/chars/truncated，并排查上游正文截断标记；最终 contextAudit 的 truncated=false 不能单独排除更早的 L1 截断。短核心法与少量必要方法有助于预算，但不按长度评专业质量。

下一批长文真实复核继续使用 **current installed baseline + 相同冻结 prompt**，不安装本候选、不改变方法声明，不混同 Skill A/B。记录平台修复版本与 task/session/run；它评估修复后的完整交付及 baseline 专业表现。将来授权安装候选后的比较另立批次，属于整包配置对照，仍不宣称纯 Skill 因果。
