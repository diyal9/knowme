# RQA29 — 专家用户输入完整性与有界接纳

2026-09-06，只读诊断。仅新增本报告；未调用/重启 QA、模型、连接器或真实任务，未访问 profile，未改源码/测试/包，未跑全量测试。先读 gitnexus-debugging；query 因 FTS extension 不可用返回空，context(normalizeBrief) 确认 normalizeTask→normalizeBrief→plan/material 等归一化关系，但标 lower-bound、processes=[]。未修索引，随后按当前源码补查。

## 结论与建议

**这是模型预算之前的输入接纳/持久化完整性问题，不应通过增加模型调用验证或补救。** D01 的 5180→2000 已由保存的 payload、task/session/wire 和真实归一化函数离线核实。仅增加 store.GOAL_MAX 不能修好：runtime.createStart 独立先截 2000；plan、材料、review、来源路由还有各自边界。只把原文附存、执行仍读短字段也不能修好。

最小方向：复用现有 brief/plan/material/comment 结构，明确哪些是**执行原文**、哪些只是显示摘要；在统一的写入接纳边界先验证类型、条数、单字段及总 UTF-8 字节预算，接受则完整保存/完整送达，超限整批拒绝并保留用户草稿。显示层可以截短，执行层不可偷偷换成摘要。模型预算沿用 currentInput 原子保护与 fail-closed，不无限增大上下文、不重写执行器、不把原文全部升格成事实证据或工具授权。

## 1. D01 可确证事实

证据根：`D:/aispace/knowme/openspec/changes/production-qualify-all-experts/evidence/`。

- `rqa28-d01-case-and-ui.json`：新任务 `task-mtpq4x1j-qp5hk` 的 payload.goal、brief.goal、brief.plan.goal 都是 5180 字。最新反馈 215 字从 goal 的 JS 字符索引 4965 开始；不是 review API 的 comment 字段。
- `rqa28-vd-d01-actual.json`：task.goal、brief.goal、brief.plan.goal 均 2000 字，并逐字等于上述输入前 2000 字。原 goal hash `c201e31d3984605429ff2e4ceea1e69e5dcd2a88dd475f39c035f36de158bf4c`；截后 hash `95ccba236622d6a5c584b5b2f1d14be3cf0a747c58141905fb86c63375a482a8`。截断点落在旧稿英文 Prompt 中间；原 JSON 参考对象也因此不完整。
- 同 run `expert_task-mtpq4x1j-qp5hk_mtpq4xf3` 的 session 用户消息 5136 字，包含截后 goal，不含完整反馈。消息总长大于 2000 是 SOP、材料和重复目标等装配结果，不代表原 goal 完整。
- `rqa28-all-wire.json` 是数组；D01 [2..6] 五个请求（11:24:14.197Z–11:24:32.130Z）均不含原完整 goal/反馈。由保存证据可确认丢失持续到了实际请求，不需要真实重试。

这证明 D01 的反馈缺失发生在输入链路；不能据此解释 R27 F01（该例 215 字 review 反馈实际完整进入请求），也不能把缺反馈的 D01 当作完整修订提示的有效对照。本报告不评其专业分，不将后续工具行为单因归到截断。

证据文件 SHA256：

| 文件 | SHA256 |
|---|---|
| rqa28-d01-case-and-ui.json | 1bc9a5db3aa4511b3d11c585a3b2448c8bdc69bccad07b16b035d3c17fe05025 |
| rqa28-vd-d01-actual.json | fe0bef93b0eccf64e2f43c4ad05c1b86f4071ba9e77d11e2ba2747415a6bf5bb |
| rqa28-all-wire.json | b85a942a34c59cd0980f5ea2033943063af4f4d4bcd6e57103351f24df62c68e |

## 2. 当前边界：不要混淆原文裁切、摘要和明确拒绝

下表“字”均指当前 JS UTF-16 length/slice，不是 token 或 Unicode 码点；当前 text helper 还执行 trim，因此不能宣称所有输入精确保留原始字节。

| 路径 | 当前行为 | 影响 |
|---|---|---|
| preload api-core:199–201 → ipc/expert-task:8–10 | 原 payload 直接送 createStart/provideInput/reviewDeliverable，无文字长度检查/裁切 | IPC 不是本例直接截断点，也不保证下游接纳完整 |
| expert-task-runtime:850 | 取 plan.goal 优先于 brief.goal/goal，再调用默认 text(...,2000) | **实际 createStart 首个确定截断点**；仅改 store 常量无效 |
| workbench-task-store:13、163、176 | GOAL_MAX=2000；normalizeExpertPlan、normalizeBrief 各自截 goal | 持久化与重开只能得到短值；assignmentSnapshot.plan 同样归一化 |
| store:162–169 | plan.steps 最多8条、每条600；deliverables/acceptanceCriteria/capabilityUse/risks 各最多16条、每条400 | 尾部步骤/豁免/风险可能静默丢失，不仅长 goal |
| store:106–123 | materials 最多32项、正文每项8000；title160、id80、ref240 | create/update 可接受部分材料，正文或来源标识可被裁切；直接传入不经 provideInput 校验 |
| store:209–211、请求交付归一化 | brief.constraints 最多24×400；每个 deliverable.acceptanceCriteria 最多16×400；请求交付物最多16项 | 重要否定项/验收要求也属于意图，不能只处理 goal |
| store:334–339 | 每 deliverable 保留最后50个 comments，body 每条1000 | review.comment 写入后被截；重开无法恢复尾部 |
| runtime:127–144 → store review:605–608 | review 附件先取前3个、文字截8000；再追加到 materials，而 store 只取前32个 | 已满32项时新 review 材料可能全丢；无 provideInput 那样整批拒绝 |
| runtime:540（当前 execute revision） | 从已保存最后一条 comment 再 text(...,1000) | 第二次限制；即使删掉此 slice，store 已丢的尾部不会恢复 |
| expert-task-input:7–31 / provideInput | note>1000、附件正文>8000、总材料>32 等明确返回 ok:false，整批不提交 | **不是静默截断**；应复用这种接纳原则，避免倒退 |

精确导航：[store normalizers](D:/aispace/knowme/src/lib/workbench-task-store.ts:106)、[createStart](D:/aispace/knowme/src/lib/expert-task-runtime.ts:845)、[reviewMaterials](D:/aispace/knowme/src/lib/expert-task-runtime.ts:127)、[provideInput validator](D:/aispace/knowme/src/lib/expert-task-input.ts:7)。review 反馈实际行号随 RQA28 block 增行到 540，不能继续沿用旧 536 作为当前源指针。

**读/写边界尤为重要：** store.create→normalizeTask；store.update→normalizeTask；loadAll 也对磁盘所有 task 再 normalizeTask（480–557）。因此只在 createStart 验证不够，`workbench-task-create/update` 的通用 IPC 仍可直接进入 store（[workbench-local-stores.ts:56](D:/aispace/knowme/src/ipc/workbench-local-stores.ts:56)）；重新打开还会再裁切。loadAll 读到的旧完整数据若归一化丢字段，之后另一任务的 persist 可能把全列表的短版本写回。反过来，简单让 normalizeTask 遇超限就 throw，也可能使一条旧记录拖垮整个 list/get，不能这样修。

**runtime 其它语义边界：** confirmedTaskGoal（29–31）仍用默认2000；reconcileTask 的占位目标恢复比较也用短值（269–275），以后放大 store 上限需一起核对，特别 plan.goal 回填分支。buildPrompt 本身不再整体 slice，直接读保存的 goal/plan/materials；这保住的是已经过上游归一化的输入，并不能找回丢失部分。

**UI/路由前端有限补查：**

- ExpertTaskRoom.startConfirmedPlan [553](D:/aispace/knowme/src/renderer/features/expert/ExpertTaskRoom.tsx:553) 发送完整 draftGoal、用户澄清记录、格式化计划和 confirmation；仅 title 截20字。review [642](D:/aispace/knowme/src/renderer/features/expert/ExpertTaskRoom.tsx:642) 发送完整 trim 后 comment/attachments，无1000字校验，因此后端 ok:true 可让 UI 显示“意见已送达”而实际只保存前段。无需先改整个 UI，但后端拒绝必须兼容当前失败保留草稿路径。
- [expert-collab-plan.ts](D:/aispace/knowme/src/domain/expert-collab-plan.ts:59) 从 assistant 的显式计划提取字段，steps 最多6；formatExpertPlanMaterial 也取前6。这个确认前的结构投影不是 D01 直调路径，不应拿它当 D01 根因；若承诺任意长度/任意步骤计划完整执行，需锁定原计划与显示/执行投影一致，不能仅放宽 store。
- [work-relationship-router.ts:9](D:/aispace/knowme/src/lib/work-relationship-router.ts:9) 另一进入正式专家任务的手动关系路由截 goal2000、所选材料8000/32项。不是 D01 已证入口，但属于后续“所有专家入口”声明需要覆盖的交叉 scope。工作流/子 Agent/draft 推荐目标截断不在本轮展开。
- title、resultSummary280、events.summary500、run.goal200 等显示/历史摘要可以保持有界；但它们不能成为存在完整源时的执行输入。runtime 旧产物找不到时会回退 resultSummary（当前535），应明确那只是摘要，不冒充完整待修订稿；本轮 D01 与 R27 F01 不由此导致。

## 3. 现有预算与证据链能复用什么

- [provided-materials.ts:42](D:/aispace/knowme/src/lib/provided-materials.ts:42) 接收保存后的 brief.materials；32项、总1MiB UTF-8 上限是显式拒绝，不静默截正文；当前 run/task 与内容 hash 校验保留。**它无法探测 store 已裁掉的尾部**，completeness='unknown' 也是恰当限制。不能认为有 hash 就证明入口完整。
- [agent-context-finalize.ts:97](D:/aispace/knowme/src/lib/agent-context-finalize.ts:97) 组装完整当前 prompt；[llm-runtime.ts:306](D:/aispace/knowme/src/lib/llm-runtime.ts:306) 把本轮 currentInput 作为原子内容，预算不足抛 current_input_budget_exceeded；MODEL/FINALIZE 再 fit 时保留原锚点。无需取消这些边界，接受入库与可以开始一次模型请求是两个不同阶段。
- 修订、goal 中夹带的旧稿或“已批准”声明仍是受限数据，不得因保存原文改为成功操作 evidence。RQA12 现有测试明确 feedback/旧产物/SOP 不自动进入 providedMaterials；本轮完整性修复不要顺便改变来源语义判定。

## 4. 最小修正方案及两种做法的风险

### 不建议：只增大 GOAL_MAX

它最多移动一个阈值；runtime.createStart 默认2000仍在，材料/反馈/计划项上限仍在。即使全局把 text 默认值放大，也会扩大一批不应扩大的摘要/状态文本，而且更大上限仍会静默切断超过新阈值的任务。长内容重复存在 task.goal、brief.goal、plan.goal、assignmentSnapshot.plan、格式化计划材料中，放大后增加磁盘全列表重写、IPC传输和 prompt 重复占用；并不意味着模型预算也应同步放大。

仅增加上限可以作为受控容量调整的一部分，前提是：统一字段预算、超过上限明确拒绝、runtime不另截、read/reopen不再丢、现有任务仍可读取。不能把“5180恰好能装下”当通用修复验收。

### 建议优先：现有语义字段为唯一完整输入，摘要另做有界投影

不必新增数据库/任意历史抓取系统。最小实现面：

1. **一个共享接纳规则/小 helper。** 对 goal、plan各语义字段、constraints、材料、review/comment，在 create/update/确认计划/补充/验收修改的实际写入口统一校验；拒绝超长/超数/非法类型，错误给字段路径、实际大小与允许上限，不回显整段敏感正文。先校验整批，再改变 task/queue/acceptanceStatus；不因半批合法就启动 preflight。保留 provideInput 已有原子拒绝行为。
2. **保存完整且有界的 canonical 字段。** 执行字段不再 `.slice`；容量按每字段与每任务总 UTF-8 字节一起约束，不能只有“每项很大×32项×50 comments”。具体阈值是容量策略选择，不能靠本例5180字倒推；如沿用既有材料1MiB预算，应先评估整个同步 JSON store 重写规模，不能自动给每个goal/comment都1MiB。超过可接纳范围返回明确错误，用户可以缩小材料或按现有材料入口组织，不能悄悄改委托。
3. **runtime 用同一完整值。** 移除 createStart/confirmedTaskGoal/revision 的独立短截断，保留 plan确认与最新feedback优先级、原文数据隔离、已有工具权限/完成契约；显示摘要只由 title/resultSummary/明确 preview 派生。识别占位文本时可用小范围检测，但不要把检测用短串写回作为目标原文。
4. **分离写入拒绝与旧数据读取兼容。** 不能在 loadAll 无差别抛错或再次静默裁切。旧记录缺 provenance 时保留可见已保存内容，不能宣称它从未被截；长度恰等于2000/8000不是已截断的证明。无法恢复的旧尾部只能由用户原始输入/明确保存证据重新提交，本轮不自动从历史模型答案/QA文件回填。遇异常巨大旧记录可标需要处理并阻止执行，不破坏其它记录和原文件。
5. **模型预算仍 fail-closed。** 已完整入库但装不下时保留任务、原文、反馈与上一版，明确需要缩小本轮范围/选更大上下文，不默默摘要后执行。不要为输入完整性新增真实模型调用、自动切模型或放大工具重试额度。

### 若确实新增 raw 原文层

可以保持现有短 UI 字段兼容，但**只附存 raw 而 buildPrompt 仍读短 goal 无效**。需要最小版本化契约，明确 raw 是执行事实源、短字段仅 preview，绑定输入种类/任务/修订版本，校验原文字节数/hash与实际接纳状态；缺 raw 的旧记录可用已保存旧字段降级并标 unknown。必须让 create/update/计划确认/review/reopen/retry 读写同一真源，否则出现 stale raw 覆盖新短编辑、计划确认更新一个字段而执行另一个、删除内容仍由 raw 复活等双真源问题。

raw 不能是未经选择的全历史/隐私数据包，也不是信任授权；不能让客户端自报 complete/hash 免过宿主校验。现 normalizeTask 只返回显式字段，新 raw 字段若不在 schema/normalizer 中会直接丢失。每次全列表读写还会复制两份正文，迁移/撤回/导出/清理都需同步，影响明显高于沿用现有 canonical 语义字段。因此本阶段优先“明确接纳+完整语义字段+现有摘要”，不建议为一个 goal 限额引入大规模原文档案层。

## 5. 已有测试与最小新增验证清单

本轮只读测试源码、执行纯函数内存对照，未运行测试套件。现有约束：

- `tests/workbench-task-store.test.js:34` 明确 resultSummary280 是卡片摘要；:43 保留 plan.goal 替换旧占位；:117 验收反馈目前只测短串。不要为了完整输入移除这些显示/兼容约束。
- `tests/expert-task-recovery-boundaries.test.js:40–69` 对 >8000附件、材料数溢出整批拒绝且磁盘不变、排队输入重开保留已有测试；这是 create/review 应对齐的模式，不得放宽成部分成功。
- `tests/expert-task-runtime.test.js:631、680` 覆盖模型预算不足保留上一版与反馈，以及0/8000字材料+多旧产物完整进入 payload；没有覆盖 store之前的5180 goal或>1000 review尾部。
- `tests/rqa12-provided-materials-dataflow.test.js:118` 锁定快照32项/UTF-8总预算显式拒绝；`rqa12-provided-materials-lifecycle.test.js:162` 锁定 revision 新附件进入材料、反馈/旧稿/SOP不自动当事实证据。完整性修复不可混入语义来源放行。
- RQA28 三项证明参考稿JSON隔离与修订提示接线，不证明长 goal/反馈接纳完整。

最小新增用例应穿真实 IPC 注册回调→runtime→store→JSON重开→捕获模型请求 seam（模型 mock，不真实调用），并区分接纳拒绝与模型预算拒绝：

1. 5180字 goal，最新否定项在末尾，goal-only/brief.goal/plan.goal 三入口及不同合法值的优先级；长中文、emoji与换行各自明确定义字节/文本规范，不按token猜长度。
2. 2000/1000/8000旧边界以及新接纳上限的等于/超一；越界整批拒绝、不改 task/queue/comments、不启动执行，前端失败保留原草稿。合法长输入保存→重开→retry后尾标仍在。
3. 第9步、第17条风险、第33材料、已满材料后review附件、第4 review附件；选择“完整接纳”或“明确拒绝”，不能返回ok并丢末项。若某入口明确最多3附件，这个限制可以保留，但必须告知并拒绝整批。
4. 新 API写入与通用 workbenchTaskCreate/Update同规则；更新短标题不应重写裁掉其它旧长输入；一条异常旧记录不导致整个任务列表无法读取。
5. accepted原文大于模型窗口：模型请求数为0，旧产物/反馈/输入可恢复，current_input_budget_exceeded明确；额度足够时最终 body 包含完整最新意图，后续 length FINALIZE 不换用户锚点。
6. 如果新增raw层：短字段编辑不被旧raw复活、确认新plan不会仍执行旧raw、版本/hash不匹配拒绝、旧无raw记录可用且不伪称完整。不把无工具授权变成任务工具许可，不将goal/反馈自动纳入成功证据。

**本轮实际离线对照：** 使用仓库 `node -r ./scripts/register-ts.js`，仅调用 normalizeTask/normalizeBrief/normalizeExpertPlan/normalizeDeliverables，在内存分别构造尾部禁止项，观察 goal→2000、材料→8000、review→1000均丢尾项；9步计划→8步且每步600。另做 D01原文前缀相等与session/wire缺反馈断言。未创建任务文件、未运行runtime.execute/createStart或模型。

## 6. 本次源码指纹与边界

| 源文件 | SHA256 |
|---|---|
| src/lib/workbench-task-store.ts | 805af69759012ca67436d9e07a5ff3d626673eea05c677ddcdfbd8053e5259e9 |
| src/lib/expert-task-runtime.ts | 64ebfad4be37e752d77754932e1552887ea1f0f3379b12f97775f99a7b87927d |
| src/lib/expert-task-input.ts | b86a500ed2b83054393aa4cfd6eef436759e13530f29d824539362bbe407b8f3 |
| src/ipc/expert-task.ts | 05864b0fef4375f365c5bea4d6de5c1752610fcd09677f144738975bed345c90 |
| src/lib/provided-materials.ts | a7c9842b41387a3e47eb2e2da5f4af46806a73cdb62246ea96328ddc006c14f7 |
| src/lib/agent-context-finalize.ts | 7fe382e7394bd8f55f9cce8eb3054142c96ae5f61f330bd1516c3008b90e4bcf |
| src/lib/llm-runtime.ts | f7620abf0caa17865e2bd98ded8cf421096c537af2b80237bb6fdc7781a82eda |
| src/domain/expert-collab-plan.ts | 71cdc3b41aa585ffb0e1535f86ae5b7a845c08e2f5559331cd5e4f970a00298c |
| src/lib/work-relationship-router.ts | a31c398a42c4f656c01c5f985b1ac0f41ac2281e9906ec70a0d795c11deb4fd4 |

这是当前磁盘诊断与已保存实录对照，不是对新任务、QA loaded全模块或全部入口的完整认证。主线负责实现；若选择通用store修正，影响横跨专家/工作流旧记录及IPC消费者，应单独impact，不能因改动行数少称LOW。无真实模型验证要求，自动审查拒绝边界保持不动。

## 7. 最终候选独立复审（2026-09-06，追加，不覆盖前述旧源诊断）

**结论：本次限定改动未发现新增 P1 阻断。独立离线定向测试 92/92 通过，exit 0；留有一项已复现 P2 的重开重复写回。** 不是全输入链完整性认证，未运行 QA、真实模型、安装、网络或 fullcheck，未修改源码/测试。主线报告的首版7条红转绿、fullcheck55892和最终44984属于主线记录；本评审没有独立观察旧源7红，不倒推红测结果，也不把第8条缺 readSessionSnapshot 的夹具失败归因生产源。

### 实际测试与接线

使用仓库 TS resolver；以下两次命令均为真实离线运行（执行器的生成接口使用测试 mock）：

```text
node -r ./scripts/register-ts.js --test tests/rqa29-task-text-integrity.test.js tests/workbench-task-store.test.js tests/expert-task-recovery-boundaries.test.js tests/rqa28-revision-context.test.js
48 tests / 48 pass / 0 fail / 0 skip / exit 0

node -r ./scripts/register-ts.js --test tests/expert-task-runtime.test.js tests/rqa12-provided-materials-lifecycle.test.js tests/rqa12-provided-materials-dataflow.test.js
44 tests / 44 pass / 0 fail / 0 skip / exit 0
```

resolver输出另带一层 `tests 0` 汇总，不重复计数。第一组包含当前8项RQA29（包括 root null拒绝、长confirmed plan进入needs_input后get，以及真正store/review/重开→runtime.execute捕获完整goal/feedback）。没有单独新增测试文件。

- `task-text-contract.ts:12–39` 当前拒绝 null/非对象/数组root；已提供的goal及plan.goal必须是字符串，trim后UTF-16 length不超过32000；评论不超过8000。不是token预算、总UTF-8字节预算或精确原字节归档（trim仍存在）。
- `workbench-task-store.ts:503–518` create/update在持久化与规范化前验证；超限复合patch不改变状态/正文。review在构造新comments后经同一update验证，长反馈完整保存且超8000的accept不改变验收状态。create强制生成id、update强制目标key的既有规则未被新helper改变；没有新增run/task身份豁免。
- `expert-task-runtime.ts:846–853` createStart验证先于会话、快照及控制器登记；实际confirmed plan目标不再经2000字text。`:537–547` 保存的最新评论用taskText进入revision prompt；未改变RQA28最新意见优先/旧稿参考数据规则。`:549–552` 材料快照仍按本task/run从brief.materials创建，没有把goal/feedback自动升级为材料证据。
- normalizeTask/Brief/Plan/Deliverables读取已保存长正文不再按新写入上限截断。当前测试证明超新上限历史值的纯normalize，以及合法长文本实际JSON重开；不能据此说任意超限旧记录都能继续修改/执行：携带旧超限goal或comments的完整patch仍会被写入口拒绝。状态-only更新与包含整个brief/deliverables更新是不同边界；此前已经裁掉的旧尾部不会恢复。
- 相关现有测试继续锁定材料run绑定/篡改拒绝、反馈及旧稿不作为事实来源、必需工具失败不放过、预算不足保留v1/反馈。RQA29新执行测试止于runAgentGenerate mock收到完整prompt，不独自证明所有模型请求装配；实际上下文不足仍应fail-closed，不能据入库成功宣称模型一定收到。

### 已复现非阻断 P2：长目标 get 重复写回

`expert-task-runtime.ts:270–276` confirmedTaskGoal已经返回全文，但比较右侧仍为 `text(task.brief?.goal)` / `text(task.goal)`（默认2000）。因此合法3004字且两字段已经一致的任务，每次runtime.get仍走store.update；真实store会重写文件并刷新updatedAt。**未导致正文重新截断或模型执行，但读操作不再是无写入的稳定重开。**

独立纯内存夹具：normalizeTask生成id=`rqa29-memory-only`、goal=`长`×3000+`TAIL`、无交付物/无快照升级；mock store记录update，runtime.get连续调用两次，观测恰好两次 `{id:'rqa29-memory-only', keys:['goal','brief']}`，返回正文均3004字完整。没有磁盘任务、QA或模型调用。当前第8项只断言get正文，不能检测此问题。

最小建议：比较也使用canonical taskText，保留占位迁移规则；控制用例要求已一致的长目标重复get不触发goal迁移写回。它也说明runtime.accept先reconcile再到store验证时，不能将store超限拒绝的原子性扩大表述为“整个runtime入口没有任何预先迁移写入”。未修改代码。

### 明确未覆盖、不扩大本轮范围

- `work-relationship-router.ts:9、22` 仍先把formal handoff goal截到2000。独立纯函数3004字尾标反例返回expert-task、goal2000且TAIL缺失。这是旧上游边界，不归因新helper，也不要求本轮声称已修。
- `ExpertTaskRoom.tsx:512、536、553–570` 原文goal/confirmed plan无本地2000裁切，但澄清记录与格式化plan还经材料入口8000限制。较长原始goal若被确认plan摘要覆盖、完整限定仅留在材料尾部，仍可能丢失；不是当前候选已经解决的全部用户意图问题。domain/expert-collab-plan仍有6步投影；store计划项/constraints及材料数量上限保持原样。
- review组件`:657–677` API非ok会报错并返回false，未在该函数内假报送达；本轮没有新的renderer回归，未证明各种长文本拒绝/并发输入的组件状态都完整保留。review附件先取3项、每项8000及store材料32项仍是已知旧限制。
- 未新增总字节/累计正文预算。现有字段上限和数量边界不能称严格总资源预算，但本次没有资源耗尽/不可用复现，不据理论放大升级为P1。也未新增任何语义放行、工具授权或自动重试；保留未来单独边界验证建议即可。

### 复审结束时当前文件 SHA256

| 文件 | SHA256 |
|---|---|
| src/lib/task-text-contract.ts | 6f5723305304ece69606c6b2da0eb2c23b552501898e341d0a3e5492089ad268 |
| src/lib/workbench-task-store.ts | 084203ff0a04eff0295f80aa83faff8e9000db2213625ddd3c3be81472cc2bde |
| src/lib/expert-task-runtime.ts | 93581561a8fa0658d553ff03da0249df02d53704cb2b1017e7b32d480de03b49 |
| tests/rqa29-task-text-integrity.test.js | 5f19adf3cc2b1d40ba62566bf8f53396c1f48525f4901502c82adfff4f966683 |

再次核对expert-task-input与provided-materials仍为第6节原hash。以上是当前文件及离线测试范围，不是共享工作树或已加载QA进程的transitive冻结声明。

## 8. 长目标重复读取 P2 关闭复核（2026-09-06）

**结论：第7节重复get写回P2已关闭；本次限定复核未发现新增阻断项。独立实际82/82通过、0失败、0跳过、exit 0。** 保留第7节旧源复现及未覆盖边界，不将本次关闭扩大为所有读取都绝不写盘（既有快照升级、占位回填等有意迁移仍存在）。

### 源码及变更范围

`src/lib/expert-task-runtime.ts:270–276` 当前将confirmedGoal与两字段的 `taskText(...)` 比较，不再与默认2000字的 `text(...)` 比较。因此已经一致的3004字canonical目标不会误触发迁移；真正不同的旧占位字段仍进入原store.update分支。confirmedTaskGoal的选择顺序、占位识别、快照/证据核验及权限逻辑未改。

独立在内存将当前这一行的两个taskText比较还原成旧text比较，SHA256精确恢复第7节runtime指纹 `93581561a8fa0658d553ff03da0249df02d53704cb2b1017e7b32d480de03b49`。此操作没有写源码，也不是旧源红测；它证明相对前次已记录runtime正文仅这两个表达式变化。主线提供的旧源8过1失败仍标为主线观察，不冒称本轮独立运行了旧源。

按gitnexus-debugging技能执行query/context：query因FTS降级为空，context找到reconcileTask及execute/recoverQueuedTasks/reviewDeliverable来路，但标lower-bound且无process返回；据当前源码和测试确认结论，不将索引结果当安全证明，未修索引/联网。只读复核没有生产符号编辑；此前impact LOW为主线已执行记录。

### 独立实际定向命令

```text
node -r ./scripts/register-ts.js --test tests/rqa29-task-text-integrity.test.js tests/workbench-task-store.test.js tests/expert-task-recovery-boundaries.test.js tests/expert-task-runtime.test.js tests/rqa28-revision-context.test.js
tests 82 / suites 2 / pass 82 / fail 0 / cancelled 0 / skipped 0 / exit 0
```

包括当前9项RQA29；resolver附带的外层tests0汇总不重复计数。关键结果：

- `reading a canonical long goal twice does not rewrite the task`：两次真实runtime.get读取同一3004字目标，mock store.update调用记录严格等于空数组；没有仅检查返回文本而漏掉写回。
- RQA29 confirmed-plan长目标createStart→合法needs_input→store重开/runtime.get通过；store→review→重开→execute的mock生成接口仍收到完整目标/反馈。
- `workbench-task-store` 的confirmed plan替换legacy placeholder用例通过；`expert-task-recovery-boundaries` 的持久化plan同步旧占位且不生成消息通过；`expert-task-runtime` 的应用恢复占位回填通过。没有为避免重复写回关闭正常迁移。
- 相关已有输入原子拒绝、审批/未知操作checkpoint、执行证据、预算不足保留旧版及RQA28修订提示回归均通过。测试使用现有临时store和mock依赖；未调用QA、真实模型/工具、网络、安装或fullcheck，未修改源码和测试。

### 测试前后均一致的当前 SHA256

| 文件 | SHA256 |
|---|---|
| src/lib/expert-task-runtime.ts | d7481c56206bf765121541b6046baadb93f1676dbc7a4805cbb0a39ef5c08bda |
| src/lib/task-text-contract.ts | 6f5723305304ece69606c6b2da0eb2c23b552501898e341d0a3e5492089ad268 |
| src/lib/workbench-task-store.ts | 084203ff0a04eff0295f80aa83faff8e9000db2213625ddd3c3be81472cc2bde |
| tests/rqa29-task-text-integrity.test.js | 2039cbc06391f27cd766c51c6e871d7474892c8811913e7b966166cdc848066e |

本次仅追加本节。字段总字节预算、其它路由/材料/计划项边界保持第7节限定，不重新展开调查，不影响本P2关闭结论。
