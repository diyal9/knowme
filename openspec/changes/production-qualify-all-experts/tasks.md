# Tasks

## 当前唯一有效目标（2026-09-08 聚焦基线）

本变更不再以“把现有全部角色逐个修成生产级专家”为目标。当前唯一有效的完成口径是：

1. 先治理专家组合：对 22 个内置角色逐一执行 `keep / merge_to_expert / skill_only / workflow_only` 分类，职责重复、能力单薄或不需要持续专业判断的角色退出新任务专家目录。
2. 再认证保留专家：生产资格分母只包含最终 6 个 `keep` 专家；每个保留专家必须以当前 Agent、Skill、Connector、模型与运行时配置完成正常、边界、异常、修改、重试、验收和重开证据。
3. 平台只建设通用能力：编排、工具、权限、上下文、成果物、媒体预览、状态机、恢复和审计均使用统一契约；专业方法和判定标准归 Agent/Skill 包，不得新增专家 ID 特判。
4. 退出身份不等于丢失能力：合并能力由继任专家的声明式 route 承接，一次性能力进入 Skill，固定过程进入 Workflow；旧内置包、安装记录和历史任务直接删除。
5. 用户自定义或外部专家不在自动删除范围内；同名自定义包和任务不得因内置角色退出而被误删。

旧记录中“24 个专家全部通过”“全部专家逐个修正”等表述只代表重新基线前的历史阶段，不再作为当前范围、分母或完成定义。当前结论以 `proposal.md`、`expert-portfolio-governance.json` 和本节为准。

最新增量（2026-09-08，RQA68）：按用户批准将专家名册进一步收敛为 6 个：产品经理、办公协作专家、研究分析师、软件开发工程师、数据分析师、生图执行专家。12 个重叠角色的专业方法已并入上述专家模式，3 个一次性写作角色保留为 Skill，外部能力导入改为平台工作流并删除专家 ID 特判。16 个退出内置专家包已从目录删除；生产迁移直接删除对应 curated 安装与历史任务，也会清理安装记录已经缺失的内置退役专家孤儿任务，同时通过来源保护保留用户自定义同名专家和任务。最终后端回归 3408/3408、Renderer 607/607、lint 与 typecheck 均通过；AgentEvals 仅确认 6/6 包合同为 100，真实运行资格仍为 0/6 unverified，因此当前目标继续 ACTIVE。见 `evidence/rqa68-focused-expert-roster-cleanup-2026-09-08.md`。

最新增量（2026-09-08，RQA69）：发现真实资格执行器原先把交付类型写死为 answer，且会把按预期进入 `needs_input` 的工具/成果失败误判为 harness 失败，无法覆盖生图专家的真实图片 artifact 与失败闭环。已将执行器扩展为声明式 `deliverables`、`expectedStatus`、`expectedAttentionKind` 和 `expectedHasDeliverable`，并冻结当前 `image-producer@4.0.0` 的 IP01–IP05 套件，覆盖真实生成、无图片回执、取消重试、定向修改和完成后重开。执行器专项测试 7/7，套件加载校验通过；RQA69 尚未运行 Electron/真实生图服务，不能将套件设计或脚本绿测视为生图专家资格通过。

最新增量（2026-09-08，RQA70）：补齐通用独立专业评审契约 `eval:experts:review`。评审记录必须覆盖全部冻结用例、逐条引用候选稿证据，并声明独立评审者；模型评审不得复用执行模型，但允许同供应商的不同模型。评审结果会回写语义评审、硬断言和资格状态，生命周期失败不能被语义评审覆盖。定向测试 25/25、完整 `npm run check` 通过；这只是资格基础设施，RQA69 当前 5 个案例仍 pending independent review，最终 6 个专家仍未取得生产资格。见 `evidence/rqa70-independent-semantic-review-contract-2026-09-08.md`。

最新增量（2026-09-08，RQA71）：新增最终 6 个保留专家的机器资格覆盖矩阵和 `eval:experts:matrix` 检查器，硬性要求 normal×2、edge、retry、revision、reopen。初始盘点暴露了各专家的场景缺口，矩阵明确输出 `insufficient_evidence`，不得把 Skill 评测或历史报告当作生产资格。后续 RQA73–RQA76 已补齐缺口。

最新增量（2026-09-08，RQA72）：为数据分析师冻结 DA01–DA06 六个当前配置资格用例，覆盖正常数据分析、口径冲突、超时重试、数字修订和完成后重开；矩阵已将数据分析师提升为 `ready_for_live_execution`，但尚无真实 Electron 执行和独立专业评审。见 `evidence/rqa72-data-analyst-qualification-2026-09-08.md`。

最新增量（2026-09-08，RQA73–RQA76）：为办公协作、研究分析分别补齐 edge/retry/revision/reopen，为软件工程和生图分别补齐第二个 normal；所有题集均使用当前保留专家 ID、冻结配置边界和完整断言。机器矩阵现为 6/6 `ready_for_live_execution`，但尚无因此自动获得生产资格；下一步是按专家逐套执行隔离 Electron，采集真实工具/成果物/生命周期证据，再提交独立专业语义评审。见 `evidence/rqa73-76-retained-expert-suite-completion-2026-09-08.md`。

最新增量（2026-09-08，RQA75 真实执行回归）：在隔离 Electron 重跑 SE11，确认无 AI 接口时任务进入 `needs_input / configuration_required`，资格报告记录 `runtimeNeedsInput=1、runtimeFailed=0`；同时修复可选 Skill 未安装导致的配置指纹缺失。该用例尚未进入模型生成，不能计为专业通过。见 `evidence/rqa75-live-se11-rerun2-2026-09-08.md`。

最新增量（2026-09-08，RQA78）：将通用预检阻塞从单一文案升级为结构化 `attention.issues` 清单。运行时保留全部能力/连接器阻塞项，任务存储归一化不再丢失，专家对话一次性展示所有未就绪条件；继续沿用统一的设置、能力中心和重试入口，不引入专家 ID 特判。补充了运行时、输入状态和专家房展示测试；定向 37+93 通过，全量 `npm run check` 通过（后端 3479 项：3428 pass / 51 skip；Renderer 86 文件、612 项；lint/typecheck 通过）。这改善了环境阻塞闭环，但不等于六个专家已取得真实生产资格。

最新增量（2026-09-08，RQA79）：对最终 6 个保留专家做只读合同审计。全部 Skill 引用可在 `src/catalog/skills` 解析，连接器依赖与职责匹配；没有发现应通过新增专家解决的静态缺项。正式完成口径进一步固化为静态合同、通用运行时、真实能力、独立专业质量四道门禁；当前前两道已有证据，真实资格仍被外部 Provider/能力环境阻塞，目标继续 ACTIVE。见 `evidence/rqa79-retained-expert-contract-audit-2026-09-08.md`。

最新增量（2026-09-08，RQA80）：将连接器依赖拆为通用的 `requiredConnectors` 与 `optionalConnectors` 契约，并贯通专家包解析、能力快照、旧版依赖适配、绑定刷新、预检和 UI 阻塞清单。生图执行专家现在只将 `pango-image-mcp` 作为必需连接器，`photoshop-mcp` 作为可选增强能力；缺少 Photoshop 不再阻止具备生图能力的任务进入执行。定向回归 90/90，全量 `npm run check` 通过（后端 3481 项：3429 pass / 51 skip；Renderer 86 文件、612 项；lint/typecheck 通过）。这修复了通用契约层的误阻塞，但外部 Provider/生图能力端点仍未接入，六个专家的真实生产资格仍不能宣称通过。见 `evidence/rqa80-optional-connector-contract-2026-09-08.md`。

最新增量（2026-09-08，RQA81）：修复专家房状态展示回归。通用 `DialogueStatusBar` 现在由 `ExpertTaskRoom` 统一接收专家名称、任务编号、当前状态和状态色调；执行中沿用脉冲原点动效，底部执行详情改为普通分组而非第二个 `role="status"`，避免状态跑到不一致位置或重复播报。专家房与工作台定向 74/74、Renderer 86 文件 612 项、后端 3430 pass / 51 skip、lint/typecheck 全部通过。该修复改善通用运行时体验，不等于外部 Provider 或专家专业资格已通过。见 `evidence/rqa81-expert-status-bar-2026-09-08.md`。

最新增量（2026-09-08，RQA82）：修复运行阶段事件重复进入专家对话的问题。`stage_prepare`、工具加载、检索、依据核对、验证、生成和兼容性阶段现在统一进入通用进度聚合，不再把“上下文准备完成”等技术状态渲染成额外的专家回复；连续阶段保留在可展开的执行依据中。新增叙事回归 6/6，专家房单独重跑 68/68；全量 `npm run check` 通过（后端 3481 项：3430 pass / 51 skip；Renderer 86 文件、613 项；lint/typecheck 通过）。该修复只改善通用对话呈现，不代表真实 Provider 或专家专业资格通过。见 `evidence/rqa82-stage-narrative-dedup-2026-09-08.md`。

最新增量（2026-09-08，RQA83）：修复通用图片成果源选择的兼容性问题。预览现在优先使用明确的 provider URL 或对话中的可渲染图片地址，再回退到本地 `targetPath`/`path`；会跳过 `memory:`、`artifact:` 等仅用于标识的 opaque URI，避免遮蔽真实图片源。新增 stale path、opaque identifier、provider URL 回退回归；图片预览、通用 artifact preview、专家房合计 77/77 通过。该修复只增强成果物预览契约，不替代真实生图 Provider 和端到端图片验收。见 `evidence/rqa83-image-preview-source-fallback-2026-09-08.md`。

最新增量（2026-09-08，RQA84）：将图片成果源解析从专家房下沉到平台级 `artifactPreviewSource`，普通 Agent 的成果卡与专家房现在共享同一套 provider URL、正文图片地址、本地路径回退和 opaque URI 过滤规则。定向回归 50/50 通过，修复了普通对话入口仍被 stale `targetPath` 遮蔽的遗漏。该修复只证明通用预览契约一致，不代表外部 Provider 或专家专业质量已验收。见 `evidence/rqa84-shared-artifact-image-source-2026-09-08.md`。

最新增量（2026-09-08，RQA85）：通过真实浏览器运行专家房冒烟，专家房可见、主输入框 1 个、嵌套验收输入框 0 个、主状态 1 个、图片预览 1 个，缩略图和放大图均按 `contain` 加载 1600×1000 原图，放大区域 818×661，控制台错误 0 个。该证据覆盖代表性 DOM/布局和交互约束，不替代外部 Provider、专家专业质量及完整视觉验收。见 `evidence/rqa85-expert-room-browser-smoke-2026-09-08.md`。

最新增量（2026-09-08，RQA86）：资格执行器新增连接器配置前置门禁。RQA69 当前缺少 `KNOWME_PANGO_MCP_URL` 时，会在 Electron 启动前直接指出缺口，不再创建 27 条重复的 `needs_input` 任务或污染资格证据；新增资格脚本测试 10/10、lint/typecheck 通过。全量测试仍有共享工作树既有 `capability-pack` 单测 1 项失败，未归因于本轮。见 `evidence/rqa86-qualification-config-preflight-2026-09-08.md`。

最新增量（2026-09-08，RQA87）：本地质量门禁恢复全绿：`npm test` 3431/3431、Renderer 86 文件 617/617、lint/typecheck 通过；保留 6 专家矩阵继续为 6/6 `ready_for_live_execution`。当前未新增专家资格，下一步只剩配置真实 Provider 后执行冻结套件并完成独立专业评审。见 `evidence/rqa87-full-check-and-matrix-2026-09-08.md`。

最新增量（2026-09-07，RQA67）：建立统一真实专家资格执行器 `eval:experts:live`，强制隔离 QA userData、保留正式单实例锁、只采证不自动接受成果，并将 create/cancel→retry/退回修改/接受后重开与独立语义断言分层。当前配置产品经理 PM01 真实执行 `task-mtrazqs4-1mpu2` 明确失败：自动修订后仍未通过包声明的专业质量复核，配置 `b7fc…` 完整绑定 Agent 2.4、四个 Skill、DashScope/Qwen 3.8 Max 与当前运行时。总资格更新为 0/9：产品经理 failed/not_eligible，其余 8 个 unverified；13/13 退出包继续兼容。专用测试 5/5、隔离/能力组合 25/25；最终 `npm run check` exit 0（后端 3615 项：3564 pass / 51 skip，Renderer 86 文件 607 项，lint/typecheck 均通过）。见 `evidence/rqa67-live-qualification-harness-2026-09-07.md` 与 `evidence/rqa67-current-qualification.{md,json}`。通用多轮质量复核总预算、其余 8 专家完整实测和实际备份恢复仍未完成，目标继续 ACTIVE。

最新增量（2026-09-07，RQA66）：AgentEvals 升至 v3.2，生产资格分母改为目录 lifecycle 允许新建任务的 9 个保留专家；13 个 `legacy/newTasks=false` 角色不再污染生产资格，但单独进入兼容审计，报告其包是否保留、继任 Expert/Skill/Workflow 与包错误。隔离用户数据测试逐一复制 13 个退出专家包和 13 条历史任务，执行生产目录迁移后确认 0 个被卸载、13/13 原 ID 可加载、13/13 历史任务及成果可重开；自定义或无 lifecycle 的专家默认 active。当前 9 个保留专家包合同均为 100，但当前配置均无完整运行证据，因此严格结论为 0/9 已认证、9/9 unverified，不把包分或旧配置成绩追认为生产资格。聚焦 AgentEvals/迁移回归 24/24；最终 `npm run check` exit 0（后端 3610 项：3559 pass / 51 skip，Renderer 86 文件 607 项，lint/typecheck 均通过）。见 `evidence/rqa66-retained-expert-qualification.{md,json}`。迁移备份的实际恢复演练及 9 个专家完整资格套件仍未完成，目标继续 ACTIVE。

上一增量（2026-09-07，RQA65）：完成组合目标的系统化落地。9 个 merge 角色的能力均由目标专家通过声明式 route 承接；3 个一次性写作角色退为能力中心 Skill；外部能力导入退为能力中心的预检→确认→导入工作流。目录新增通用 lifecycle 合同，13 个退出角色统一 `legacy/newTasks=false` 并声明 successor；专家库、工作台绑定、直接开始和成果转交入口均过滤旧身份，但旧包不删除，历史任务仍可按原 expertId 解析，用户自定义专家默认保持 active。生产名册收敛为 9 个保留专家，应用启动时仅将已安装的 curated 保留专家同步到当前版本，保留启停状态且不覆盖用户自定义同名包。组合/路由/工作流聚焦回归 80/80，生命周期与升级补充回归 14/14；最终 `npm run check` exit 0（后端 3608 项：3557 pass / 51 skip，Renderer 86 文件 607 项，lint/typecheck 均通过）。见 `evidence/rqa65-portfolio-retirement-and-upgrade-2026-09-07.md`。当时尚未完成历史任务逐例重放，也未完成 9 个保留专家的生产资格认证。

最新增量（2026-09-07，RQA64）：开始按新组合目标执行首个分类迁移。“产品发现”只保留 `product-manager` 专家身份，将 `user-researcher` 与 `requirement-reviewer` 的专业方法改为产品经理声明式执行模式；产品经理 2.4.0 按任务意图只装配 `product-definition-method`、`research-evidence-analysis` 或 `requirement-review` 之一，不在平台运行时按专家 ID 分支。通用路由现可携带模式专属质量复核，未声明专家继续使用原全局复核。官方“写产品需求”工作流 2.2.0 已改为产品经理的研究→定义→评审三阶段，required expert IDs 不再包含两个待退出身份；旧专家包和 ID 暂留以保证历史任务与回滚。聚焦回归 90/90。该结果完成 2/9 merge 的能力与工作流承接，不等于产品经理生产资格通过。

最新增量（2026-09-07，RQA63）：用户调整目标，不再把 22 个内置角色全部强行修成专家。新增 `expert-portfolio-governance.json`，逐项形成 9 keep、9 merge_to_expert、3 skill_only、1 workflow_only 的治理基线；一次性内容变换归 Skill，固定管理过程归工作流，职责/工具重叠角色合并。每个退出专家身份的角色均保留能力承接路径，删除前必须迁移工作流、模式绑定和入口，历史任务仍按原 expertId 只读打开，自定义专家绝不自动删除。治理覆盖测试 4/4；proposal 与 acceptance 已改为“先治理组合，再认证保留专家”。这只是迁移决策，不代表 9 个保留专家已生产合格。

- [x] 建立覆盖 22 个内置专家且无重复遗漏的分类治理清单。
- [x] 对 12 个 merge 角色完成依赖、官方工作流、模式绑定、任务历史和 UI 入口影响分析。
- [x] 将 12 个 merge 角色的方法以声明式 route 或包内执行模式装配到目标专家，并补齐路线专属质量复核。
- [x] 为 3 个 skill_only 内容能力提供通用 Skill 入口，不再创建独立专家任务。
- [x] 将智能体运维专员迁移为能力中心导入工作流，保留预检、确认、执行与审计合同。
- [x] 从目录、curated 安装和历史任务中直接删除 16 个退出专家身份；用户自定义同名专家与任务保持不变。
- [x] 将生产名册收敛为 6 个专家，并为已安装 curated 保留专家提供保状态、非覆盖式版本同步。
- [x] 在隔离用户数据上验证退出角色直接清理、保留专家升级和用户自定义同名保护。
- [ ] 对最终 6 个 keep 专家重新冻结并执行完整生产资格套件。

最新增量（2026-09-07，RQA61）：software-engineer 当前配置 `d789…` 完成 normal×2、edge、retry、revision、reopen 六类配置化证据后明确失败，而非证据不足。SE06恢复稿经执行回放通过，但首次执行失败；SE07真实代码竞态回放3/3决定项失败（失效后复用旧flight、A失效污染B、Promise同一性错误）；SE08取消重试后无交付；SE09 v2逻辑方向正确但真实artifact含断裂注释，JavaScript SyntaxError；SE10完成后重开成功但两次修改均无新版。同模型护栏误放行SE07/SE09。通用失败evidence现持久化完整配置身份；AgentEvals升v3.1，仅qualified可获expertTitle eligible。当前内置0/22称号合格、2 not_eligible、20 pending，外部2仍limited，即0/24生产合格，目标ACTIVE。见 evidence/rqa61-software-engineer-qualification-2026-09-07.md 与 rqa60-agent-evals-v3.{md,json}。

最新增量（2026-09-07，RQA60）：首次按冻结专业断言真实复验开发类专家，并把资格证据绑定到完整运行配置。SE05 旧 unscoped 样本 5/5；旧配置 `b93f…` 两次均 4/5，分别暴露截断恢复绕过专业复核与同模型复核误放行。通用执行器现将答案恢复和质量复核拆成独立一次预算，恢复后仍须复核；`software-change-verification` 升 1.1.0，当前配置 `d789…` 的真实任务 `task-mtqs5xl6-hv6y8` 首次 5/5，但只有一个 normal 样本，仍证据不足。SA05 架构边界题 Flash 两次及 Max 一次均仅 1/5，判定专业失败。AgentEvals v3 按配置分组；显式当前配置可独立评定，旧失败保留审计但不永久污染升级配置，不混合模型/Skill/Connector，也不追认旧 unscoped 样本。当前仍0/24生产合格，目标ACTIVE。见 evidence/rqa60-development-candidate-2026-09-07.md 与 rqa60-agent-evals-v3.{md,json}。

最新增量（2026-09-07，RQA59）：纠正专家评测把 Skill 数量和包结构当作专业能力的虚假高分。AgentEvals v2 只把专家包记为结构合同门禁，1 个有效 Skill 与多个有效 Skill 同分，无运行样本时 overall/average 均为空且资格为 unverified。专家资格必须至少 6 个强样本，覆盖 normal×2、edge、retry、revision、reopen，五维完整、总分≥85，且不得有硬失败或弱任务；包合同损坏也不能被高运行分掩盖。能力中心将“认证”改为“官方”，不再把内置来源冒充专业认证。新报告真实结论为内置 0/22 通过、2 个验收范围外部专家仍 limited，即 0/24 可声称生产合格。聚焦评测 8/8，能力中心 26/26。见 evidence/rqa59-expert-qualification-truth-2026-09-07.md 与 rqa59-agent-evals-v2.{md,json}。

最新增量（2026-09-07，RQA58）：修复 RQA57 资格只落存储、不进入产品消费链路的问题。通用 Capability DTO 透传 qualification，卡片/详情明确显示“能力受限”、受限 Skill 与问题代码；能力中心不再把 installed/enabled 冒充可执行。服务端 createSessionSnapshot 对明确 limited 返回 expert_contract_limited 且不写快照，绕过 UI 同样受阻；无资格字段旧包与既有 persona-only 降级保持兼容，无专家ID分支。影响分析 mapCatalogItemToHub/createSessionSnapshot 均 CRITICAL，已核 d=1；定向后端22/22、能力中心20/20、renderer typecheck通过。该门禁不等于专业认证，th-art 5位专家仍limited，24专家目标继续ACTIVE。见 evidence/rqa58-expert-qualification-runtime-gate-2026-09-07.md。

最新增量（2026-09-07，RQA57）：修复 Cursor 仓库导入把“目录存在/enabled”误当可执行专家，并校准“有包内脚本即受限”的反向误判。通用扫描仅把断链引用、Skill包外执行入口、未声明MCP/网络合同标为limited；包内scripts由通用run_skill_script承载。进一步修复run_skill_script接收args却未传子进程的缺口，支持显式argv或命名flag，以参数数组直接启动Node/Python/Shell/PowerShell，路径/审批/权限边界不变。真实扫描th-art：22 Skill中11受限、5/5 Expert limited，27个断链、6个跨包入口、各1个未声明网络/MCP合同；ui-expert与artbundle-expert仍不合格。聚焦72/72；真实Node argv探针通过；最终check exit0（backend3507pass/51skip、renderer86文件606pass、lint/typecheck通过）。须回源包补合同并完成真实工具与生命周期复验。见 evidence/rqa57-imported-expert-contract-qualification-2026-09-07.md。

最新增量（2026-09-07，RQA56）：visual-designer 2.3 / visual-brief-prompt 2.1补齐视觉主张、信息层级、构图裁切、多比例安全区、色彩材质、字体版权、参考图角色、可测验收与修改保留集；image-producer 3.5及三项必需Skill 1.1补齐来源状态、约束优先级、真实工具回执+图片artifact+可解码文件、可见图复核、失败副作用和版本修订。通用依赖同步修复用户链接Skill覆盖目录后误阻断专家升级，保留用户内容并给出非托管提示。新契约0/4→4/4，相关81/81、链接覆盖组合41/41、历史组合37/37；全新隔离Electron实测生图专家及三Skill升级成功。最终check exit0（backend3500pass/51skip、renderer86文件606pass、lint/typecheck通过）。22/22内置专家均有四项package-owned复核，但无真实模型/生图/修改闭环与图片UX复验，两位仍不合格/待复验。见 evidence/rqa56-visual-image-expert-depth-2026-09-07.md。

最新增量（2026-09-07，RQA55）：product-manager与research-analyst升2.2并新增package-owned完整答案复核。产品专家覆盖问题证据、状态/权限/异常闭环、可复现验收和最近版本修订，同时删除未参与核心交付的虚挂office-requirement-doc；研究专家覆盖实际原文回执、反证/冲突/独立性、来源元数据与本地/联网路线真实性。权限不扩大且无专家ID分支。隔离更新实测两位均enabled、无warning，必需方法已装且复核进入快照。聚焦29/29、清理后核心17/17；最终check exit0（backend3495pass/51skip、renderer86文件606pass、lint/typecheck通过）。无真实模型/联网复验，两位仍不合格/待复验。见 evidence/rqa55-product-research-professional-review-2026-09-07.md。

最新增量（2026-09-07，RQA54）：data-report-editor、longform-editor、presentation-writer统一升2.2并新增package-owned完整答案复核，分别覆盖数字口径/限制/图表可读性、事实与作者立场/最近版本局部修订、决策状态/页数时长/证据备选。三套核心方法正文不变、权限不扩大。隔离更新实测三位均enabled、无warning/依赖漂移，复核进入运行时快照。新契约1/4→4/4，相关35/35；最终check exit0（backend3492pass/51skip、renderer86文件606pass、lint/typecheck通过）。无真实模型复验，三位仍不合格/待复验。见 evidence/rqa54-specialist-writing-professional-review-2026-09-07.md。

最新增量（2026-09-07，RQA53）：action-owner 2.4移除“声明飞书/网络但无工具和读取路由”的虚假能力，收紧为上游材料驱动的纯本地行动提取，并新增实体、义务/证据状态、责任字段和单表全文复核；business-insight-analyst 2.3新增指标计算回执、竞争性因果、决策边界和全文情景一致性复核，仅保留calculate。隔离更新实测行动专家权限收紧生效，商业洞察递归补齐三项必需方法，均enabled且无warning。新契约1/4→4/4，相关60/60；最终check exit0（backend3488pass/51skip、renderer86文件606pass、lint/typecheck通过）。无真实模型复验，两位仍不合格/待复验。见 evidence/rqa53-action-business-professional-review-2026-09-07.md。

最新增量（2026-09-07，RQA52）：content-strategist与creative-director升2.2并新增package-owned完整答案复核。内容策划复核政策事实、产能工时、漏斗分母/窗口/归因与外部回执；创意策划复核逐字文案、动态分镜/常驻层、验证覆盖强度及资产/制作/投放状态。核心方法正文保持字节不变，权限不扩大。隔离更新实测均enabled、无warning，创意专家递归升级visual-brief-prompt 1.0→2.0。新契约1/3→3/3，相关45/45；最终check exit0（backend3484pass/51skip、renderer86文件606pass、lint/typecheck通过）。无真实模型复验，两位仍不合格/待复验。见 evidence/rqa52-content-creative-professional-review-2026-09-07.md。

最新增量（2026-09-07，RQA51）：office-partner 2.3、meeting-scribe 2.3与feishu-meeting-summary 1.2修复明确“今天”被扩大为三天、同回合重复discover/候选查询、候选标题冒充正文及办公/纪要全文缺少来源复核。两位expert新增package-owned复核但不增加专家ID分支、不扩大权限；隔离更新实测均enabled、无warning，办公专家真实递归升级会议Skill 1.1→1.2。新契约0/4→4/4，办公历史47过/1跳、扩展66/66；最终check exit0（backend3481pass/51skip、renderer86文件606pass、lint/typecheck通过）。无可用模型Key与真实飞书复验，两位仍不合格/待复验。见 evidence/rqa51-office-meeting-professional-contract-2026-09-07.md。

最新增量（2026-09-07，RQA50）：按开发Agent优先继续整改 software-engineer 与 solution-architect。两套核心方法已有控制流/失效时序/验证/迁移深度，不再堆Skill；两位expert统一升2.2并新增package-owned完整答案复核。软件工程复核分支可达、最终状态、测试覆盖、无据性能及截断/未落地声明；架构复核TTL边界、结果交付前资格复检、回滚安全门禁及无据人力/工期/性能承诺。权限保持空工具/空连接器。隔离更新实测两位installed/enabled、复核进入快照且无warning/依赖漂移。新契约1/3→3/3，相关38/38；最终check exit0（backend3477pass/51skip、renderer86文件606pass、lint/typecheck通过）。无真实模型复验，两位仍不合格/待复验。见 evidence/rqa50-development-experts-professional-review-2026-09-07.md。

最新增量（2026-09-07，RQA48–49）：requirement-reviewer 2.4新增首次完整答案复核，回指题面并删除无来源UI/接口/数据库/状态码等实现外扩，同时约束全文长度；external-capability-importer 1.6保留1.5既有四类通用路由，只新增路由一致、installed/enabled/ready/verified状态强度、ToolLedger回执归因及旧确认失效的全文复核，工具白名单不扩大。隔离更新实测两位均installed/enabled且无warning/依赖漂移。新契约2/4→4/4，相关26/26、qualityReview/目录/路由组合34/34；最终check exit0（backend3474pass/51skip、renderer86文件606pass、lint/typecheck通过）。无真实模型复验，两位仍不合格/待复验。见 evidence/rqa48-49-requirements-and-import-professional-review-2026-09-07.md。

最新增量（2026-09-07，RQA46–47）：继续按历史最低分整改 qa-engineer 与 knowledge-curator。QA 既有方法1.4已足够具体，不再堆SOP；expert 2.6新增完整答案复核，逐项删除无来源DB/事务/HTTP/锁/CAS/TTL等实现臆测并执行约1200字精简边界。知识策展2.2/方法1.1新增逐字段“已提供/可观察/待确认/建议”状态，责任人、权限、归属、现行状态、优先级和治理时限不再由惯例补成事实，并新增全文复核。隔离更新实测QA 2.6直接成功、知识策展必需Skill 1.0→1.1递归升级，均enabled且无warning。新契约2/5→5/5，相关87绿；最终check exit0（backend3470pass/51skip、renderer86文件606pass、lint/typecheck通过）。本轮无真实模型复验，两位仍不合格/待复验。见 evidence/rqa46-47-qa-and-knowledge-professional-review-2026-09-07.md。

最新增量（2026-09-07，RQA44–45）：按历史真实最低分优先整改 user-researcher 与 data-analyst。用户研究2.2.0/方法1.1.0补齐逐人配对方向、记录/人数/事件口径、任务终点和全文一致性，并声明包内专业复核；隔离更新实测必需Skill 1.0→1.1递归升级且均enabled。数据分析2.2.0修复“SOP要求计算但权限为空”的合同矛盾，只开放本地只读calculate、默认路线可选使用而不强制调用，并声明数字/未知/因果全文复核；隔离更新成功，两个缺失optional Skill仅告警不自动安装。新测试均0/3→3/3，相关矩阵/目录/运行时组合74绿；历史固定版本/空权限测试迁移后64/64。最终check exit0（backend3465pass/51skip、renderer86文件606pass、lint/typecheck通过）。无模型Key，未重跑UR/DA旧失败题或新留出题，两位仍不合格/待复验，不以包升级授予资格。见 evidence/rqa44-45-user-research-and-data-analysis-2026-09-07.md。

最新增量（2026-09-07，RQA42–43）：通用来源门禁现在只在“明确用户历史归因 + 用户材料同状态族”时接受已安装/导入等历史状态，第一人称/current-run执行仍须真实回执；83项相关回归绿。新增包声明 `qualityReview` 专业复核合同，KnowMe 只做一次禁工具完整替换稿复核，无专家ID分支；fact-checker 2.2.0 首用，127项相关回归绿，但旧FC01/FC03尚未真实复验，不获资格。全专家目录闭包测试发现并修复 evidence-verification 缺失及多项版本漂移，隔离更新实测递归安装 fact-checker 2.2.0 + evidence-verification 1.0.0，26项目录/更新测试绿。当前隔离环境无可用模型Key，未用离线夹具冒充专业实战；22内置仅达到“有必需专业方法”的结构门槛，24专家总体继续ACTIVE。见 evidence/rqa42-43-trust-and-professional-review-2026-09-07.md。

最新增量（2026-09-07，RQA41）：office-partner/meeting-scribe/feishu-meeting-summary 改成候选→用户选择→正文读取的真实两阶段合同，首回合只要求 meeting_candidates；可信工具仅在当前合同已由账本完整验证后可声明 turnComplete，无专家ID特判。聚焦147项146过/1既有跳过。OP04约4/5但单题不认证；OP05被“日期”来源假阳性阻断；旧OP06空候选仍强制read失败，修复后不读不存在会议且不编造，但擅自把今天扩大到3天并冗余discover/重查，仍不合格。隔离重启后的授权门正确阻断，不能作为专业评分。两位均未获资格，24专家目标继续ACTIVE。见 evidence/rqa41-office-qualification-2026-09-07.md。

最新增量（2026-09-07，RQA38–40）：通用内置专家更新已递归同步 declared bundled Skill：必需缺失安装、已装落后必需/可选升级，可选缺失不装、用户同名不覆盖、更高版本不降级、Connector 不安装授权；4项集成及13项聚焦绿，隔离运行时连续证明三位专家与 qa-test-design 1.2→1.3→1.4 自动升级且快照无问题。RQA39冻结留出题：AO04 5/5但单题仅候选；RR04首轮3/5、主框v2 5/5，仍未认证；QA04在2.3/2.4/2.5三版分别4931/3313/3369字，持续发明DB、幂等表、HTTP、TTL、锁/CAS及未定义revoke终态，最终1/5，停止靠堆SOP伪装专家。RQA40首次执行知识/导入冻结4题：KC04功能review但1/5且捏造来源/权限/状态/责任/时限；KC05及ECI04/05均被门禁替换为needs_input无可用正文，ECI05还在纯判断任务上调用两次discover_tools。knowledge-curator、external-capability-importer、qa-engineer均未认证；24专家目标继续ACTIVE。见evidence/rqa38-recursive-skill-update-2026-09-07.md、rqa39-expert-qualification-2026-09-07.md、rqa40-knowledge-import-qualification-2026-09-07.md。

最新增量（2026-09-07，RQA37）：按“是否配得上专家”而非 Skill 数量，升级 action-owner、requirement-reviewer、qa-engineer 三套专业核心方法并执行冻结留出题。真实任务均完成执行/落库/重开且 0 工具调用，但 AO03 仅 3/5、超字数并混淆未触发行动与部分证据；RR03 首版臆造协议/工具/阈值且超长，主输入框修改成功生成 v2 后仍 1732>900 并保留无据 UI 建议；QA03 暂 4/5，但并发屏障可能拆开题面原子检查更新，单样本不认证。RR03 实测还暴露“已删除”状态、本地评审结论、材料内 R1 标签三类通用来源门禁误判，已做无专家分支修复并保留第一人称删除/外部批准/未知标签安全反例。专家更新不递归升级已安装 Skill 的通用包管理问题保留。UI 重开确认 v2/任务号/顶部状态/唯一主输入框存在。最终定向127/127、旧诊断边界修正后59/59；完整check exit0（backend3427pass/51skip、renderer86文件606pass、lint/typecheck通过）。三位均未获生产资格，24 专家目标继续 ACTIVE。见 evidence/rqa37-professional-reasoning-holdouts-2026-09-07.md。

最新增量（2026-09-06，RQA35–36）：按“是否配得上专家”继续审查。knowledge-curator新增必需knowledge-curation-method，旧knowledge-steward降可选，E/C/L/catalog 2.1.0，覆盖来源台账、稳定ID、重复/冲突、生命周期、权限与真实检索验证，双输出合并为一次answer。external-capability-importer新增必需capability-import-assurance，E/C/L/catalog 1.4.0，预览/提交两阶段均装配，统一installed/enabled/ready/verified并禁止把静态引用通过冒充生产可用，两阶段默认answer而非文档。另将content-strategist、creative-director、data-analyst、software-engineer、solution-architect、user-researcher、visual-designer的同轮双answer通过mergeInto系统收口，仅导入确认边界保留两阶段。全量检查暴露mergeInto覆盖用户自定义成果身份及丢requiredSkills两轮通用回归；hydrateDeliverableContracts修改前GitNexus HIGH（5直接/15上游），最终规则保留用户ID/标题/类型并继承包方法与证据，artifact契约仍可接管旧document占位。RQA35原0/4→4/4，RQA36原1/8→8/8，相关43/43、高风险123/123；最终check exit0（backend3418pass/51skip，renderer86文件606pass，lint/typecheck通过），diff-check无错误。GitNexus全共享工作树334文件/707符号/172流程为CRITICAL，包含长期累积脏改动，不能归因于本轮；本轮高风险符号已单独审计。冻结4个eval未执行；无真实模型/知识库/导入/连接器/UI/资格新增，24专家仍ACTIVE。见evidence/rqa35-36-knowledge-import-answer-coherence-2026-09-06.md。

最新增量（2026-09-06，RQA33–34）：发现requiredTools只规定必须调用，未缩小本轮工具面；新增通用route toolAllowlist与权限交集，显式空列表使本地材料/直接起草路线真实无工具，外部路线只暴露必需读取工具，无专家ID分支。execute影响HIGH，修改压到一处纯函数调用；红测0/3→3/3，高风险创建/补充/重试/修改/恢复/22专家矩阵150绿。产品经理与研究分析师新增product-definition-method、research-synthesis-method，E/C/L/catalog统一2.1.0，旧泛化方法降可选，单一交付与完整L1装配；研究本地材料不联网，明确公共研究才限定search_web+fetch_web_page。RQA34原包0/9→候选9/9，冻结4个eval未执行，不计资格。最终check exit0（backend3405pass/51skip，renderer86文件606pass，lint/typecheck通过）。无真实模型/联网/安装/QA/资格新增；全部24专家仍ACTIVE。见evidence/rqa33-34-route-scope-product-research-2026-09-06.md。

最新增量（2026-09-06，RQA31–32）：继续按“能否配得上专家”审查而非堆Skill。office-partner新增专用办公方法并分离本地材料/直接起草/明确飞书三路线，取消固定第二清单成果；通用路由新增hasReadableMaterials/noneKeywords，无专家ID分支。data-report-editor、longform-editor、meeting-scribe、presentation-writer替换必需泛化润色为四套独立专业核心方法，E/C/L/catalog统一2.1.0；会议正文默认本地处理，只有明确飞书妙记请求才要求连接器和两个读取工具。冻结12个专业eval尚未执行，不计资格。RQA31 7绿，RQA32 17绿；最终check exit0（backend3393pass/51skip，renderer86文件606pass，lint/typecheck通过）。无真实模型/飞书/安装/QA/资格新增；五位仅从弱合同推进到候选，全部24专家目标仍ACTIVE。见evidence/rqa31-32-specialized-methods-2026-09-06.md。

最新增量（2026-09-06，RQA30）：通用材料create/update/review整批8000/32接纳验证，历史正文/数量不静默裁切；进一步修复runtime review先slice3/text8000/filter后保存造成的意见与附件分离，保持3附件限制但明确拒绝整批，合法ref-only保留。新增19项（首13旧源1过12红、后6旧runtime全红）；独立最终109绿及6个真实store探针关闭P1残余。中间check89310有能力包安装1失败、单项22绿，原因未定保留；最终check86843 exit0（backend3366pass/51skip，renderer86文件606pass，lint/typecheck通过）。四位无基线专家当前源专业/依赖审查完成但无实测分数；硬scope离线72绿未复现权限覆盖，不重用派生no-tools为授权。无模型/QA/安装/资格新增，D02拒绝未绕过。整树323文件/707符号/172流程CRITICAL含共享历史，diffcheck通过未提交。见evidence/rqa30-main-integration-2026-09-06.md及三份独立报告；全部24专家目标仍ACTIVE。

最新增量（2026-09-06，RQA29）：通用目标/计划正文及验收意见不再静默截断；新写入按UTF-16长度目标32000/评论8000整次验证，超限明确拒绝。createStart会话前验证、store重开和runtime修订完整传递；独立发现的长目标get反复回写P2已补红测并统一canonical比较。最终9新回归，相关67绿，完整check26219 exit0（renderer86文件606项、backend/lint/typecheck通过）。独立报告保留初版92绿及P2发现记录。无真实模型/QA/资格新增；D02拒绝未绕过，材料/计划条目/其他入口尚未全修，F01专业失败仍有效。整树323文件/708符号/172流程CRITICAL含共享历史，diffcheck通过未提交。详见evidence/rqa29-main-integration-2026-09-06.md及独立复审；全部24专家生产目标仍ACTIVE。

最新增量（2026-09-06，RQA28）：通用修订旧稿JSON reference_only/最新反馈后置，FINALIZE保留最新更正；未改预算权限/次数/专家包。新增3红转绿，相关48绿，独立53绿，完整check45697 exit0。原VD-F01主框同反馈真实v2→v3，新提示实际入请求，但全文仅标题版本改变，独立3/6、B4=0，仍不合格；刷新重开反馈/正文/唯一输入保留，未验收。D01新任务把旧稿误置goal被截2000字，反馈未入请求，诊断N/A且有4工具调用，不能排除历史干扰；D02被安全审核拦截、未执行未绕过。观察器restore、85任务20专家ID无活动任务，未新增资格。整树323files/706symbols/172flows CRITICAL含共享历史，diffcheck通过未提交。详见evidence/rqa28-main-integration-2026-09-06.md。全部24专家生产目标仍ACTIVE，禁止将提示改进/版本号/review状态当专业通过。

最新增量（2026-09-06，RQA27）：新增六位未测专家冻结基线，原包不变。KC/PM字段核验blocked、RA无完整交付，专业N/A；LE/PW/VD可评18/21，但分别有无据状态、工期/比较、下游重试边界缺陷，无新增资格。实际L1核对五例无正文、KC缺首请求U；同版本包内容漂移仍在。KC独立诊断日期确在goal而核验仅confirmation，加入原goal内存复现仍因标签/自然句差异blocked；RA收件标题被误抽负责人事实，有真实repair依据。本轮未修gate。VD主框反馈→v2→刷新重开单输入/反馈/正文保留，但独立F01仅3/6、B4=0，核心修改未落实，不能算修订成功。只新增证据/只读复现/未签字acceptance，未改src/包；观察器已restore，git diff --check通过，未重跑fullcheck，RQA26工程证据不替代本轮QA。隔离84任务覆盖20专家ID而非20合格，余4无记录；全部24生产目标仍ACTIVE。详见evidence/rqa27-main-integration-2026-09-06.md。

最新增量（2026-09-06，RQA26）：修复本轮图片附件“模型可见、工具不可引用”的共享链路，按原字节身份与当前附件集解析，不增专家分支；宿主前置失败可信标记避免未调用服务被误判未知副作用，不放宽已发出后的付费重试。自有生图包E/L/C/catalog统一3.4.0，强化修改/保留集、最终prompt冲突核查、真实元数据与简洁交付，三外链Skill不覆盖。原旧R01零生成框架失败单列N/A；修复后四次真实编辑各一次调用并返回896×1200图，独立旧两题各8/9、新各9/9，差异仅短交付要求，不证明视觉能力显著提升或专家资格。D1冷启自动升级曾标签错误，已按实际3.4快照归候选，旧3.2另以冻结hash恢复，非随机/非盲n1限制全部保留。候选H02重开、纯图预览、完整contain、退回只聚焦主框、刷新恢复均实测；未付费revision/验收。最终check51355 exit0：backend3335pass/51skip/0fail，renderer86文件606pass、lint/typecheck绿。见evidence/rqa26-main-integration-2026-09-06.md和四格独立评分、无损原文。24专家目标继续ACTIVE；独立新场景、重复性、真实异常/修改闭环及全集资格仍未完成。

最新增量（2026-09-06，RQA25）：通用图片解码元数据进入artifact、receipt、工具正文及非视觉上下文，支持真实尺寸、EXIF方向/动图画布，保持原字节；独立发现的畸形MIME/hash/ID异常已修。移除专家180×120缩略图覆盖，统一纯图预览；真实v2为317×420，大图完整contain，刷新/隔离冷重开恢复反馈和唯一输入，退回只聚焦主框。新增完整runtime执行→晋升→落库重开回归。最终主线check81257 exit0：backend3306pass/51skip/0fail，renderer86文件606pass、lint/typecheck通过。仅受控重放RQA24原图验证896×1200/1088×1440事实，无新付费生成或专业评分；错误修改杯盖及专家包版本漂移仍未修，方法改进提案未实施、外链Skill未覆盖。见evidence/rqa25-main-integration-2026-09-06.md。全部24专家目标继续ACTIVE。

最新增量（2026-09-06，RQA24）：修复通用工具发现DTO前64项截断造成93工具盘古目录丢失已选生图工具，以及旧Hub健康/预览入口未携带主机凭据；保留白名单和可选resolver兼容。新增29项回归全绿，最终独立完整check94873 exit0（backend3294pass/51skip、renderer597pass、lint/typecheck通过）。自有QA冷启后同任务真实retry生成v1，再通过唯一主输入反馈完成真实参考编辑v2，字节引用hash对应v1；大图contain、重开图片/用户意见/唯一输入框恢复。两版实际896×1200与1088×1440未达到目标尺寸；v2错误把要求保留的杯盖改黑，v1交付冗长。独立v1 7过/2失败/1不可评，v2 7过/3失败/1不可评，不认证专家；实际模型视觉输入未取证，缩略图偏小及包版本漂移保留。详见evidence/rqa24-main-integration-2026-09-06.md、实际JSON与专业评分。无Skill覆盖、无专家ID运行时豁免、未触及日常APPDATA，24专家目标保持ACTIVE。

最新增量（2026-09-06，RQA23）：数据分析核心方法1.1.0补齐证据强度/竞争机制/可逆决策/全文一致性，版本三处对齐、权限依赖不变。两道新冻结题旧新4次实际交付，独立同run完整L1装配4/4；旧新均13/14，不证明整体提升，困难题均超长。真实主输入框反馈→v2→刷新重开保留正文/用户意见/唯一输入框；修订纠正门槛但mixed909超800，未验收，不认证专家。新增结构7项绿，完整check11920exit0：backend3265pass/51skip/0fail、renderer597pass、lint/typecheck通过。没有FINALIZE，不能证明真实数字repair；整树320文件/699符号/172affected CRITICAL为共享范围。详见evidence/rqa23-main-integration-2026-09-06.md和官方对照查看器；全部24专家目标继续ACTIVE。

最新增量（2026-09-06，RQA22）：通用GROUND修复现携带被检查原稿、具体问题与当前来源，核验/修复复用同一来源投影；指令和数据整包预算保护、一次禁工具修复及后验门禁不变，UI八标签上限不再截掉修复问题。独立新测试39绿，相关69绿，完整check94032 exit0（renderer85文件597项，lint/typecheck通过）；只读复审无新增P1。真实冻结DA-N01新任务review且算术正确，但首轮直接通过，未触发FINALIZE，不能宣称40→42修复已真实验证。专业6/7，mixed726合格，仍有“无有害证据”误作“排除有害”的关键因果错误，不认证专家。刷新经工作台重开恢复正文与唯一输入框，退回只聚焦原框；未跑v2。整树320文件/699符号/172affected CRITICAL，不归为本轮全部改动。见evidence/rqa22-main-integration-2026-09-06.md与官方单次查看器；总体继续ACTIVE。

最新增量（2026-09-06，RQA21）：通用模板占位引用误拦截修复，独立复审发现的强调格式漏检及注册ID错绑两处P1已关闭；冻结37+24+22加RQA18合计215绿。原CD-H02真实UI重试needs_input→review，独立专业6/7，缺角色纸样验证且mixed1046超限，仍不认证专家。刷新重开正文/唯一主输入框保留，退回修改只聚焦原输入；未执行修改生成闭环。最终完整check95959 exit0：backend3219过/51既有跳过，renderer597过，lint/typecheck通过；历史共享6/3失败及并行修复时序保留。最终源码原候选/新正文重放通过，未知引用control拒绝；真实模型重试使用初版hash，不冒称最终hash再次模型验收。DA推导误判及40%被修复成42%仍未修，媒体与24专家全集仍未完成。整树320文件/699符号/172affected CRITICAL，未覆盖他人或提交。见evidence/rqa21-main-integration-2026-09-06.md及官方单次retry查看器；目标保持ACTIVE。

最新增量（2026-09-06，RQA20）：内容策划/创意总监/数据分析三包2.1.0与专用核心方法1.0.0落地；独立结构28项绿。自有隔离QA旧六题+候选六题实际执行，候选6/6完整L1装配，5份review、1份占位引用误判needs_input。独立专业候选6/7、6/7、7/7、N/A、5/7、6/7；共同三题旧新均19/21，不证明整体提升。DA正确40%/−10pp被FINALIZE改成42%/−8pp并过gate，通用误判/数值回归尚未修复。重开和退回修改验证唯一输入框，但未跑修改生成闭环。最新完整check28046为3010过/7失败/51跳过；另lint、renderer586项、typecheck绿。共享改动GitNexus风险CRITICAL，未覆盖他人改动或提交。详见evidence/rqa20-main-integration-2026-09-06.md。无新增生产合格专家，24专家总体目标继续ACTIVE。

RQA19专业复核补充：六份新run实际交付的30项冻结断言已全文核对，CS 3/5、1/5；CD 4/5、5/5；DA 4/5、0/5。DA-H02低分含正文漏项，不表示正确均值全错；CD-H02满局部分仍有字数/时间细节边界，不能资格放行。五份超字数，DA-N01有被拒绝的列目录尝试、数据两题共3次create_artifact不等于计算执行证据。详见evidence/rqa19-post-professional-review.md，下一阶段继续专业方法及实际装配/安装升级验证。

最新增量（2026-09-06，RQA19）：三位专家六题实际已安装2.0.0基线均被通用研究路由强加search_web阻塞，修复后原六任务真实retry全部review，保留新旧原文与run；最后边界修正后真实模块同六输入inactive、冷启动review持久化成立，未冒充最后hash又跑六次模型。修复provideInput拒绝仍清草稿/漏送附件/在途覆盖：独立79项绿，实际QA拒绝toast且草稿保留，重开待验收正文与唯一输入框存在。研究路由固定40项绿；最终check72180 exit0：backend2875通过/51既有跳过，renderer82文件574通过，lint/typecheck通过（文件行数软警告保留）。同run装配审计六轮无显式L1，CS/CD有L0，DA无Skill绑定；基线候选五断言4/2/4/2/3/4且有全文硬伤，实际fallback交付N/A，不以执行review或测试绿认证专家。详见evidence/rqa19-main-integration-2026-09-06.md及专业评审/装配/原始JSON。核心方法补齐、安装装配验证、保留集与24专家完整生命周期/媒体验收仍未完成，目标保持ACTIVE。

最新增量（2026-09-06，RQA18）：修复通用全文来源引用、Markdown定义语境、HTML/代码字段保留及跨段落字面量边界；保留工具、操作回执和真实成果门禁。独立132项冻结回归全绿，主线组合340绿；最终check23445 exit0（backend2843过/51既有跳过，renderer560过，lint/typecheck通过）。自有隔离Electron实际模块探针通过，未动日常APPDATA。研究用主机绑定语义reviewer完成12次真实无工具调用、21个预选声明，严格packet95项绿；另行复核发现标签/理由不一致、无证据与矛盾混淆、推导与引用混轴，不能接入自动放行或认证SA全文。详见evidence/rqa18-main-integration-2026-09-06.md及原始JSON/独立报告。无新增专家获生产资格，24专家、专业语义误分类和完整媒体/生命周期验收仍未完成，目标保持ACTIVE。

最新增量（2026-09-06，RQA17）：取得SA-H02门禁前真实候选及UR-H02实际交付，按冻结专业标准两者均2/5，SA候选不算交付、原fallback仍N/A。新增通用最后核验候选/材料指纹与安全字段诊断，修正误导性读取提示；未放宽声明、来源、工具或验收门禁。独立26项红22→绿、追加类型17项红12→绿，合计43绿；主线合并112绿，最终check99297 exit0（backend2616过/51既有跳过，renderer560过，lint/typecheck通过）。补丁后原SA任务真实重试仍被结论核验阻塞，诊断与输入一致；最终QA重启重开后诊断及单一主输入框保留。详见evidence/rqa17-main-integration-2026-09-06.md及官方verifier-diagnostic-review.html。语义误分类、专业硬伤和全集验收仍未完成，无新增专家获得生产资格，24专家目标保持ACTIVE。

最新增量（2026-09-06，RQA15–16）：SE/SA/UR补齐专用核心方法及通用route声明，隔离旧6+新6次真实调用，候选6次L1完整加载；方法契约23项绿。专业SE-N01 2→3/5、SE-H02 N/A→4/5，UR-N01 0→1/5、UR-H02 1/5→N/A，SA四次N/A；没有专家获生产资格。RQA16修正生产adapter忽略本轮修复预算的接线，冻结29项15过/14失败→29全绿，合并原预算回归38绿；完整check97282 exit0（先前临时rename EPERM失败及单项复跑已保留）。两条SA原任务真实retry均length→stop，N01完整review但专业有硬伤，H02完成声明门禁needs_input/N/A；刷新重开N01正文、主输入框和验收入口在，未接受成果。详见evidence/rqa15-main-integration-2026-09-06.md及rqa16-main-integration-2026-09-06.md。24专家总体仍ACTIVE，来源/完成声明核验诊断、专业质量与全集验收继续，不把增加Skill或工程绿测当专家能力认证。

最新增量（2026-09-06，RQA14）：通用运行时显式截断门禁、一次有界禁工具答复修复、全部FINALIZE取消/不完整传播已补齐；独立35项绿，最终完整check27881 exit0（renderer80文件560项，test/lint/typecheck通过）。真实SE双截断正确failed，受控预算修复后同任务retry完整stop→review，刷新重开后正文/主输入框/验收入口保留；SA正常stop。独立专业SE3/5、SA3/5，均不合格，不是Skill A/B或资格证明。三专家方法为空源自包的本轮声明及安装/快照漂移，不能盲目注入依赖。详见evidence/rqa14-main-integration-2026-09-06.md；24专家总体仍ACTIVE。

- [x] 核对内置、已安装、自定义专家全集及版本，冻结首轮验收范围（22 内置 + 2 自定义，见 expert-rubrics.md）。
- [x] 为每个专家制定专业正常/异常案例、客观输出断言与 SOP 检查表（见 expert-rubrics.md；这是待执行标准，不是通过记录）。
- [x] 审查专业包、工具与知识依赖，修复冲突、缺项和不必要阻塞（保留专家包定向回归 `36/36`，详见 RQA189）。
- [ ] 实际使用全部专家完成正常任务，并保存输入、输出、调用回执和人工质量判断。
- [ ] 覆盖全部专家的缺少/矛盾输入及能力失败闭环；验证取消、重试、修改与恢复。
- [ ] 按需要补充通用知识与飞书能力，并通过真实只读或隔离对象验证。
- [ ] 统一对话、确认、输入框、预览、段落排版及窄宽视口体验，保存视觉证据。
- [ ] 运行全量 check、风险审查及制作人/测试验收；不以 mock 结果替代生产证据。

当前状态：24 专家静态审查与逐专家用例已完成；安装包差异已核实，尚未统一升级或完成全部真实任务。确认消息保存/恢复回归已补充；长材料修改轮的两层输入截断、上一版正文截断已修正，并验证预算不足时保留原版及意见，不伪造 v2。详见 evidence/confirmation-history-2026-09-05.md 和 evidence/revision-context-2026-09-05.md。

2026-09-08增量：RQA88修正真实资格执行器与运行时的配置契约。运行时支持从 Cursor `mcp.json` 发现 `pango-skillsrv`，资格执行器现支持套件显式声明该来源，并把 Authorization 映射到隔离 QA 的 `PANGO_ACCESS_TOKEN`，不输出凭证、不写生产数据。11/11 定向单测、lint、renderer typecheck 和 diff check 通过；RQA69/RQA76 已冻结声明。尚未获授权向远程 Provider 发起真实探测/资格执行，因此真实资格仍为 0/6，目标继续进行中。详见 evidence/rqa88-qualification-cursor-config-contract-2026-09-08.md。

2026-09-08增量：RQA89重新执行本地专家房浏览器回归；单一主输入框、无嵌套验收输入框、单一主状态、图片缩略图与适配弹窗均通过，控制台无错误。该结果确认此前专家房交互和图片预览修复没有回退，但不替代远程 Provider 真实资格证据。详见 evidence/rqa89-expert-room-browser-regression-2026-09-08.md。

2026-09-08增量：RQA90将“执行中原点动效”加入专家房布局契约；`tone-running` 使用持续 pulse，且 `prefers-reduced-motion` 下自动关闭动画。11/11 专项测试和 lint 通过。详见 evidence/rqa90-running-status-animation-contract-2026-09-08.md。

2026-09-08增量：RQA91将“任务是否配得上专家能力”纳入通用运行时路由契约；记录专门路由命中、默认路由兜底和完全未命中，并在未适配时要求先说明边界、停止硬做。保持专家无特判，定向执行/运行时测试49/49通过。真实远程资格仍待明确授权。详见 evidence/rqa91-expert-fit-route-gate-2026-09-08.md。

2026-09-08增量：RQA92移除专家房“改用飞书内容继续”的通用流程硬编码，调整路径统一显示为“确认建议路径”，提交文案保持 Agent 无关。renderer 定向18/18、typecheck、lint通过。详见 evidence/rqa92-generic-reroute-action-2026-09-08.md。

2026-09-08增量：RQA93把声明路由但任务不匹配的情况接入真实运行时门禁：模型/工具调用前暂停，用户补充路径线索后重新匹配，执行合同保留路由判定字段。专家运行时回归38/38通过。详见 evidence/rqa93-capability-fit-runtime-gate-2026-09-08.md。

2026-09-08增量：RQA94新增隔离能力审计入口，区分目录、安装、L1、grounding、模型触发权限、专家快照与工作台绑定；6专家均可加载并快照，37/41 Skill 已安装且 L1/grounding 通过，4个飞书 Skill 因缺少连接器阻断，办公协作与生图专家明确标记降级。普通模式用于诊断，`--strict` 在存在未安装或降级时返回退出码2，不能以结构装配替代真实 Provider/连接器执行资格。详见 evidence/rqa94-production-capability-audit-2026-09-08.md。

2026-09-08增量：RQA95将专家矩阵审计扩展到运行时消费的 v3 capability manifest，校验依赖、交付物、路由及 Skill/连接器目录引用；6/6 保留专家契约错误为0，案例覆盖仍只代表可进入真实执行，不代表专业资格通过。详见 evidence/rqa95-capability-contract-matrix-2026-09-08.md。

2026-09-06增量：RQA02补齐当前输入锚点/预算保护；RQA06修复未知工具的有界纠正、失败不再包装answer、等待审批/资源attention透传；Skill摘要明确方法不是函数。商业洞察包补齐三项Skill依赖并增强报告方法；新旧Skill三题独立对照均15/15，未证明质量提升。expert-rubrics.md第8节已增加功能/专业双轨及硬性淘汰标准。

以上源码修改后的最新 `npm run check` exit0（session94238），test/lint/80 renderer文件520测试/typecheck均通过。隔离Electron+Qwen3.8Flash真实测试从失败伪成果推进到正常分析与主输入框修改/v2保留，但商业洞察两版均出现无依据事实或计算/因果判断错误，专业不合格；不能据工程门禁宣布专家达标。详见 evidence/bi01-live-2026-09-06.md（含原始两版输出、截图、历史伪成果仍不能直接retry的限制）。

后续增量：已核实并修正 requiredSkills 只预检、不装配执行正文的问题，三项必需方法实际进入 L1（4328字、未截断）；新增有界纯计算 calculate，商业洞察2.2.1显式授权而不放宽平台权限。两题对照与一题新留出均真实执行，核心算术改善，但三题独立评分均4/5且都有专业硬伤，不合格。原文、回执、评分及静态查看器见 evidence/business-methods-2026-09-06.md 和 skill-evals/business-methods-workspace/review.html。

RQA07修复 answer 重开后的验收入口和发言者身份；实际隔离 UI 重开/刷新验证通过。真实修改轮遇到15秒连接超时，保留原稿和修改意见，手动重试后生成v2；RQA09补充失败原因安全展示，已用捕获原因做只读UI回放（不是新的真实故障），恢复后持久化任务仍为review/v2。最新完整 npm run check session88890 exit0：后端2038通过/51既有跳过/0失败，renderer80文件559项通过，lint/typecheck通过；不代表24专家专业资格通过。

下一步继续处理专业因果边界、追加情景复算及交付简洁性，并以重复/留出题复验；不得只扩写Skill或针对一道题填答案。其余23专家真实资格、安装升级、RQA01/03/04/05失败恢复及视觉验收仍未完成。之前单个生图任务真实成功仅作基线，不覆盖本轮全集目标。

第二批增量：真实执行会议纪要、数据报告及事实核查三反例；事实核查新增专用只读方法并实测完整L1装配，新旧输出仍存在专业硬伤，不能认证。MS01因未声明飞书工具被阻塞的问题已通过通用契约路由修复，原任务实际重试成功但纪要新增无依据责任/条件，专业仍失败。FC01主输入框修改、v1/v2保留、返回重开及刷新重开均已实际验证。原文与证据在evidence/professional-batch2-2026-09-06.md。

RQA04联合工具预检、RQA05实际图片字节校验及下载边界、RQA10正式执行后处理契约修复均有定向回归。首轮全量40634失败发现导入工具user-data范围枚举缺失，已补齐并保持ACL限制；矩阵替身工具发现也已补齐。最新完整check41442 exit0，renderer80文件559项、后端/lint/typecheck通过。新增图片路径仍需真实端到端，连接器缓存别名与RQA03挂起恢复仍在审查；RQA01及全部24专家专业资格/安装升级/发行与视觉验收均未完成。不能以这些阶段性工程通过勾选全集完成。

第三批已真实执行action-owner、requirement-reviewer、qa-engineer各一题。行动提取关键字段较好但附加无依据排序；需求评审超长并部分将建议规则变为验收前提；QA因非必需知识检索权限错误失败，无专业正文。失败界面实测输入框/重试均存在，无伪成果。新增RQA11核查minimal工具面与空allowlist治理一致性，不放松知识库权限。详见evidence/professional-batch3-2026-09-06.md。三题都是新基线，不是三位专家认证通过。

后续RQA01/03/11通用治理整合：按真实工具契约选择安全重试及超时，宿主记录是否实际入场，不确定副作用先核对；预检等待有界、取消和新旧attempt隔离、旧排队输入不得越过新暂停点；三种工具面统一权限过滤。原3P1及裸surface零预算入场残余均独立复核关闭。最新完整check17946 exit0：backend2388pass/51既有skip/0fail，renderer80files560pass，lint/typecheck通过。整树影响扫描CRITICAL含既有并行脏改动，不等于本次范围全审完。

QA01原任务真实retry（新run expert_task-mtotfx67-mplj8_mtovv5f4）由failed恢复review，未增工具权限，本轮0工具调用，完整正文在主对话展示；刷新后从工作台重开，输入框/验收/正文均在。真实答复仍有未定义过期键规则和未知覆盖状态的专业硬伤，不能认证。详见evidence/rqa01-main-implementation-2026-09-06.md增量、qa01-retry-live-2026-09-06.json及静态qa-retry-review.html。下一步基于独立专业评测改进方法并做同条件旧/新对照及新场景，不能只扩写SOP。

三专家专业方法候选2.1.0已补齐action-extraction、requirement-review、qa-test-design，完成同当前运行时6旧+6新实际调用，候选6次均真实装配完整L1。按skill-creator进行非包作者独立评分，原文/断言冻结，静态查看器重新生成。AO01 5→5但新稿姓名硬伤，AO02 3→5单次无明确硬伤；RR01两边N/A，RR02旧N/A/新3；QA01 1→3、QA02 4→3，两题均硬伤。不是三专家升级有效或专业资格证明，未覆盖用户安装。详见skill-evals/professional-methods-workspace/comparison-status.md及两份独立报告。

RQA12本轮修复通用材料快照及GROUND/FINALIZE同run来源、有限字段检查、无关工具不得放行、精确源ID和工具完整正文/请求回显隔离。独立64项定向绿；生命周期3项及dataflow8项通过。最终完整check79067 exit0：backend2459pass/51既有skip/0fail（2510总），renderer80files560pass，lint/typecheck通过。此门禁包含最后嵌套请求回显修正，取代先前工程快照；整树305files/569symbols/160affected仍CRITICAL且包含共享既有修改。

但全量检查后实际重试RR01，run expert_task-mtowzdmo-c9tm5_mtoym346仍被ungrounded_external_fact拦截，未有专业正文，不能关闭真实交付问题。原候选被替换前文本未留存，需最小run/round核验审计定位字段，不能继续猜测。源码与工程回归完成不等于用户可用；全部24专家真实资格、专业硬伤、完整生图体验/发行与安装升级仍未完成。详见evidence/rqa12-main-integration-2026-09-06.md及独立review、真实retry快照。总体目标保持进行中。

RQA13增量：隔离QA只读观察原校验返回，定位真实RR01“评审结论：阻塞（需修改）”被误当外部事实；有限评价/归因边界修复后原任务新run mtozc5xx进入review，刷新重开后一个主输入框与验收入口可见，未点击验收。check15178完整exit0、renderer560绿；追加独立反例后86项定向绿，生产源码未再改变。新RR01正文独立专业2/5，仍有无据一分钟完成承诺等硬伤。

第四批真实基线SE-N01/SA-N01/UR-N01全部返回review，但专业分分别4/5、3/5、0/5，均未合格；UR由设计者非盲评分。软件代码另经主线合成M2夹具6/6，不算专家自己的测试回执或工程资格。三任务同run实际skillRefs为空，安装依赖不等于方法正文装配；源码新SOP也不能冒充已安装包基线。软件/架构正文有未完句仍交付，终止原因尚未取证。已保存冻结输入、原文、实际任务/方法审计、评分及查看器。详见evidence/rqa13-and-batch4-main-2026-09-06.md。全部24专家目标仍ACTIVE，后续继续方法装配/包一致性、专业反例、输出完整性及全生命周期/生图体验，不以本轮小范围修复重新定义完成标准。
2026-09-08增量：RQA96 将专家运行时依赖 readiness 接入能力中心通用链路；缺少必需 Skill/连接器时在卡片和详情中明确显示“当前不可执行”，并禁用进入专家工作台。renderer 21/21、能力集成23/23、专家 runtime 定向回归通过；全量 npm test 3485项（3434通过、51跳过、0失败），typecheck/lint 通过。详见 evidence/rqa96-runtime-readiness-in-capability-hub-2026-09-08.md。该修复不代表远程 Provider/连接器授权和专家专业质量已完成生产验收。
2026-09-08增量：RQA97 修复生产能力审计的异常闭环；专家快照因权限/路径失败时不再中止整份报告，而是按专家记录 `snapshot_failed`、降级状态和可追踪原因，继续输出完整 JSON，并在 strict 模式保持非生产就绪。新增2项回归；全量 npm test 3487项（3436通过、51跳过、0失败），renderer 86文件619项通过，typecheck/lint 通过。默认用户数据审计仍显示8个专家、49个技能，且存在未安装技能与快照写入受限，说明运行时数据尚未收敛到保留6专家目标态。详见 evidence/rqa97-audit-failure-closure-2026-09-08.md。该修复不代表专家专业质量、远程 Provider/连接器授权或实际生图交付已完成生产验收。
2026-09-08增量：RQA98 将专家 roster 收敛做成默认只读、显式 apply、先备份再调用系统删除 API 的通用脚本；确认无绑定/任务引用后移除实际用户数据中的两个旧 local-repo 专家 `ui-expert`、`artbundle-expert`，保留备份。RQA99 修复迁移只升级专家版本、不补齐当前版本必需 Skill 的缺陷，迁移升至 v10；并修正 readiness 读取 capability manifest 的 `required:false`，避免可选 Skill 阻断专家。v10 已实际应用，6 个核心专家、必需 Skill 全部就绪；相关迁移与 runtime 定向测试通过。详见 evidence/rqa98-rqa99-roster-dependencies-readiness-2026-09-08.md。真实 Provider/连接器授权、专家专业质量和完整生图验收仍未完成。
2026-09-08增量：RQA100 修正生产能力审计口径，按保留专家能力合同只校验 `required:true` 的 Skill/连接器；实际静态包审计确认 `packageReady:true`，可选依赖未就绪不再误阻断，同时补充必需连接器校验和 `--apply` 安装支持。带 `requiredTools` 的条件路线不再被静态声明冒充为已执行，完整执行审计交由 `executionReady` / `productionReady` 判定。全量回归 npm test 3440 通过/51 跳过/0 失败，renderer 86 文件/619 项通过，lint/typecheck 通过。详见 evidence/rqa98-rqa99-roster-dependencies-readiness-2026-09-08.md。真实 Provider 授权、专家专业质量和完整生图验收仍未完成。

2026-09-08增量：RQA100 本地确定性夹具完成通用运行时闭环复验：生图 5/5，产品经理 6/6，数据分析 6/6，办公协作 4/4，软件工程 1/1；研究分析 3 个案例因必需 `search_web` 缺失按合同阻塞，未伪造检索证据。上述结果只证明运行时、工具/交付物协议和生命周期可工作，全部仍待独立专业评审，不能标记专家生产级合格。详见 evidence/rqa100-fixture-runtime-2026-09-08.md。

2026-09-08增量：RQA101 对研究通用工具合同做定向复验，`search_web`、`fetch_web_page`、研究路由及缺证据阻断共 84 项通过；确认研究专家当前缺口是实时资格环境未提供真实/等价检索工具，而非放宽门禁即可解决。详见 evidence/rqa101-research-tool-contract-2026-09-08.md。

2026-09-08增量：RQA102 使用真实 Vite renderer + Playwright 复跑专家房视觉场景：主输入框 1 个、嵌套验收输入框 0 个、主状态 1 个、图片预览 1 个；1600×1000 缩略图/放大图均完整展示，`contain` 生效，控制台错误 0。该证据覆盖代表性图片验收布局，不替代完整人工审美、动图、多视口和真实 Provider 验收。详见 evidence/rqa102-expert-room-visual-rerun-2026-09-08.md。

2026-09-08增量：RQA103 使用当前权威 `expert-qualification-matrix.json` 复跑，6/6 保留专家达到 `ready_for_live_execution`，全部覆盖 normal、edge、retry、revision、reopen；这只是进入真实执行的静态门禁，不代表真实工具执行和独立专业质量通过。详见 evidence/rqa103-retained-expert-matrix-rerun-2026-09-08.md。

2026-09-08增量：RQA104 在真实 `%APPDATA%/KnowMe` 用户数据目录复核生产能力审计，6/6 专家加载与快照成功，18 个必需 Skill 和 `pango-image-mcp` 均就绪，降级专家 0；静态包就绪为 `packageReady=true`，但办公协作、研究公开网络和生图 `pango-generate` 条件路线仍处于 `task-runtime-probe-required`，因此完整执行审计保持 `executionReady=false / productionReady=false`。受限沙箱中的 `EPERM` 仅是环境权限假象，不再作为产品缺陷；真实 Provider 执行、独立专业评审和生图质量验收仍未完成。详见 evidence/rqa104-production-audit-real-userdata-2026-09-08.md。

2026-09-08增量：RQA105 在 `1280×800` 真实 renderer 视口复验专家房布局，主对话区与能力栏均无左右竖线，输入框保持核心对话轨内，顶部状态唯一且无控制台错误。详见 evidence/rqa105-expert-room-narrow-viewport-2026-09-08.md。

2026-09-08增量：RQA106 将专家 manifest 中带 `requiredTools` 的条件路线纳入生产能力审计；公开网络研究路线现在明确列出 `search_web`/`fetch_web_page`，并标记为 `task-runtime-probe-required`，静态声明不会被当作执行回执。审计定向回归 5/5 通过。真实 Provider 与联网路线的专业资格仍需独立执行验证。

2026-09-08增量：RQA107 将静态包就绪与完整执行就绪拆开：审计新增 `packageReady`、`executionReady` 和 `unverifiedConditionalRoutes`，并覆盖成果物契约中声明的 `generate_image`；任务证据新增实际 `executionRoute`，只有路线匹配且所有必需工具真实成功、验证门通过时才会提升为 `verified`。任何带 `requiredTools` 但尚未取得真实回执的路线都会让 `productionReady=false`，不再把声明冒充执行成功。当前识别 7 条条件路线，用户数据中仍为 0 条 verified；定向审计 9/9、后端 3501/3501、Renderer 620/620、lint/typecheck 均通过。六个保留专家仍需真实 Provider/连接器执行和独立专业评审，目标继续 ACTIVE。详见 evidence/rqa107-production-readiness-route-gate-2026-09-08.md。

2026-09-08增量：RQA108 修复专家任务预检与实际运行时的内置网页工具口径不一致；`search_web` / `fetch_web_page` 现在由预检 Registry 正式登记，不再被误判为缺少连接器，且未放宽权限与真实证据门禁。预检定向 63/63、完整 `npm run check` 后端 3507/3456 通过/51 跳过/0 失败，Renderer 620/620，lint/typecheck 通过。该修复只解除研究公开网络路线的错误启动阻断；真实 Provider 执行、工具成功回执和独立专业评审仍未完成，`executionReady=false / productionReady=false` 保持不变。详见 evidence/rqa108-builtin-web-preflight-parity-2026-09-08.md。

2026-09-08增量：RQA109 将成果物预览与验收操作拆为通用平台组件；图片只负责预览/打开大图，状态与接受、拒绝、修改、重试统一由 `ArtifactActionBar` 承担，移除图片专用 `agent-image-review` 分支。定向渲染 119/119、完整 `npm run check` exit 0；该修复不改变真实工具证据门禁，条件路线和独立专业评审仍未完成。详见 evidence/rqa109-generic-artifact-action-bar-2026-09-08.md。

2026-09-08增量：RQA110 修复生产能力审计脚本直接执行时遗漏 TypeScript 注册器的问题；CLI 入口可独立运行，10/10 审计规则回归通过，正式运行时权限和快照写入门禁不变。详见 evidence/rqa110-audit-cli-entrypoint-2026-09-08.md。

2026-09-08增量：RQA111 为专家运行时增加可选外置快照根目录，并由生产能力审计 CLI 通过 `--snapshot-root` 注入；正式运行时默认路径不变。聚焦回归 50/50、完整 `npm run check` 通过；真实用户数据审计在隔离快照目录下退出码 0，`packageReady=true`、降级专家 0，但 7 条条件路线仍未取得真实工具回执，`executionReady=false / productionReady=false`。详见 evidence/rqa111-audit-external-snapshot-root-2026-09-08.md。

2026-09-08增量：RQA112 将真实 Provider 资格流程的安全存储失败改为结构化环境阻塞报告，不绕过明文密钥保护；RQA69 的 `IP01` 明确记录为环境阻塞。使用本地同构 MCP/LLM 夹具复跑生图专家 RQA100，正常、无图失败、取消重试、退回修改、验收后重开 5/5 生命周期通过，工具回执和版本链存在；`professionallyQualified=0`，不冒充真实 Provider 或图片质量通过。详见 evidence/rqa112-image-qualification-block-and-fixture-rerun-2026-09-08.md。

2026-09-08增量：RQA113 补齐研究分析师通用运行时资格夹具，RQA74 本地同构 LLM/web fixture 覆盖不联网材料、取消重试、退回修改、验收后重开，4/4 lifecycle 通过；修复质量复核调用误入工具循环、`fetch_web_page` 不支持“已读取页面”声明、以及“不要联网”误命中联网路线三个通用问题。相关回归 `57/57` grounding、`13/13` route 通过。该证据不代表真实联网 Provider 或专业质量合格，`professionallyQualified=0` 保持。详见 evidence/rqa113-research-qualification-fixture-and-grounding-2026-09-08.md。

2026-09-08增量：RQA114 将图片成果预览升级为通用有序候选地址契约；远程地址加载失败时自动回退本地已解码成果，覆盖普通 Agent 成果卡与专家协作预览。图片契约、共享预览和缩略图布局 `18/18`，完整 `npm run check` 后端 `3462` 通过/51 跳过/0 失败，Renderer `622/622`，lint/typecheck 通过。该修复不代表真实生图 Provider、图片内容质量或独立专业评审已完成。详见 evidence/rqa114-generic-image-preview-fallback-2026-09-08.md。

2026-09-08增量：RQA115 修复通用专家任务的确认内容持久化；计划确认现在写入 `plan_confirmed` 用户事件，协作叙事和时间线统一按用户确认展示，刷新/重开不再只剩专家状态。运行时与叙事定向回归通过；完整后端 3463/3514 通过、51 跳过、0 失败，Renderer 86 文件/623 项通过，lint/typecheck 通过。真实 Provider、独立专业质量和完整生图验收仍未完成，目标继续 ACTIVE。详见 evidence/rqa115-plan-confirmation-conversation-persistence-2026-09-08.md。

2026-09-08增量：RQA116 修复执行中用户补充内容的通用对话语义；`input_queued` 现在作为用户回合进入协作叙事和时间线，不再被误显示为专家更新或被折叠。定向回归 12/12、后端 3463/3514 通过/51 跳过/0 失败、Renderer 86 文件/624 项通过，lint/typecheck 通过。真实 Provider、独立专业质量和完整生图验收仍未完成，目标继续 ACTIVE。详见 evidence/rqa116-queued-user-turn-persistence-2026-09-08.md。

RQA116补充：专家房页面回归 `68/68` 通过，确认执行中补充内容实际进入主对话并以用户角色显示；对话保持简洁，不把时间线分类标签重复渲染进气泡。

2026-09-08增量：RQA117 在隔离 QA 用户目录真实探针生图专家 `IP01`；Provider 执行前因系统安全存储不可用而 `environmentBlocked=1`，没有保存明文密钥，也没有生成伪成果。当前生图路线仍需在支持系统安全存储并提供有效 Pango Provider 的环境中重跑完整 RQA69，不能标记生产级。详见 evidence/rqa117-image-live-provider-block-2026-09-08.md。

2026-09-08增量：RQA118 补齐通用用户活动来源契约；执行中补充、排队补充、成果验收和要求修改均持久化为明确的 `source=user` 事件，并保留历史事件兼容。聚焦后端 `52/52`、完整后端 `3463/3514`（51 跳过、0 失败）、Renderer `624/624`、lint/typecheck 均通过。真实 Provider、独立专业质量和完整生图验收仍未完成。详见 evidence/rqa118-user-activity-provenance-2026-09-08.md。

2026-09-09增量：RQA119 为历史任务补齐用户活动语义；重新打开旧任务时，用户补充、确认、验收和修改意见不再按默认专家/系统活动显示。聚焦后端 `52/52`、完整 `npm run check` 后端 `3463/3514`（51 跳过、0 失败）、Renderer `624/624`、lint/typecheck 均通过。真实 Provider、独立专业质量和完整生图验收仍未完成。详见 evidence/rqa119-legacy-user-activity-migration-2026-09-09.md。

2026-09-09增量：RQA120 让协作叙事和专家时间线优先消费通用活动契约，不再为新增 Agent/Skill 扩展用户事件白名单；主对话保持简洁，不重复渲染时间线标签。协作叙事 `9/9`、专家房 `68/68`、Renderer `625/625`、lint/typecheck 均通过。真实 Provider、独立专业质量和完整生图验收仍未完成。详见 evidence/rqa120-contract-driven-collaboration-rendering-2026-09-09.md。

2026-09-09增量：RQA121 将非默认工具/连接器/Skill 路线和成果物执行路线纳入资格矩阵；6/6 保留专家、51 个用例、全部条件路线覆盖，缺失路线会阻止进入真实执行阶段。live qualification 同时校验最终 `executionEvidence.executionRoute` 与题目 `routeId`，避免专项题实际走默认路线仍被算作通过。定向资格回归 `18/18`、后端 `3465/3516`（51 跳过、0 失败）、Renderer `625/625`、lint/typecheck 通过。真实 Provider、连接器成功回执、独立专业评审和生图质量仍未完成，`professionallyQualified=0 / executionReady=false / productionReady=false` 保持不变。详见 evidence/rqa121-conditional-route-qualification-matrix-2026-09-09.md。

2026-09-09增量：RQA122 通过真实路由选择器复核专项资格题，发现并修正 PM07、SE12 会回落默认路线的问题；新增题集到目录路线命中回归 `6/6`。生图 `pango-generate` 按成果物路线契约保留，仍要求最终执行证据校验。该修正只证明路由意图对齐，不替代真实 Provider、连接器工具回执或独立专业评审。详见 evidence/rqa122-route-intent-alignment-2026-09-09.md。

2026-09-09增量：RQA123 修正路线 Skill 与专家安装闭包不一致的问题；数据分析师四个路线 Skill、办公协作四个 Feishu 路线 Skill、研究分析师知识整理 Skill 纳入必需依赖，避免安装专家后执行阶段才报“技能未安装”。数据分析师专项 `DA07/DA08` 本地同构运行 `2/2` 通过并留下对应路线执行证据。详见 evidence/rqa123-route-skill-closure-and-data-live-2026-09-09.md。

2026-09-09增量：RQA124 修正通用路由优先级，明确关键词路线优先于材料条件兜底；研究专项 `RA09/RA10/RA11` 本地同构运行 `3/3` 通过，联网研究与知识整理均命中正确路线。真实 Provider、外部连接器和独立专业评审仍未完成。详见 evidence/rqa124-specialist-route-priority-and-research-live-2026-09-09.md。

2026-09-09增量：RQA128 在隔离 Electron 资格入口验证办公协作 4 条外部读取路由，`OP12/OP13/OP14/OP15` 生命周期 `4/4` 通过；发现通用 OutputGate 漏掉 4 个 Feishu 只读工作流，修正 `false_execution_claim` 误阻断并补回归。RQA129 注入连接器授权失败，任务正确停在 `authorization_required`，没有伪造成果。两项只证明通用运行时和异常闭环，真实飞书账号与独立专业评审仍未完成。详见 `evidence/rqa128-office-conditional-routes-live-2026-09-09.md`、`evidence/rqa129-office-connector-failure-live-2026-09-09.md`。

2026-09-09增量：RQA130 在隔离 Electron 资格入口复跑生图专家本地同构闭环，`FIXTURE-IP01` 至 `FIXTURE-IP05` 正常生成、无图失败、取消重试、退回修改、验收后重开 `5/5` 通过；补充专家房本地图片 artifact 的实际渲染回归，确保先显示对话缩略图再进入统一预览对话框。真实 Pango Provider 仍因系统安全存储不可用被安全阻塞，独立图片质量评审未完成，`professionallyQualified=0 / productionReady=false` 保持不变。详见 `evidence/rqa130-image-fixture-lifecycle-live-2026-09-09.md`。

2026-09-09增量：RQA131 修正生产能力审计漏读条件路由 `skillId` 的契约漏洞；办公协作四条 Feishu 路线现在会正确显示各自必需 Skill，生图与研究路线依赖也完整进入审计。定向审计 `12/12` 通过，真实审计仍识别 7 条未取得执行回执的条件路线，`executionReady=false / productionReady=false` 不变。详见 `evidence/rqa131-route-skill-audit-parity-2026-09-09.md`。

2026-09-09增量：RQA132 修正生产能力审计的只读边界；默认审计不再调用 `ensureDefaultPacks()` 写入用户能力数据，只有显式 `--apply` 才启用默认包安装。新增只读回归，审计定向 `13/13` 通过；真实 Provider、条件路线执行回执和独立专业评审门禁不变。详见 `evidence/rqa132-audit-read-only-default-pack-2026-09-09.md`。

2026-09-09增量：RQA133 为条件路线增加缺失 Skill 的通用诊断；审计结果新增 `conditionalUnavailableSkills`，按 `expertId:routeId` 展示受影响路线，同时保持静态 `packageReady` 与条件路线 `executionReady` 的边界。审计定向 `15/15` 通过，完整 `npm run check` 后端 `3473` 通过、`51` 跳过、`0` 失败，Renderer `86` 文件 `627/627` 通过，lint/typecheck 通过。当前用户数据仍有 4 条办公协作条件路线缺少可选路线 Skill，7 条条件路线没有真实执行回执，因此 `executionReady=false / productionReady=false` 不变。详见 `evidence/rqa133-conditional-route-dependency-diagnostics-2026-09-09.md`。

2026-09-09增量：RQA134 统一专家新任务入口的能力就绪门禁；任务首页不再展示能力合同或运行依赖已明确受限的专家，受限专家仍保留在能力中心和历史中用于修复诊断，未评估条目保持兼容。定向 workbench-home `5/5` 通过，完整 `npm run check` 后端 `3473` 通过、`51` 跳过、`0` 失败，Renderer `86` 文件 `628/628` 通过，lint/typecheck 通过。详见 `evidence/rqa134-expert-availability-gating-2026-09-09.md`。

2026-09-09增量：RQA135 解耦专家目录可见性与新任务可执行性；能力中心继续展示受限专家及其诊断状态，新任务入口仍严格拦截明确受限条目；“已合并”仅表示生命周期 `newTasks=false`，不再覆盖临时依赖未就绪。定向 domain/renderer 回归 `33/33` 通过，`npm run check:quick` Renderer `629/629`、lint 通过。详见 `evidence/rqa135-catalog-visibility-2026-09-09.md`。

2026-09-09增量：RQA136 修正生产能力审计的快照写入边界；默认快照写入系统临时目录，用户 KnowMe 数据目录保持只读，避免 `EPERM` 被误判成专家降级，同时保留显式 `--snapshot-root` 持久化能力。审计回归 `16/16` 通过；真实审计复核 `packageReady=true`、`degradedExperts=0`，剩余 `4` 个条件 Skill 缺失、`7` 条条件路线未取得真实回执，`executionReady=false / productionReady=false`。详见 `evidence/rqa136-readonly-audit-snapshot-boundary-2026-09-09.md`。
2026-09-09增量：RQA137 将专家 manifest 的专项执行路线接入通用 `CapabilityReadiness.routes` 诊断；能力中心详情展示每条路线的可用/缺依赖状态与具体原因，但不改变专家整体就绪门禁，避免某个专项能力阻塞其它可执行任务。后端 expert-runtime `17/17`、能力中心 Renderer `22/22`、全量 Renderer `86/630`、typecheck 通过。真实审计仍为 `packageReady=true / degradedExperts=0 / executionReady=false / productionReady=false`，4 个条件 Skill 缺失、7 条条件路线未取得真实回执。详见 `evidence/rqa137-route-readiness-diagnostics-2026-09-09.md`。
2026-09-09增量：RQA138 修正专家升级迁移闭包；路线声明中的本地 Skill 会自动补齐，外部连接器仍保留授权与运行时门禁。真实用户数据限定修复完成，办公协作 4 个、数据分析 4 个路线 Skill 已补齐；审计复核 `packageReady=true / degradedExperts=0 / conditionalUnavailableSkills=[]`，但 7 条条件路线仍无真实执行回执，`executionReady=false / productionReady=false` 保持不变。迁移回归 `28/28`、全量后端 `3476` 通过/`51` 跳过/0 失败、Renderer `86/630`、lint/typecheck 通过。详见 `evidence/rqa138-route-skill-migration-2026-09-09.md`。
2026-09-09增量：RQA139 为条件路线补齐连接器依赖诊断；办公协作路线现在显式报告 `feishu`，不再把“连接器已安装/启用”误当作授权或在线。当前机器探针明确为 Feishu `auth_required`、Pango `offline`，仍不伪造生产资格。定向审计回归 `29/29`，全量后端 `3478` 通过/`51` 跳过/0 失败，Renderer `86/630`、lint/typecheck 通过。详见 `evidence/rqa139-conditional-connector-readiness-2026-09-09.md`。
2026-09-09增量：RQA140 修正生图交付物的路线级连接器声明；`pango-generate` 显式声明 `requiredConnectorIds=["pango-image-mcp"]`，审计会把 Pango 离线准确归因到生图路线，不再只依赖专家顶层连接器推断。审计定向回归 `20/20`，累计连接器审计回归 `29/29`；全量后端 `3531` 测试中 `3480` 通过、`51` 跳过、失败 `0`，Renderer `86/630`、lint/typecheck 通过。真实 Feishu 授权、Pango 在线和外部路线回执仍未完成。详见 `evidence/rqa139-conditional-connector-readiness-2026-09-09.md`。
2026-09-09增量：RQA141 修正能力目录合并优先级；旧 curated `install-store` manifest 不再覆盖当前 bundled manifest，用户自定义、外部和 linked 能力仍保留自己的契约。真实审计现能将 Pango 离线准确归因到 `image-producer:pango-generate`，而不是丢失路线依赖。能力目录与审计定向回归 `27/27`，真实环境仍为 Feishu `auth_required`、Pango `offline`，生产资格继续保持未通过。详见 `evidence/rqa141-curated-manifest-precedence-2026-09-09.md`。
2026-09-09增量：RQA142 重新执行保留专家资格矩阵，6/6 专家、51 个用例覆盖正常/边界/重试/修改/重开并达到 `ready_for_live_execution`；全量门禁后端 `3532` 项（3481 通过、51 跳过、0 失败）、Renderer `86/630`、lint/typecheck 通过。该结果仅证明静态配置与生命周期覆盖，独立专业评审、Feishu/Pango/公开网络真实路线回执仍缺失，`executionReady=false / productionReady=false` 保持不变。详见 `evidence/rqa142-qualification-matrix-rerun-2026-09-09.md`。
2026-09-09增量：RQA143 收敛专家房“修改意见直接从唯一输入框提交”的异步回归时序；用例先等待验收入口可交互，再验证修改提交与失败后草稿保留。专家房 `69/69`、完整 Renderer `86/630`、lint/typecheck 通过。该修复不改变真实 Provider、独立专业评审和成果质量门禁。详见 `evidence/rqa143-expert-room-review-submit-stability-2026-09-09.md`。
2026-09-09增量：RQA144 使用隔离 Electron 资格入口和本地生图 MCP 夹具重放 `FIXTURE-IP01` 至 `FIXTURE-IP05`，覆盖正常验收、需要输入、取消重试、退回修改、验收后重开，生命周期 `5/5`、运行时失败 `0`、环境阻塞 `0`。该结果仅证明通用运行时闭环，不替代真实 Pango 图片质量与独立专业评审；`professionallyQualified=0 / productionReady=false` 保持不变。详见 `evidence/rqa144-image-fixture-lifecycle-rerun-2026-09-09.md`。
2026-09-09增量：RQA145 使用隔离 Electron 资格入口和本地研究夹具重放 `RA05` 至 `RA11`，覆盖本地材料分析、公开网络搜索与原文读取、知识整理、取消重试、退回修改、验收后重开，生命周期 `7/7`、运行时失败 `0`、环境阻塞 `0`。该结果仅证明研究路由的通用运行时闭环，不替代真实网络与独立专业断言评审；`professionallyQualified=0 / productionReady=false` 保持不变。详见 `evidence/rqa145-research-fixture-lifecycle-rerun-2026-09-09.md`。
2026-09-09增量：RQA146 执行通用图片预览 Renderer 几何冒烟，覆盖 `1280×820`、`835×680`、`390×650` 三种视口和 3 张缩略图，原图解码、`contain` 适配、Portal 防裁切及顺序展示均通过，结果 `9/9`。该结果证明当前预览组件的交互和布局稳定，不替代真实生图质量评审。详见 `evidence/rqa146-image-preview-geometry-smoke-2026-09-09.md`。
2026-09-09增量：RQA147 使用隔离 Electron 资格入口和本地飞书 CLI 夹具重放 `OP08` 至 `OP15`，覆盖办公协作正常/边界/重试/修改/重开及今日优先级、会议候选、文档候选、相关聊天四条 Feishu 条件路线，生命周期 `8/8`、运行时失败 `0`、环境阻塞 `0`。该结果仅证明通用编排与只读边界，不替代真实 Feishu 授权、数据回执和独立专业评审；`professionallyQualified=0 / productionReady=false` 保持不变。详见 `evidence/rqa147-office-fixture-lifecycle-rerun-2026-09-09.md`。
2026-09-09增量：RQA148 执行完整专家房浏览器冒烟，页面级验证专家房、顶部状态、对话内容、图片成果物和唯一主输入框同时成立；`composerCount=1`、`nestedReviewInputCount=0`、`primaryStatusCount=1`、图片缩略图/弹窗均可解码且 `contain`、控制台错误 `0`。该结果证明当前专家房交互组合稳定，不替代真实 Provider 和专业内容质量评审。详见 `evidence/rqa148-expert-room-browser-smoke-2026-09-09.md`。
2026-09-09增量：RQA149 对专家房运行态和图片预览弹窗截图进行人工视觉复核；状态栏、头像/对话节奏、成果物独立展示、验收操作、唯一主输入框和预览弹窗均符合当前通用交互契约，未发现新的排版或重复输入问题。该结果不替代真实 Provider 内容质量评审。详见 `evidence/rqa149-expert-room-visual-review-2026-09-09.md`。
2026-09-09增量：RQA150/RQA151 修正并重放 Pango 连接器失败诊断；异常任务保持 `needs_input/capability_unavailable`，无图片成果物、无伪造成功或文档替代结果，诊断只保留 `pango-image-mcp` 与 `generate_image`，不再展示未参与路线的可选 `photoshop-mcp`。定向预检回归 `64/64` 通过，隔离离线重放按预期 `environmentBlocked=1`。详见 `evidence/rqa151-pango-offline-diagnostic-rerun-2026-09-09.md`。
2026-09-09增量：RQA152 使用本地同构 LLM 夹具在隔离 Electron 中重跑文本专家当前套件：产品经理 `PM01–PM08` 为 `8/8`、数据分析师 `DA01–DA08` 为 `8/8`、软件工程师 `SE06–SE13` 为 `7/7` 生命周期通过，运行失败和环境阻塞均为 `0`。报告仍保留独立语义评审 pending，未将夹具回执当作专业资格。详见 `evidence/rqa152-text-experts-fixture-lifecycle-rerun-2026-09-09.md`。
2026-09-09增量：RQA153 审读 RQA152 候选输出，确认文本夹具返回的是占位式结构化摘要而非专业正文；因此不创建虚假的独立评审通过记录，也不把必需章节硬编码进 CRITICAL 影响的通用完成协议。真实专业资格仍需真实模型输出与独立语义评审。详见 `evidence/rqa153-text-fixture-quality-boundary-2026-09-09.md`。
2026-09-09增量：RQA154 修正资格证据导出层，从隔离会话的 canonical artifact 导出受控 `reviewEvidence`；文本候选正文可供独立评审，图片不把二进制 payload 写入 JSON。PM01 实际重放确认 `bodyChars=419` 且 `truncated=false`，定向 CLI 回归 `14/14` 通过；该夹具正文仍是占位摘要，不提升专业资格。详见 `evidence/rqa154-qualification-candidate-export-2026-09-09.md`。
2026-09-09增量：RQA158 修正文本资格夹具，使产品经理、数据分析师、软件工程师分别输出可评审的专业候选；数据分析路线先调用 `calculate` 再交付正文。完整重放 PM `8/8`、DA `8/8`、SE `7/7` 均为 `review`，运行失败和环境阻塞均为 `0`，夹具防回退与工具协议单测 `6/6` 通过。该结果仍是生命周期/候选证据，不替代真实模型与独立语义评审，`professionallyQualified=0 / productionReady=false` 保持不变。详见 `evidence/rqa158-text-fixture-professional-candidate-rerun-2026-09-09.md`。
2026-09-09增量：RQA160 将生图资格夹具从 1×1 PNG 提升为确定性 `256×256` 可见机器人图标，并保留无图片故障、重试、修改、重开版本差异。隔离 Electron 重放 `FIXTURE-IP01–IP05` 生命周期 `5/5`，运行失败/环境阻塞 `0/0`；图片、验证、资格定向回归 `40/40`。该结果只证明图片预览与通用生命周期协议，不替代真实 Pango 画面质量和独立视觉评审，`professionallyQualified=0 / productionReady=false` 保持不变。详见 `evidence/rqa160-image-fixture-preview-rerun-2026-09-09.md`。
2026-09-09增量：RQA161 补齐办公协作与研究资格夹具的候选输出质量；办公夹具保留冲突、行动项与候选/正文边界，研究夹具保留口径、样本选择、来源事实/分析、搜索后原文读取与 404 待复核边界。办公隔离生命周期 `OP08–OP15=8/8`、研究隔离生命周期 `RA05–RA11=7/7`，运行失败/环境阻塞均为 `0/0`，质量单测 `6/6`；全量后端 `3496` 通过/`51` 跳过/0 失败、Renderer `86/630`、typecheck/lint 通过。该结果仍不替代真实 Provider、真实 Feishu/网络回执和独立语义评审，`professionallyQualified=0 / executionReady=false / productionReady=false` 保持不变。详见 `evidence/rqa161-office-research-candidate-quality-2026-09-09.md`。
2026-09-09增量：RQA162 在当前代码上完成六个保留专家的隔离生命周期重放：产品经理 `8/8`、办公协作 `8/8`、研究分析 `7/7`、软件开发 `7/7`、数据分析 `8/8`、生图 `5/5`，运行失败/环境阻塞均为 `0/0`；资格矩阵确认六者均覆盖 normal、edge、retry、revision、reopen。该结果仅证明夹具环境下的通用运行时与工具/成果物生命周期，不替代真实 Provider、真实 Feishu/Pango/网络回执和独立专业评审，`professionallyQualified=0 / executionReady=false / productionReady=false` 保持不变。详见 `evidence/rqa162-retained-six-fixture-lifecycle-rerun-2026-09-09.md`。
2026-09-09增量：RQA163 将独立专业评审从“证据字段非空”收紧为可核验证据锚点：文本必须命中当前助手输出/文本成果物摘录，二进制成果物可用当前产物 ID，用户提示词不能作为证据。定向回归 `8/8`，串行全量后端 `3499` 通过、`51` 跳过、`0` 失败，lint 通过；未为现有六个专家伪造评审通过记录，`professionallyQualified=0 / executionReady=false / productionReady=false` 保持不变。详见 `evidence/rqa163-independent-review-evidence-anchor-2026-09-09.md`。
2026-09-09增量：RQA164–RQA165 在隔离 Electron 中复验真实 Provider 入口：生图 `IP01` 因系统安全存储不可用在连接器配置阶段阻塞，产品经理 `PM01` 因没有可用 AI 接口在模型调用前阻塞；均未保存明文密钥、未伪造结果、未计入生命周期或专业资格。真实资格继续为 `professionallyQualified=0 / executionReady=false / productionReady=false`。详见 `evidence/rqa164-165-real-provider-preflight-2026-09-09.md`。
2026-09-09增量：RQA166 修正资格执行器隔离配置缺口：新增显式 `--source-user-data`，仅向 QA 目录合并 Provider 非敏感配置与加密 `*Enc` 字段，不复制明文密钥。PM01 重跑已识别生产配置的 DashScope/Qwen 模型，但因当前 Electron 无法解密系统安全存储仍在模型调用前阻塞；定向执行器测试 `15/15`，真实资格继续为 `professionallyQualified=0 / executionReady=false / productionReady=false`。详见 `evidence/rqa166-seeded-provider-qualification-2026-09-09.md`。
2026-09-09增量：RQA167 将“已保存但无法解密”的 Provider Key 从“未配置”中分离：PM01 真实入口准确展示“需要解锁 AI 配置 / 系统安全存储”，仍未进入模型调用；相关运行时与设置测试 `49/49`、lint 通过。真实资格继续为 `professionallyQualified=0 / executionReady=false / productionReady=false`。详见 `evidence/rqa167-locked-provider-diagnostic-2026-09-09.md`。

2026-09-09增量：RQA168 移除规划就绪和补充引导中的 `image-producer` 身份特判，所有专家统一按目标、交付、验收、能力、步骤结构判断是否可确认；专家计划 `24/24`、上下文引擎 `28/28`、专家房 `69/69`、后端全量 `3503` 通过/`51` 跳过/`0` 失败，Renderer 全量、typecheck、lint 通过。该修正强化通用平台边界，不改变真实 Provider、工具回执和独立专业评审门禁。详见 `evidence/rqa168-generic-plan-contract-2026-09-09.md`。

2026-09-09增量：RQA169 移除专家交付侧栏中的 `image-producer` 特判，交付名称和非答案成果统一按任务契约与 artifact 类型展示；专家房/图片预览定向 Renderer `74/74`、typecheck、lint 通过。该修正强化通用成果物组件，不改变真实 Provider、工具回执和独立专业评审门禁。详见 `evidence/rqa169-generic-deliverable-sidebar-2026-09-09.md`。
2026-09-09增量：RQA170 直接在 `app.isReady()` 后探测 Electron `safeStorage`，结果仍为 unavailable，确认真实 Provider 资格阻塞来自当前系统安全存储环境，而非 KnowMe 的读取时机；继续保持不落明文密钥、不伪造模型结果的安全门禁。详见 `evidence/rqa170-electron-secure-storage-probe-2026-09-09.md`。
2026-09-09增量：RQA171 修正设置页凭据阻塞引导，分别处理系统安全存储不可用与历史密钥解密失败，移除误导性的统一“请重启”提示；设置页测试 `9/9`、Renderer typecheck、lint 通过。该修正不放宽真实 Provider、工具回执或专业评审门禁。详见 `evidence/rqa171-credential-recovery-guidance-2026-09-09.md`。
2026-09-09增量：RQA172 修复专家能力侧栏最终交付摘要混入待验收/阻塞/无资源内部记录的问题，仅展示可引用且已接受的真实成果；专家定向 `87/87`、完整 Renderer `632/632`、check:quick、typecheck、diff check 通过。真实 Provider 和独立专业资格门禁保持不变。详见 `evidence/rqa172-final-delivery-summary-regression-2026-09-09.md`。
2026-09-09增量：RQA173 统一主 AI 配置与 Provider 的安全存储路径；`settings-secure` 在 Electron `safeStorage` 不可用时仅对 Windows 新输入凭据启用用户级 DPAPI 兜底，读取显式 `dpapi:` 密文，任何失败仍拒绝明文落盘。安全存储/Provider 定向回归 `13/13`、lint、typecheck 通过；当前沙箱用户配置文件未加载，真实 DPAPI round-trip 仍阻塞，不能计入真实 Provider 资格。详见 `evidence/rqa173-windows-secret-fallback-hardening-2026-09-09.md`。
2026-09-09增量：RQA174 修正设置保存失败闭环；`save-settings` 返回安全存储失败时，设置页不再误报“设置已保存”或清除 dirty 状态，而是展示后端指引并允许重试。设置页 Renderer 定向 `10/10`、`check:quick`、后端全量测试均通过。真实 DPAPI、Provider、外部连接器和独立专业评审仍未完成。详见 `evidence/rqa174-settings-save-failure-closure-2026-09-09.md`。
2026-09-09增量：RQA175 修正通用 Skill 工具预检闭环；已绑定并启用的 Crawl4AI/舆情 Skill 所声明的 `run_skill_script` 现在通过统一 Skill 工具契约进入专家任务联合工具面，不再被误判为缺少工具；AgentEvals roster 断言改由治理配置驱动。专家矩阵 + AgentEvals `16/16`，完整后端 `3554`（`3503` 通过、`51` 跳过、`0` 失败），Renderer `633/633`、lint/typecheck 通过。真实外部服务和独立专业评审仍未完成。详见 `evidence/rqa175-generic-skill-tool-preflight-2026-09-09.md`。

2026-09-09增量：RQA176 将历史连接器与成果物记录纳入生产审计的独立 `historicalEvidence` 信号；确认用户数据中存在 Feishu 成功运行与 Pango 已验收生图成果，但其旧版本配置不能直接提升当前专家资格。审计同时区分当前 bundled 6 专家与用户侧非生产专家记录，沙箱实时探针失败标记为环境不可复核，不覆盖历史成功。完整 `npm run check` 通过；真实当前 Provider/连接器执行和独立专业评审仍未完成。详见 `evidence/rqa176-historical-connector-evidence-2026-09-09.md`。

2026-09-09增量：RQA177 将 `agent-runs/*/events.jsonl` 中成功终态且实际加载连接器工具面的记录投影为独立 `historicalRunEvidence`；当前用户数据确认 Feishu 2 次、Pango 1 次历史成功运行。该信号不替代当前工具成功回执，不改变 `productionReady=false` 的严格门禁。审计单测 `22/22` 通过；真实当前 Provider/连接器执行和独立专业评审仍未完成。详见 `evidence/rqa176-historical-connector-evidence-2026-09-09.md`。
2026-09-09增量：RQA178 修正沙箱探针与历史授权证据的状态分类；当 Feishu/Pango 有历史成功工具面、而当前探针为 `auth_required`/`offline` 等不可复核状态时，审计归类为 `connectorHealthInconclusive`，不再误报为“不健康”，但仍阻止 `productionReady/executionReady`，直到正常 KnowMe Electron 运行环境取得当前回执。审计单测 `23/23`、后端全量 `3506` 通过/`51` 跳过/`0` 失败，Renderer `86/633`、lint 通过。详见 `evidence/rqa176-historical-connector-evidence-2026-09-09.md`。
2026-09-09增量：RQA179 将独立专业资格接入生产能力审计；`productionReady` 现在必须同时满足 6 个当前专家的完整 normal×2、edge、retry、revision、reopen 套件、当前配置身份、生命周期、独立语义评审和硬断言，缺少资格报告时明确输出 `qualification.status=not_provided`，不会把 `packageReady` 或 `executionReady` 冒充专业合格。资格门禁单测 `25/25` 通过，真实用户审计仍为 `packageReady=true / executionReady=false / productionReady=false`。
2026-09-09增量：RQA180 支持将按专家拆分的资格 JSON 报告目录自动合并，并按 `evalId` 拒绝重复样本；审计不再依赖人工拼接报告，合并结果保留来源文件、最新生成时间和完整任务集合。目录合并与重复防护单测 `26/26` 通过；真实资格仍需当前 6 专家的完整实测与独立评审。
2026-09-09增量：RQA181 在隔离资格目录中以 `--source-user-data` 读取生产配置并启动真实 Electron PM01 复核；配置文件中的加密 Provider 凭据已成功复制（未复制明文），但当前执行环境的 Windows 用户配置文件未加载，任务明确阻塞于 `secure_storage_unavailable`，未发起模型调用、未生成伪造结果。该环境证据已单测覆盖 `41/41`；真实资格和生产门禁继续保持未通过，需由正常 KnowMe 桌面进程复核。
2026-09-09增量：RQA182 修复 Knowledge OS 整理任务在 Windows 文件句柄短暂占用时的原子保存竞态；状态文件重命名对 `EPERM/EACCES/EBUSY` 做有限退避重试，并在成功或失败后清理临时文件。专项回归 `2/2`、全量 `npm run check`（后端 `3510/3561` 通过、`51` 跳过，Renderer `633/633`）通过。
2026-09-09增量：RQA183 收紧生产资格门禁，要求每条当前配置任务同时具备独立评审者身份、明确通过结果、逐项通过检查和可定位证据锚点；单独篡改 `semanticReview`/`certificationEligible` 不再可能提升资格。审计专项 `27/27`、全量 `npm run check`（后端 `3511/3562` 通过、`51` 跳过，Renderer `633/633`）通过。
2026-09-09增量：RQA184 新增保留专家逐项就绪矩阵；审计分别输出包状态、路线真实回执、条件 Skill/连接器、沙箱不可复核状态和独立资格状态。真实用户数据复核确认生图为 `environment_blocked(pango-image-mcp:offline)`、办公协作为 `environment_blocked(feishu:auth_required)`、研究为路线回执缺失，其余三位为资格未提供；不改变严格生产门禁。审计定向 `28/28` 通过。详见 `evidence/rqa184-expert-readiness-matrix-2026-09-09.md`。
2026-09-09增量：RQA185 对当前执行身份执行 Feishu CLI 只读认证核验，返回 `identity=none`、user token `missing`；与历史 KnowMe 成功运行记录对照，确认阻塞来自沙箱无法读取原桌面 keychain/安全存储上下文，不是历史授权证据缺失。未发起新的授权、未读取或输出令牌。详见 `evidence/rqa185-feishu-sandbox-auth-boundary-2026-09-09.md`。
2026-09-09增量：RQA186 扩展历史连接器证据读取，除成功终态工具面外，继续读取 `checkpoints/latest.json` 的脱敏工具账本；真实用户数据确认 Feishu 4 次完成运行/7 次成功调用，Pango 4 次完成运行/`generate_image` 与模型查询共 7 次成功调用、3 次失败调用。历史证据明确标注为 `completed_run_tool_calls`，不替代当前 Electron 回执，也不放宽生产资格门禁。审计定向 `29/29` 通过。详见 `evidence/rqa186-historical-connector-call-evidence-2026-09-09.md`。
2026-09-10增量：RQA187 新增通用六专家批量资格编排器；按资格矩阵自动解析并过滤 10 个来源套件、51 个案例，为每个套件分配隔离 QA userData，套件失败后继续执行并保留独立报告，禁止自动专业验收。计划模式和异常续跑测试 `4/4`，完整 `npm run check`（后端 `3517/3568` 通过、`51` 跳过，Renderer `633/633`）通过。真实 Provider/连接器和独立专业评审仍需在正常 KnowMe 用户环境完成。详见 `evidence/rqa187-batch-qualification-runner-2026-09-10.md`。
2026-09-10增量：RQA188 完成真实隔离批量复核；修正资格执行器先校验整套旧来源文件、导致首个研究套件被历史无效案例误报失败的问题，现在按矩阵筛选后再校验选中案例。重跑完整覆盖 `10/10` 套件、`51/51` 案例；`41` 个环境阻塞、`4` 个真实执行失败，未伪造专业通过。全量 `npm run check` 后端 `3518/3569` 通过、`51` 跳过、`0` 失败，Renderer `633/633`，lint/typecheck 通过。历史连接器授权另有独立证据：Feishu `4` 次完成运行/`7` 次成功调用，Pango `4` 次完成运行/`7` 次成功调用/`3` 次失败调用；隔离 QA userData 不继承原桌面安全存储。详见 `evidence/rqa188-isolated-batch-and-historical-auth-boundary-2026-09-10.md`。
2026-09-10增量：RQA189 完成保留专家包与依赖闭环复核；6 位专家的 manifest/SOP/必需 Skill/条件路线、退休治理及独立评审契约定向 `36/36` 通过，资格矩阵 `6/6` 可进入真实执行。该结果证明静态包合同完整，不代表真实模型、Feishu/Pango、网络回执或独立专业评审已通过。`productionReady` 继续保持未通过。
2026-09-10增量：RQA190 对真实用户数据中的 Feishu/Pango 非敏感配置做只读复核；Feishu 为启用的内置 `lark-cli` 授权模式，允许列表完整；Pango 为启用的 `streamable-http` 连接器，端点与 `list_paint_models`/`generate_image` 允许列表均存在。沙箱对 Pango 端点的只读 TCP 探测被系统拒绝，证明当前 `offline` 至少包含沙箱网络边界因素；不改变生产资格门禁。详见 `evidence/rqa190-connector-config-boundary-2026-09-10.md`。
