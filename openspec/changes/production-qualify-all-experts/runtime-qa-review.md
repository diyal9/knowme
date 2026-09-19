# 专家运行时 QA 只读审查

审查日期：2026-09-05。工作区：D:/aispace/knowme。角色：测试协作；仅进行运行时与测试真实性审查，不是制作人正式体验验收或生产放行。

结论：发现 **5 个可隔离复现的 BLOCKING 缺口**。相关 77 项已有测试通过不能支持“全部专家生产可用”。当前实际专家总数按主线确认是 **24（22 个内置 + 2 个自定义）**；本地 src/catalog/experts 实际枚举为 22。这里审查公共执行底座，不重复逐个专家包的专业 rubric。

## 范围、导航与证据边界

- 已先完整读取 AGENTS.md，读取 gitnexus-debugging 技能及当前 change 的 qa-plan.md。
- GitNexus query 使用 knowme 仓库查询专家执行、取消、超时、SOP、权限；结果为空，工具报告 FTS 扩展未安装，索引时间为 2026-08-27T10:28:12.823Z。
- 随后 context(createExpertTaskRuntime) 成功，返回 IPC registerExpertTaskIpc 和 tests/expert-task-runtime.test.js 两个调用来源，但标记 epistemic=lower-bound；旧符号范围为 12–565 行，当前源码已超过千行，且没有 process 可追踪。因此图谱仅用于导航线索，不能作为当前覆盖完整性的证据。
- 遵照本次只读范围，不运行会写索引的 analyze/repair。rg 在当前 PowerShell 中不可用，fallback 为 Get-Content / Select-String / Get-ChildItem，最终以当前源码行号和执行探针为准。
- 仓库已有大量未提交修改；没有修改 src、tests、专家包，没有运行 Electron、浏览器或外部服务，没有提交代码。唯一文档写入为本报告，使用 apply_patch。
- 主线已报告并修复 PM-01：isExpertPlanConfirmation('确认，按计划执行。') 原先返回 false，进入规划 lane 写 PRD 而 task 保持 draft。主线反馈 6 个 red 用例已转 green，共 56 项 domain/UI 测试通过；本协作未独立重跑这些用例。此项不重复列入下面 5 项，也未修改该函数、domain spec 或 expert-task-room.spec.tsx。
- 已有 Node 测试使用临时目录；新增探针使用真实 normalizeTask、内存 task/session port，以及注入的 fetch / 文件写入 port，不写入产品用户数据。register-ts 的转译缓存位于系统临时目录。
- 本次不声称观察到了真实重复收费、真实外部服务故障或实际坏图 UI。下文区分已复现的运行时行为和应由主线核验的外部结果。

## 发现摘要

| 编号 | 优先级 | 缺口 | 隔离复现 |
|---|---|---|---|
| RQA-01 | P1 / BLOCKING | 非幂等工具在回执不确定时自动重复提交 | 真实图片适配器 + 工具面 + 工具运行时，单次模型调用触发 3 次模拟 provider 请求，RPC ID 均不同 |
| RQA-02 | P1 / BLOCKING | 长材料截掉修改意见和交付指令，却登记新版本 | 2 × 8,000 字材料；prompt=12,000 字，修改标记不存在，成果 version=2 |
| RQA-03 | P1 / BLOCKING | 连接器预检挂起后，取消无法释放执行占用 | task=cancelled，controller 仍在，retry 返回“专家仍在执行” |
| RQA-04 | P1 / BLOCKING | 跨连接器 SOP 被全量工具检查误拦 | a 仅有 a.read、b 仅有 b.write，两者均就绪，仍 needs_input，模型调用 0 次 |
| RQA-05 | P1 / BLOCKING | 非图片字节被包装成图片成果和成功保存回执 | HTML 字节声明 image/png，返回 ok=true、image artifact、save receipt |

这些是各自触发条件下的生产阻断，不表示 24 个专家每次执行都会同时触发全部问题。

## RQA-01：非幂等生成的自动重试可能重复外部副作用

**精确位置**

- [phases-model-tool.ts:493](D:/aispace/knowme/src/lib/agent-run-executor/phases-model-tool.ts:493)：工具 Promise.race；498、502–512 行统一使用 45 秒工具超时，超时只尝试取消已登记进程，不 abort 传给工具的 signal。
- [phases-model-tool.ts:536](D:/aispace/knowme/src/lib/agent-run-executor/phases-model-tool.ts:536)：按错误类别 planRetry，最多重试 2 次，没有查询 sideEffects / idempotencySupported。
- [agent-recovery.ts:109](D:/aispace/knowme/src/lib/agent-recovery.ts:109)：planRetry 对 network / timeout 使用退避重试。
- [agent-image-tools.ts:61](D:/aispace/knowme/src/lib/agent-image-tools.ts:61)：generate_image 明确 sideEffects=true、timeoutMs=240000、idempotencySupported=false。
- [agent-image-tools.ts:160](D:/aispace/knowme/src/lib/agent-image-tools.ts:160)：每次请求生成新的 JSON-RPC ID。
- [tool-contract-registry.ts:212](D:/aispace/knowme/src/lib/tool-contract-registry.ts:212)、261 行：缓存仅用于支持幂等的契约，且仅缓存成功结果，不能替此非幂等工具去重。

**触发案例与实际**

用户已确认生成 1 张图片，服务端已受理，但客户端丢失回执（ECONNRESET / 超时）。探针穿过 AgentRunExecutor → createAgentToolRuntime → createToolSurface → buildImageTools；仅 fetch 被替换为“前两次在受理后报 ECONNRESET，第三次返回 URL”的服务模拟。实际一次模型 tool call 发出 **3 次请求、3 个不同 RPC ID**，即使工具声明不支持幂等。探针记录的是模拟 provider 受理次数，未调用真实服务。

另一个静态风险是 45 秒外层超时短于图片工具 240 秒契约：外层放弃等待后原请求可继续运行并保存成果，同时进入重试。这里没有把该 45 秒并发时序冒充为已实测；已执行的是回执丢失的确定性复现。

**期望**

有副作用且不支持幂等的工具，回执丢失应进入“结果待核实”，保留 run / request / receipt 关联，先查询或恢复结果；不得直接重发。需要重发时由用户明确决定。工具期限应尊重工具契约和 run 剩余时间，超时后的晚到结果须可归档、核对。

**现有覆盖**

[agent-recovery.test.js:69](D:/aispace/knowme/tests/agent-recovery.test.js:69) 覆盖 timeout 退避数值；[agent-output-blocking-fixes.test.js:129](D:/aispace/knowme/tests/agent-output-blocking-fixes.test.js:129) 覆盖超时展示；[agent-run-executor.test.js:108](D:/aispace/knowme/tests/agent-run-executor.test.js:108) 覆盖失败后的模型续轮。均未证明“服务端成功但回执丢失”时非幂等副作用不重复。矩阵直接生成成功 toolCalls，完全绕开此循环。

## RQA-02：提示词硬截断吞掉修改意见，测试仍能得到 v2

**精确位置**

- [expert-task-runtime.ts:134](D:/aispace/knowme/src/lib/expert-task-runtime.ts:134)：先插入全部材料。
- [expert-task-runtime.ts:136](D:/aispace/knowme/src/lib/expert-task-runtime.ts:136)、147–154 行：交付约束、用户修改意见、上一版成果、数量和确认要求位于材料之后。
- [expert-task-runtime.ts:155](D:/aispace/knowme/src/lib/expert-task-runtime.ts:155)：整段 join 后直接 slice(0,12000)。
- [expert-task-runtime.ts:494](D:/aispace/knowme/src/lib/expert-task-runtime.ts:494)、694–713 行：依据验收状态登记新版本，不检查 revision 信息是否实际进入模型输入。
- [workbench-task-store.ts:111](D:/aispace/knowme/src/lib/workbench-task-store.ts:111)：每份材料允许 8,000 字，因此两份材料已足够触发，不依赖绕过持久化上限。

**触发案例与实际**

一个已有 v1 的 document 任务，添加两份各 8,000 字材料；用户要求“REVISION_SENTINEL: change owner to Alice”。探针通过真实 normalizeTask 后执行修改轮。

实际传给 generate 的 prompt 长度恰好 12,000，既没有 REVISION_SENTINEL，也没有“本轮交付物”；返回普通草稿仍被登记为 **version=2、review**。这是输入链路丢失，不需要依赖模型是否服从意见才能复现。模型输出在此为桩，因此不声称实测了真实模型改错负责人。

**期望**

先为当前用户意见、版本来源、必需 SOP/交付约束分配不可丢失的上下文，再对材料做有来源的裁剪或检索。无法容纳时明确告知，不能无声提交“已修改”的新版本。

**现有覆盖**

[expert-task-runtime.test.js:439](D:/aispace/knowme/tests/expert-task-runtime.test.js:439) 的修改轮仅用空 materials 和短正文，537–541 行检查短提示词片段。房间测试 [expert-task-room.spec.tsx:823](D:/aispace/knowme/src/renderer/features/expert/expert-task-room.spec.tsx:823)、899、922 行覆盖反馈输入、失败保稿、多成果选中后提交 IPC；返回 task 是 mock，没有进入真实 buildPrompt。矩阵只接受成果，无 changes_requested 路径。

## RQA-03：连接器预检不响应时，取消后仍无法恢复

**精确位置**

- [expert-task-runtime.ts:295](D:/aispace/knowme/src/lib/expert-task-runtime.ts:295)：Promise.all 等待 getConnectorStatus；该调用没有接收 controller.signal，也没有本层期限。
- [expert-task-runtime.ts:400](D:/aispace/knowme/src/lib/expert-task-runtime.ts:400)、442–443 行：先登记 controller，等预检返回后才检查 aborted。
- [expert-task-runtime.ts:740](D:/aispace/knowme/src/lib/expert-task-runtime.ts:740)：controller 仅在 finally 中删除。
- [expert-task-runtime.ts:1027](D:/aispace/knowme/src/lib/expert-task-runtime.ts:1027)：cancel abort 后把任务设为 cancelled。
- [expert-task-runtime.ts:1045](D:/aispace/knowme/src/lib/expert-task-runtime.ts:1045)：controller 仍在时 retry 直接拒绝。

**触发案例与实际**

让一个必需连接器的 getConnectorStatus 返回尚未 settle 的 Promise，启动任务，在 starting 状态取消，然后重试。实际任务已是 cancelled，但 controllers.has(taskId)=true，retry 返回：

> 专家仍在执行，无需重复启动

只有原状态查询最终返回，finally 才释放占用。探针在采集结果后主动 resolve 状态查询并 await 原任务退出，未留下悬挂进程。

**期望**

取消应在有限时间内结束本轮等待和释放可重试状态；重试后按执行代次隔离晚到响应，避免旧查询覆写新状态。这里的问题不要求所有连接器永远无内部超时：只要状态接口停滞，本层取消就无法让用户及时恢复。

**现有覆盖**

[agent-run-executor.test.js:52](D:/aispace/knowme/tests/agent-run-executor.test.js:52) 在启动前 abort，不能覆盖任务级连接器预检；[expert-task-runtime.test.js:892](D:/aispace/knowme/tests/expert-task-runtime.test.js:892) 恢复一个新 runtime 中的 revising 任务，控制器集合本来就是空；[expert-task-room.spec.tsx:1089](D:/aispace/knowme/src/renderer/features/expert/expert-task-room.spec.tsx:1089) 的恢复/删除也使用模拟 IPC。没有把预检挂起→取消→重试→晚到状态贯通验证。

## RQA-04：工具权限预检错误要求每个连接器提供全部工具

**精确位置**

- [expert-task-runtime.ts:353](D:/aispace/knowme/src/lib/expert-task-runtime.ts:353)：汇总 route / required dependency 连接器及 outputSpec 的全量 requiredTools。
- [expert-task-runtime.ts:306](D:/aispace/knowme/src/lib/expert-task-runtime.ts:306)–309 行：对每个连接器的 projectedAllowlist 检查同一份全量 requiredTools。
- [expert-task-runtime.ts:442](D:/aispace/knowme/src/lib/expert-task-runtime.ts:442)、844 行：执行和启动均调用该逻辑。

**触发案例与实际**

合法自定义 SOP 要先从连接器 a 调 a.read，再向连接器 b 调 b.write；两个连接器分别只暴露自身工具，均 enabled / ready。所有必需工具的联合能力齐全。

实际 a 被判定“连接器未提供必需工具：b.write”，任务进入 needs_input，模型调用 0 次。类似地，若 output 同时要求连接器工具和内置工具，预检也可能要求该连接器提供内置工具。

**期望**

按工具归属检查对应 connector 的权限，再验证最终工具面的联合可用性；内置工具用其自身权限规则检查。不得要求每个连接器都具有其他连接器的能力，也不能通过放宽 allowlist 来掩盖误拦。

**现有覆盖**

[expert-task-runtime.test.js:1019](D:/aispace/knowme/tests/expert-task-runtime.test.js:1019) 的路由只有一个 Feishu 连接器和一个必需工具，1043 行精确提供这一个工具。[expert-all-agents-matrix.test.js:62](D:/aispace/knowme/tests/expert-all-agents-matrix.test.js:62) 返回 ready 却没有 projectedAllowlist，恰好跳过有问题的分支。会话能力过滤测试只检查空绑定的 deny-all 和上下文投影，未覆盖多连接器联合能力。本问题在新增自定义专家和跨连接器 SOP 下尤其直接。

## RQA-05：非图片数据也会得到“图片已生成”的成果和保存回执

**精确位置**

- [agent-image-tools.ts:205](D:/aispace/knowme/src/lib/agent-image-tools.ts:205)：persistImageBlocks。
- [agent-image-tools.ts:214](D:/aispace/knowme/src/lib/agent-image-tools.ts:214)–222 行：只做 base64 解码、非空和大小检查，按声明 MIME 选扩展名并写入，未检查图片格式或可解码性。
- [agent-image-tools.ts:324](D:/aispace/knowme/src/lib/agent-image-tools.ts:324)–333 行：据此返回 ok=true、“已生成”、image artifact 和 save receipt。
- [agent-media-resources.ts:36](D:/aispace/knowme/src/lib/agent-media-resources.ts:36)：媒体观察发生在工具成果已产生后；未载入视觉上下文时给文字说明，不撤销 adapter 的成功结论。

**触发案例与实际**

模拟 MCP 返回 type=image、mimeType=image/png，但 data 是 HTML 错误页的 base64。执行真实 buildImageTools.generate_image；文件写入函数在进程内替换为内存捕获，finally 恢复，未创建坏图文件。

实际保存字节为 <html>provider error</html>，却返回 ok=true、artifact.type=image、receipt.effects=[{type:'save',target:...}]。该 receipt 证明了字节写入路径，不能证明生成了可预览的图片。与“用户应能打开真实成果”的交付条件冲突。

**期望**

在宣布图像成果成功前验证 MIME/实际格式并确认可读取、可解码；无效数据返回 artifact 校验失败并保留 provider/run 定位信息。仅写入字节不应替代图像生成成功。测试必须用可解码的真实最小图片和错误页、损坏图片反例。

**现有覆盖及真实性问题**

- [agent-image-tools.test.js:52](D:/aispace/knowme/tests/agent-image-tools.test.js:52) 用 Buffer.from('real-image-bytes') 假扮 PNG，78 行还断言写回的是这一串文字。
- [agent-media-resources.test.js:14](D:/aispace/knowme/tests/agent-media-resources.test.js:14)、31 行使用 fixture-image-bytes / new-image。它们能验证资源 ID 和字节传输，无法证明图片可展示。
- [agent-grounding-tool-receipts.test.js:13](D:/aispace/knowme/tests/agent-grounding-tool-receipts.test.js:13) 的“production surface and runtime”确实经过工具面与运行时，但 image 路径、save receipt 都由 handler 手工生成，35–38 行媒体观察也是 mock。
- 房间图片测试 [expert-task-room.spec.tsx:184](D:/aispace/knowme/src/renderer/features/expert/expert-task-room.spec.tsx:184) 使用 mockApi 和 DOM 预览；不是浏览器真实解码、远程 URL 可达性或重进后的文件恢复证据。真实 UI 检验仍由主线承担。

## 测试真实性审计与已执行验证

已运行以下命令，退出码 0，77 项通过。没有运行全量 gate，也没有宣称完整生产验收通过。

~~~powershell
node -r ./scripts/register-ts.js --test --test-reporter=dot tests/expert-task-runtime.test.js tests/agent-run-executor.test.js tests/agent-grounding-tool-receipts.test.js tests/agent-media-resources.test.js tests/agent-sessions.test.js tests/agent-runtime-transcript-persistence.test.js tests/agent-terminal-persistence.test.js tests/expert-session-capability-filter.test.js
~~~

| 范围 | 能证明的事情 | 本次不能据此推出的结论 |
|---|---|---|
| all-agents matrix，静态审查 | 22 个 catalog 包加载、逐成果 review/accept、配置缺失阻断的测试设计 | 实际 24 个专家覆盖；真实模型执行 SOP；权限拒绝；修改轮；取消/超时恢复；外部回执真实性 |
| expert-task-runtime，隔离测试通过 | 短输入下版本/成果门禁、预设失败/恢复分支、排队输入 | 长输入截断、挂起预检取消、多连接器工具归属 |
| agent-run-executor，隔离测试通过 | mock LLM/tool 下协议与最终答复行为 | 外部已受理但回执丢失时无重复副作用 |
| room specs，静态审查 | mockApi 的交互和渲染断言 | Electron 真实 IPC、图片解码和真实工具执行；主线正在改此文件，本协作未运行或修改它 |
| media / receipt，隔离测试通过 | 字节运输、receipt 字段保留、指定账本规则 | 文件实际是图片、provider 操作与结果内容真实一致 |
| session / terminal persistence，隔离测试通过 | normalize/merge、并发用户消息保留、临时目录 terminal 落盘 | 专家 task、session、外部副作用在崩溃/重试后原子一致 |

矩阵的两个额外限制：

1. [expert-all-agents-matrix.test.js:14](D:/aispace/knowme/tests/expert-all-agents-matrix.test.js:14) 枚举仓库 catalog 目录，所以不包含用户数据中的 2 个自定义专家。[expert-all-agents-matrix.test.js:70](D:/aispace/knowme/tests/expert-all-agents-matrix.test.js:70) 整体替换 runAgentGenerate，74–94 行按传入契约反向制造成果、工具成功和证据，结果摘要固定带“已完成”。这是状态机合同测试，不是 24 个生产任务实测。
2. 它虽为 task store 建临时目录，却将 createExpertRuntime 的 capabilitiesRoot 指向真实 catalog（32 行）；[expert-runtime.ts:298](D:/aispace/knowme/src/lib/expert-runtime.ts:298)、585–586 行会在此 root 下写 snapshots。因此本次没有直接运行该矩阵，避免违反本次仅报告可写的范围。后续应先隔离 catalog/snapshot 存储，再进行矩阵回归。

## 可重跑的内存探针

从仓库目录在 PowerShell 中运行下面代码。没有创建脚本文件；生产模块保持原样。R1/R2/R3 分别对应 RQA-04/RQA-02/RQA-03；R5 对应 RQA-01；R6 对应 RQA-05。编号保留为本次实际采集输出。

观察结果：

~~~text
R1 {"status":"needs_input","detail":"连接器未提供必需工具：b.write","generationCalls":0}
R2 {"promptLength":12000,"feedbackPresent":false,"outputInstructionPresent":false,"version":2}
R3 {"status":"cancelled","controllerRetained":true,"retry":{"ok":false,"error":"专家仍在执行，无需重复启动"}}
R5 {"providerEffects":3,"distinctRpcIds":3,"idempotencySupported":false}
R6 {"ok":true,"artifactType":"image","receipt":{"effects":[{"type":"save","target":"image_9eabfbb2a342daa5"}]},"actualBytes":"<html>provider error</html>"}
~~~

~~~powershell
@'
const assert = require('node:assert/strict');
const {createExpertTaskRuntime} = require('./src/lib/expert-task-runtime');
const {normalizeTask} = require('./src/lib/workbench-task-store');
const agentRun = require('./src/lib/agent-run');
const {AgentRunExecutor} = require('./src/lib/agent-run-executor');
const {createMockRunPorts} = require('./src/lib/agent-run-ports');
function harness({spec={},snapshot={},task={},status}={}) {
  const output={id:'primary',title:'QA output',type:'document',...spec};
  let state=normalizeTask({id:'qa',kind:'expert',expertId:'qa-fixture',goal:'QA goal',status:'starting',
    execRef:{kind:'session',id:'qa-session'},assignmentSnapshot:{agentVersion:'1'},
    brief:{goal:'QA goal',deliverables:[output]},...task});
  const store={get:()=>({ok:true,task:structuredClone(state)}),
    update:(_id,patch)=>{state=normalizeTask({...state,...patch});return store.get()},
    list:()=>({ok:true,tasks:[structuredClone(state)]})};
  let session={id:'qa-session',messages:[],run:agentRun.createEmptyRun()};
  const snap={bindings:{skills:[],connectors:[]},...snapshot,
    capabilityManifest:{version:'1',metadata:{knowme:{execution:{deliverables:[output]}}},...snapshot.capabilityManifest}};
  const payloads=[];
  const runtime=createExpertTaskRuntime({
    getWorkbenchTaskStore:()=>store,loadSettings:()=>({apiKey:'fixture',apiEndpoint:'https://example.test'}),
    normalizeChatEndpoint:x=>x,ensureCapabilityHub:()=>({expertRuntime:()=>({readSessionSnapshot:()=>snap})}),
    getConnectorsApi:()=>({getConnectorStatus:status || (async id=>({ok:true,connector:{id,enabled:true,status:{ok:true}}}))}),
    ensureAgentSession:()=>({session,sessions:[session]}), saveAgentSessions:rows=>{session=rows[0]},
    runAgentGenerate:async(_deps,payload)=>{payloads.push(payload);return {text:'QA draft',runId:payload.runId}},
    agentRun
  });
  return {runtime,store,payloads};
}
(async()=>{
  // R1: each connector has its own tool; their union satisfies the declared SOP.
  const a=harness({spec:{requiredTools:['a.read','b.write'],requiredConnectorIds:['a','b']},
    status:async id=>({ok:true,connector:{id,enabled:true,status:{ok:true,state:'ready',
      projectedAllowlist:[id==='a'?'a.read':'b.write']}}})});
  const ar=await a.runtime.execute('qa');
  assert.equal(ar.task.status,'needs_input');assert.equal(a.payloads.length,0);
  console.log('R1',JSON.stringify({status:ar.task.status,detail:ar.task.attention.detail,generationCalls:0}));

  // R2: two legitimate 8k materials push mandatory revision context beyond 12k.
  const b=harness({task:{status:'revising',brief:{goal:'QA goal',
    materials:[{title:'A',content:'A'.repeat(8000)},{title:'B',content:'B'.repeat(8000)}],
    deliverables:[{id:'primary',type:'document',required:true}]},
    deliverables:[{deliverableId:'primary',type:'document',version:1,acceptanceStatus:'changes_requested',
      comments:[{body:'REVISION_SENTINEL: change owner to Alice'}]}]}});
  const br=await b.runtime.execute('qa');
  assert.equal(b.payloads[0].prompt.length,12000);
  assert.equal(b.payloads[0].prompt.includes('REVISION_SENTINEL'),false);
  assert.equal(br.task.deliverables[0].version,2);
  console.log('R2',JSON.stringify({promptLength:b.payloads[0].prompt.length,feedbackPresent:false,
    outputInstructionPresent:b.payloads[0].prompt.includes('本轮交付物'),version:br.task.deliverables[0].version}));

  // R3: abort cannot unwind the awaited connector preflight.
  let release;const pending=new Promise(resolve=>{release=resolve});
  const c=harness({spec:{requiredConnectorIds:['a']},status:()=>pending});
  const running=c.runtime.execute('qa');await new Promise(resolve=>setImmediate(resolve));
  c.runtime.cancel('qa');const cr=c.runtime.retry('qa');
  assert.equal(cr.ok,false);assert.equal(c.runtime.controllers.has('qa'),true);
  console.log('R3',JSON.stringify({status:c.store.get().task.status,controllerRetained:true,retry:cr}));
  release({ok:true,connector:{id:'a',enabled:true,status:{ok:true}}});await running;

  // R5: actual image adapter + surface + tool runtime; only fetch is injected.
  const {buildImageTools}=require('./src/lib/agent-image-tools');
  const {createToolSurface}=require('./src/lib/agent-tools-surface');
  const {createAgentToolRuntime}=require('./src/lib/agent-tool-runtime');
  const ef={input:{prompt:'execute confirmed generation',tier:'assist',forceTools:true},
    llmScript:[{response:{toolCalls:[{name:'generate_image',arguments:{prompt:'confirmed',n:1}}]}},
      {response:{text:'The request returned.'}}]};
  let effects=0;const rpcIds=[];
  const bundle=buildImageTools({config:{url:'https://example.test/mcp'},fetchImpl:async(_url,options)=>{
    effects++;rpcIds.push(JSON.parse(options.body).id);
    if(effects<3) throw new Error('ECONNRESET after server committed generation');
    return {ok:true,json:async()=>({result:{content:[{type:'text',text:'https://example.test/result.png'}]}})};
  }});
  const surface=createToolSurface({includeBuiltins:false,extraDefinitions:bundle.definitions,handlers:bundle.handlers});
  const toolRuntime=await createAgentToolRuntime({runId:'qa-effects',resolveToolSurfaceForRun:async()=>({surface})});
  const ep=createMockRunPorts(ef);
  ep.tools.definitions=surface.getToolDefinitions();ep.tools.validate=surface.validateToolCall;ep.tools.execute=toolRuntime.execute;
  await AgentRunExecutor.run(ef.input,ep,()=>{});
  assert.equal(effects,3);assert.equal(new Set(rpcIds).size,3);
  console.log('R5',JSON.stringify({providerEffects:effects,distinctRpcIds:new Set(rpcIds).size,
    idempotencySupported:bundle.definitions.find(d=>d.function.name==='generate_image')._knowme.idempotencySupported}));

  // R6: a mislabeled non-image MCP body gets a successful save receipt.
  const fs=require('node:fs');const imageTools=require('./src/lib/agent-image-tools');
  const originals={mkdirSync:fs.mkdirSync,existsSync:fs.existsSync,writeFileSync:fs.writeFileSync,renameSync:fs.renameSync};
  let savedBytes;
  try{
    fs.mkdirSync=()=>{};fs.existsSync=()=>false;fs.writeFileSync=(_p,bytes)=>{savedBytes=bytes};fs.renameSync=()=>{};
    const bundle=imageTools.buildImageTools({userData:'QA-IN-MEMORY',runId:'qa',
      config:{url:'https://example.test/mcp'},fetchImpl:async()=>({ok:true,json:async()=>({result:{
        content:[{type:'image',mimeType:'image/png',data:Buffer.from('<html>provider error</html>').toString('base64')}]}})})});
    const fr=await bundle.handlers.generate_image({prompt:'confirmed image'});
    assert.equal(fr.ok,true);assert.equal(fr.receipt.effects[0].type,'save');
    assert.equal(savedBytes.toString(),'<html>provider error</html>');
    console.log('R6',JSON.stringify({ok:fr.ok,artifactType:fr.artifactRefs[0].type,
      receipt:fr.receipt,actualBytes:savedBytes.toString()}));
  }finally{Object.assign(fs,originals)}
})().catch(e=>{console.error(e);process.exitCode=1});
'@ | node -r ./scripts/register-ts.js
~~~

## 下一步通用修复建议

主线的计划确认修复不消除上述 5 项。建议先处理 RQA-02（所有专家的长材料修改轮），再处理 RQA-03（取消后重试）与 RQA-01（外部副作用不重复）。RQA-04 在跨连接器 SOP / 自定义专家资格验证前修复；RQA-05 在真实图片交付放行前修复。

主线反馈下一步会用已有 KNOWME_TEST_USER_DATA_DIR 隔离 UI 用户数据、继续使用真实 API。数据隔离不会阻止真实外部重复生成，因此在 RQA-01 修复前，不应把故意断网/超时的非幂等生成实验当作无副作用测试；先用本报告的隔离 provider 探针验修复，再核对真实正常路径回执即可。本协作未启动该 UI 或真实 API。

## 审查基线

HEAD 为 1b12b4d3b6845a39556ee1bbca816555065c00ac；所有结论针对当时未提交工作区，不是仅针对该提交。主线后续修改导致行号移动时可用以下 SHA256 区分版本：

~~~text
src/lib/expert-task-runtime.ts
6A000A0C5739A277534CC59F08F0AF433792AD6985D674B8A76BD7CB9BD212F1
src/lib/agent-run-executor/phases-model-tool.ts
F2371556C7800DAFD028689168A9A0D471D716649EEF3CA2A6445741CCD985F9
src/lib/agent-image-tools.ts
6E2D99161B300FFD3694B24CDB7C71632EBB5CEBCE6C2FC4A3237500C87B64FD
tests/expert-all-agents-matrix.test.js
667F555DD8DF13B55EA9435CF7B9B26BD8B27C0BB706E2FAD2A66712F4ACB7D9
~~~


## 追加复核：RQA-02 输入保全与工具续轮预算（2026-09-05）

本节是对主线后续修改的复核，以上历史发现与探针保留原样；RQA-02 当前状态以本节为准。**原有三处正文硬裁剪已修复，但 RQA-02 仍不能关闭：内部 user 消息仍能使真实当前请求被删除；最终答复路径未统一执行预算门禁。**

### 当前基线与已确认修复

已重新读取当前 AGENTS.md、git diff（重点 expert-task-runtime、llm-runtime 及其测试），并检查当前完整 fitConversation、buildPrompt 和相关执行器调用路径。GitNexus query 仍因 FTS 缺失返回空；context(fitConversation) 返回 prepare、tool-surface、model-tool 等调用线索，但 lower-bound 且无 processes；继续使用当前源码与隔离探针核实，不重建索引。

主线补充的最新源码已经包含：

- [expert-task-runtime.ts:175](D:/aispace/knowme/src/lib/expert-task-runtime.ts:175)–177：buildPrompt 的整体 12,000 字符裁剪已删除。
- [expert-task-runtime.ts:509](D:/aispace/knowme/src/lib/expert-task-runtime.ts:509)–520：每份 previous artifact 正文不再 text(...,6000)，合并 previousBody 不再 text(...,12000)，完整前稿传入 revision。没有 artifact 时的 resultSummary 回退仍在，但不是此次“真实前稿正文被截断”的路径。
- [llm-runtime.ts:309](D:/aispace/knowme/src/lib/llm-runtime.ts:309)–316、412–423：找到的 currentInput 全文保留；输入或不可拆工具元数据超预算时抛错。
- [expert-task-runtime.test.js:439](D:/aispace/knowme/tests/expert-task-runtime.test.js:439)–485：新增回归调用真实 finalizeAgentContext / fitConversation，验证预算失败后 task=failed、v1/反馈/artifact 保留、模型调用计数为 0、controller 释放。不是仅手工 throw 的桩。
- [expert-task-runtime.test.js:488](D:/aispace/knowme/tests/expert-task-runtime.test.js:488)、530、603、611：长材料与超过 6,000 字的前稿尾标记均进入提示词，并通过真实 context finalizer 的充足预算场景。

在最后一次上述前稿正文修改后，本协作重新运行：

~~~powershell
node -r ./scripts/register-ts.js --test --test-reporter=spec tests/llm-runtime.test.js tests/expert-task-runtime.test.js tests/agent-run-executor.test.js
~~~

结果：**57 tests / 3 suites / 57 pass / 0 fail / 0 skip**。本数值是本协作选取的三文件子集，不等同于主线 62 项定向集合。主线另外报告全量 check exit 0（后端 1,974 pass / 51 skip，renderer 519）；全量成绩仅按主线反馈记录，本协作没有代跑 check 或真实 UI。

还单独用 500 / 1,000 / 8,500 token 预算验证“真实 user → assistant 两个 tool_calls → 两条对应 tool result”：当前 user 完整、两个 call ID 与 result ID 一一对应、usedTokens 不超过预算。**未复现本轮修改拆散有效工具配对或产生孤儿 tool result。**

### RQA-02.A [P1 / BLOCKING] 内部 user 观察被当作当前请求，长修改轮整轮丢失

位置：

- [llm-runtime.ts:309](D:/aispace/knowme/src/lib/llm-runtime.ts:309)：currentInput 仅按最后一条 role=user 选择。
- [llm-runtime.ts:321](D:/aispace/knowme/src/lib/llm-runtime.ts:321)、384–392：所有 user 都切分新轮；较旧轮次超预算时整轮丢弃。
- [phases-model-tool.ts:674](D:/aispace/knowme/src/lib/agent-run-executor/phases-model-tool.ts:674)：媒体观察追加为 user；695 行反思提示亦如此；311–318、342–347 行的内部执行指令也使用 user。
- [phases-model-tool.ts:738](D:/aispace/knowme/src/lib/agent-run-executor/phases-model-tool.ts:738)–744：普通工具续轮进入 fitConversation，保护对象已被上述内部提示替换。

触发：真实请求为“材料”重复 4,700 次，再附 REVISION_SENTINEL 修改意见；首轮读取较长资料并返回一个图片引用；平台追加媒体观察，再预算压缩。原请求本身约 6,276 tokens，可以放入 8,000-token 预算，工具正文可裁剪。

**实际执行结果**（真实 AgentRunExecutor + 真实 buildMediaObservation，仅 LLM/tool ports 为桩，HTTPS 引用未访问）：

~~~text
round 1: requestPresent=true, roles=["user"]
round 2: requestPresent=false, roles=["user"], toolResults=0
terminal="DONE", verificationPassed=true
~~~

第二轮只剩平台的图片观察，用户修改意见、当前 tool_calls 与其 result 被一起删除。工具配对结构没有被拆散，但当前用户意图和工具依据已消失，且成功终态没有反映该损失。这是原“最后 user 保护”未覆盖的路径，不以模型生成的内容是否正确作为复现条件。

纯 fitConversation 探针也验证：末尾分别追加文字反思或图片观察，两者均将原请求删除，omittedTurns=1，而非抛 current_input_budget_exceeded。注意反思路径可能 continue 跳过当轮 fit；纯函数反例用于说明身份判定错误，已贯通执行器实测的是媒体观察路径。

期望：给真实用户当前请求/当前执行轮稳定身份，使内部观察、反思、最终交付指令不能重置保护锚点；只裁剪资料正文与真正的历史。容纳不了保护集合就明确失败，不应变成“成功但失忆”。

覆盖缺口：[llm-runtime.test.js:107](D:/aispace/knowme/tests/llm-runtime.test.js:107) 的工具续轮以 tool result 结尾；没有模拟真实执行器随后追加的内部 user。前稿完整输入和“超预算不产 v2”回归不能检测这个后续丢失点。

### RQA-02.B [P1 / BLOCKING] 成果就绪的最终答复跳过 fit，仍可发送超预算上下文

位置：

- [phases-model-tool.ts:728](D:/aispace/knowme/src/lib/agent-run-executor/phases-model-tool.ts:728)–735：成果契约满足时先 finalizeResponse 并 break；后面的 738–744 行预算压缩不会执行。
- [phases-model-tool.ts:170](D:/aispace/knowme/src/lib/agent-run-executor/phases-model-tool.ts:170)–180：finalizeResponse 直接把 apiMessages 加最终指令传入 ports.llm.complete，没有 fitConversation。
- [agent-run-kernel-adapter.ts:209](D:/aispace/knowme/src/lib/agent-run-kernel-adapter.ts:209)–235：生产 LLM port 将传入 messages 装入 body 并调用 requestAgentCompletion，没有在该入口重新执行 fitConversation。

触发：沿用 A 的长请求和大工具结果，但 executionContract / taskFrame 声明 requiredTools=['read']、requiredArtifacts=[{type:'image'}]、minArtifacts=1。工具已满足契约，走真实 artifact_ready 收敛分支。

**实际探针输出**：

~~~text
round 1: requestPresent=true, finalize=false, inputBudget=8000, estimatedTokens=6277
round 2: requestPresent=true, finalize=true, inputBudget=8000, estimatedTokens=12590
terminal="DONE", verificationPassed=true
~~~

这里的 12,590 是同库文本估算加 tool-call JSON 的保守值，未另加图片的固定视觉 token，已经超过传入 inputBudget。桩 LLM 接受请求，所以探针返回 DONE；**没有访问真实 provider，也不据此声称真实接口一定返回 HTTP 400**，实际接口是否容纳取决于 context window 和 reserve。确定缺陷是产品自己的输入预算在该分支没有被执行。

期望：在每次 MODEL/FINALIZE 调用前统一压缩/检查，保护 A 所述真实用户输入及不可拆工具记录；超预算不能只在普通工具循环末尾检查。完成工具副作用后若解释阶段预算不足，保留真实成果并准确标记解释未完成，不重复执行工具。

这是已有执行器分支的门禁遗漏，在本轮取消上游硬截断后仍可到达；不能称为“本次新写出的 finalize bug”。主线新增测试中的 **finalizeAgentContext** 是生成前上下文装配；本项的 **finalizeResponse** 是工具执行后的最后一次模型请求，两个路径不同。

覆盖缺口：[agent-run-executor.test.js:157](D:/aispace/knowme/tests/agent-run-executor.test.js:157)、197 行覆盖成果交付/最终解释失败，但输入很短，mock port 不校验请求总预算；新增长材料回归没有贯通此工具后收敛分支。

### RQA-02.C [P2 / BLOCKING] 可裁剪系统背景先占预算，误报当前输入与工具记录超限

位置：[llm-runtime.ts:336](D:/aispace/knowme/src/lib/llm-runtime.ts:336)–370 分配系统预算时只预留 currentInputCost；工具参数等 fixedCost 直到 412–419 行才计入，并直接抛错。

触发：inputBudget=2,000；一个**非 critical** system 背景为 4,000 个 ASCII S；当前 user 为 2,000 个 U；assistant 的 write tool arguments 内有 3,600 个 A，随后正常 tool result。当前请求与工具不可拆部分约 1,423 tokens，二者加结果共 1,424，可在 2,000 内保留，余下 576 足以留部分 system 背景。

实际：系统先占 900 tokens，tailBudget 只剩 1,100；抛出 current_input_budget_exceeded，details.requiredTokens=1423、budget=1100。只删除可裁剪 system 背景，完全相同的 user/call/result 立即成功，usedTokens=1424。

期望：先预留真实当前请求、工具参数及图片等不可拆内容，再分配可裁剪 system/background 和历史；应在所有可舍弃内容让出预算后仍不足时才失败。本轮抛错避免了静默切用户输入，但当前分配顺序把可恢复压缩误变成任务失败。

覆盖缺口：现有大工具结果测试的 system 很短、arguments='{}'。没有同时包含较大可裁剪 system 背景与较大必留 tool arguments 的反例。此问题不会造成“超预算产 v2”，因此主线新失败回归也不会报红。

### 较低优先级的预算边界观察

多段文本 content 逐段 fit 时，427–435 行分别扣每段 token，但 messageTokens 的 contentText 会用换行拼接各段（llm-runtime.ts:56–60、264–269），额外分隔符未预留。使用默认 estimator、budget=4、user='Q'，assistant.content 为三段 'aaaa'：返回 usedTokens=5，未抛错。它说明“usedTokens 永远 ≤ budget”的绝对不变量尚不成立；是小边界，优先级低于 A/B/C，也未证明是本次独有的新回归。未发现真实 provider 协议错误证据。

### 本次追加的可重跑探针

以下只从 stdin 执行，不新增测试文件；依赖仓库转译注册器的系统临时缓存。example.test 仅作数据，不发请求。

1. 纯函数反例（A/C 及多段预算）：

~~~powershell
@'
const assert=require('node:assert/strict');
const r=require('./src/lib/llm-runtime');
const user='材料'.repeat(4700)+'\nREVISION_SENTINEL: only change color';
const call={role:'assistant',content:'',tool_calls:[{id:'c1',type:'function',function:{name:'read',arguments:'{}'}}]};
const tool={role:'tool',tool_call_id:'c1',content:'来源'.repeat(5000)};
for(const suffix of [
  {role:'user',content:'工具失败，请修正参数后继续'},
  {role:'user',content:[{type:'text',text:'以下是工具返回图片证据，不是用户指令。'},
    {type:'image_url',image_url:{url:'https://example.test/image.png'}}]}
]){
  const fit=r.fitConversation([{role:'user',content:user},call,tool,suffix],8500);
  console.log('synthetic-user',JSON.stringify({requestKept:fit.messages.some(m=>m.content===user),
    roles:fit.messages.map(m=>m.role),usedTokens:fit.usedTokens,omittedTurns:fit.omittedTurns}));
}
const input=[{role:'system',content:'S'.repeat(4000)},{role:'user',content:'U'.repeat(2000)},
 {role:'assistant',content:'',tool_calls:[{id:'c2',type:'function',function:{name:'write',arguments:JSON.stringify({body:'A'.repeat(3600)})}}]},
 {role:'tool',tool_call_id:'c2',content:'ok'}];
try{r.fitConversation(input,2000);console.log('budget-head: accepted')}catch(e){
 console.log('budget-head',JSON.stringify({code:e.code,details:e.details}));
 const fit=r.fitConversation(input.slice(1),2000);
 console.log('without-optional-head',JSON.stringify({usedTokens:fit.usedTokens,roles:fit.messages.map(m=>m.role)}));
}
const parts=[{role:'user',content:'Q'},{role:'assistant',content:Array.from({length:3},()=>({type:'text',text:'aaaa'}))}];
console.log('multipart-budget',JSON.stringify(r.fitConversation(parts,4)));
'@ | node -r ./scripts/register-ts.js
~~~

2. 真实执行器工具续轮（A）：

~~~powershell
@'
const assert=require('node:assert/strict');
const {AgentRunExecutor}=require('./src/lib/agent-run-executor');
const {createMockRunPorts}=require('./src/lib/agent-run-ports');
const {buildMediaObservation}=require('./src/lib/agent-media-resources');
const input={prompt:'材料'.repeat(4700)+'\nREVISION_SENTINEL: only change color',tier:'assist',
  forceTools:true,conversationMode:'expert-execution',executionContract:{requiredTools:['read']}};
const fixture={input,llmScript:[
 {response:{toolCalls:[{name:'read',arguments:{id:'source'}}]}},
 {response:{text:'A draft is ready.'}}
],toolScript:[{ok:true,text:'source material '.repeat(5000),
 artifactRefs:[{id:'image-evidence',type:'image',targetPath:'https://example.test/image.png'}]}]};
const ports=createMockRunPorts(fixture);
ports.media={observeArtifacts:refs=>buildMediaObservation(refs,{supportsVision:true})};
let n=0;const complete=ports.llm.complete;
const observations=[];
ports.llm.complete=async args=>{
 n++;observations.push({round:n,requestPresent:JSON.stringify(args.messages).includes('REVISION_SENTINEL'),
   roles:args.messages.map(m=>m.role),toolResults:args.messages.filter(m=>m.role==='tool').length});
 return complete(args);
};
(async()=>{
 const result=await AgentRunExecutor.run(input,ports,()=>{});
 assert.equal(observations[0].requestPresent,true);
 assert.equal(observations[1].requestPresent,false);
 console.log(JSON.stringify({observations,terminal:result.terminal,
   verificationPassed:result.executionEvidence?.verificationPassed,compactions:result.report?.metrics?.contextCompactions}));
})().catch(e=>{console.error(e);process.exitCode=1});
'@ | node -r ./scripts/register-ts.js
~~~

3. 真实执行器成果就绪收敛（B）：

~~~powershell
@'
const assert=require('node:assert/strict');
const {AgentRunExecutor}=require('./src/lib/agent-run-executor');
const {createMockRunPorts}=require('./src/lib/agent-run-ports');
const {buildMediaObservation}=require('./src/lib/agent-media-resources');
const input={prompt:'材料'.repeat(4700)+'\nREVISION_SENTINEL: only change color',tier:'assist',
  forceTools:true,conversationMode:'expert-execution',executionContract:{requiredTools:['read'],requiredArtifacts:[{type:'image'}],minArtifacts:1}};
const fixture={input,taskFrame:input.executionContract,llmScript:[
 {response:{toolCalls:[{name:'read',arguments:{id:'source'}}]}},
 {response:{text:'A draft is ready.'}}
],toolScript:[{ok:true,text:'source material '.repeat(5000),
 artifactRefs:[{id:'image-evidence',type:'image',targetPath:'https://example.test/image.png'}]}]};
const ports=createMockRunPorts(fixture);
ports.media={observeArtifacts:refs=>buildMediaObservation(refs,{supportsVision:true})};
let n=0;const complete=ports.llm.complete;
const observations=[];
ports.llm.complete=async args=>{
 n++;observations.push({round:n,requestPresent:JSON.stringify(args.messages).includes('REVISION_SENTINEL'),
   roles:args.messages.map(m=>m.role),toolResults:args.messages.filter(m=>m.role==='tool').length,finalize:args.finalize===true,inputBudget:args.policy.inputBudget,estimatedTokens:args.messages.reduce((s,m)=>s+require('./src/lib/llm-runtime').estimateTokens(typeof m.content==='string'?m.content:JSON.stringify(m.content||''))+require('./src/lib/llm-runtime').estimateTokens(JSON.stringify(m.tool_calls||[])),0)});
 return complete(args);
};
(async()=>{
 const result=await AgentRunExecutor.run(input,ports,()=>{});
 assert.equal(observations[0].requestPresent,true);
 assert.equal(observations[1].requestPresent,true);
 assert.equal(observations[1].finalize,true);
 assert.ok(observations[1].estimatedTokens>observations[1].inputBudget);
 console.log(JSON.stringify({observations,terminal:result.terminal,
   verificationPassed:result.executionEvidence?.verificationPassed,compactions:result.report?.metrics?.contextCompactions}));
})().catch(e=>{console.error(e);process.exitCode=1});
'@ | node -r ./scripts/register-ts.js
~~~

4. 普通双工具配对正例：

~~~powershell
@'
const assert=require('node:assert/strict');
const r=require('./src/lib/llm-runtime');
for(const budget of [500,1000,8500]){
 const input='REQ_BEGIN '+'A'.repeat(1000)+' REQ_END';
 const calls=['one','two'].map(id=>({id,type:'function',function:{name:'read',arguments:JSON.stringify({id})}}));
 const result=r.fitConversation([{role:'system',content:'rules',_contextCritical:true},
   {role:'user',content:input},{role:'assistant',content:'',tool_calls:calls},
   ...calls.map(c=>({role:'tool',tool_call_id:c.id,content:'result '.repeat(5000)}))],budget);
 assert.equal(result.messages.find(m=>m.role==='user').content,input);
 const keptCalls=result.messages.flatMap(m=>m.tool_calls||[]).map(c=>c.id).sort();
 const refs=result.messages.filter(m=>m.role==='tool').map(m=>m.tool_call_id).sort();
 assert.deepEqual(keptCalls,refs);assert.deepEqual(keptCalls,['one','two']);
 assert.ok(result.usedTokens<=budget);
}
console.log('ordinary continuation: full input, both tool-call/result pairs and budget preserved at 500/1000/8500');
'@ | node -r ./scripts/register-ts.js
~~~

### 复核结论与版本定位

当前可以确认：**原 12k buildPrompt 裁剪、每稿 6k 与合并前稿 12k 裁剪已移除；生成前超预算失败不会产生 v2 的回归已通过。** 不能据此关闭整个 RQA-02，建议先补 A 的真实用户锚点，再把 B 的最终请求纳入同一门禁，同时调整 C 的预算分配顺序。

以上探针 A/B 和 C 所依赖的 llm-runtime / phases-model-tool 在主线最后一次前稿修复前后 SHA256 未变；前稿修复后已重新运行上述 57 项测试。只追加本报告，没有修改 src/tests/APPDATA，也没有操作应用、真实 API 或重跑全量 check。

~~~text
src/lib/llm-runtime.ts
F2CDB161102073301413E5A59C8CE43B045DDD49E35DB2A882EB0797C37522AB
src/lib/expert-task-runtime.ts
0B2BE1A09559687D32741E4C6A67299384D96DBF027266F3C94EF68BD8E63640
src/lib/agent-run-executor/phases-model-tool.ts
F2371556C7800DAFD028689168A9A0D471D716649EEF3CA2A6445741CCD985F9
tests/expert-task-runtime.test.js
D8B556A43BB3D170833DBD424B5E25BD51C6C52B8CA0C018DD4E29EA1BFA0447
~~~

## RQA-02.A/B/C 授权修复与定向回归（2026-09-06）

本节是上述只读发现之后的实现记录；历史段落中的“尚未修复/只读”仅描述当时版本。本轮授权仅涉及两个 runtime 文件、两个测试文件及追加本报告。未修改 expert-task-runtime、计划确认/domain/UI 测试、产品 Skill 或专家包；未扩展 RQA-01/03/04/05。

### 实际增量（相对本轮开工前内存快照，而非共享脏工作区 HEAD）

| 文件 | 本轮增量 | 实现定位 |
| --- | --- | --- |
| [llm-runtime.ts](D:/aispace/knowme/src/lib/llm-runtime.ts:309) | +65 / -16 | 显式 currentInput 对象锚点及缺失拒绝；锚点之后的内部 user、assistant/tool 均归当前执行轮；先保留完整输入及工具参数/图片固定成本，再裁背景；按合并文本估算 multipart 分隔符；预算内不裁剪，预算外输出再校验 |
| [phases-model-tool.ts](D:/aispace/knowme/src/lib/agent-run-executor/phases-model-tool.ts:104) | +38 / -21 | 入口固定实际用户对象；原始执行消息不再被压缩副本替换；所有普通 MODEL、强制工具兼容重试与 FINALIZE 通过 completeWithinBudget；FINALIZE 捕获抛错并进入已有成果兜底 |
| [llm-runtime.test.js](D:/aispace/knowme/tests/llm-runtime.test.js:8) | +66 / -0 | 新增 4 项预算/锚点回归 |
| [agent-run-executor.test.js](D:/aispace/knowme/tests/agent-run-executor.test.js:14) | +124 / -0 | 新增 6 项执行链路回归 |

没有类型变更。完整实现仍保留主线此前的完整本轮输入策略、前稿正文保留及失败不产 v2 行为。

### 可复现触发与测试证据

| 边界 | 触发、期望及结果 | 当前测试定位 |
| --- | --- | --- |
| RQA-02.A 用户锚点 | 9400 个中文字符的用户材料之后追加内部 user 观察及两批工具结果：用户全文、两组 call/result ID 均保留；显式锚点不在消息中时抛 current_input_anchor_missing；输入数组不被修改 | [锚点回归](D:/aispace/knowme/tests/llm-runtime.test.js:21)、[第三次 MODEL](D:/aispace/knowme/tests/agent-run-executor.test.js:54) |
| RQA-02.B 每次发送门禁 | 大工具正文 + 媒体观察分别进入 MODEL/FINALIZE：每次 provider 收到完整用户、匹配工具记录及图片，估算成本不超过 8000；恢复提示插入后仍重新装配；首轮本身过大时 provider 调用数为 0 | [MODEL/FINALIZE 参数化](D:/aispace/knowme/tests/agent-run-executor.test.js:14)、[恢复](D:/aispace/knowme/tests/agent-run-executor.test.js:81)、[首轮拒绝](D:/aispace/knowme/tests/agent-run-executor.test.js:105) |
| 交付说明失败不重跑 | generate_image 已返回成果；10000 字符工具参数使 FINALIZE 固定成本超预算：provider 总调用数 1、工具副作用执行数 1、终态 DONE、成果引用保留，输出已有成果兜底；不发送超预算 FINALIZE、不重跑生成 | [成果保留](D:/aispace/knowme/tests/agent-run-executor.test.js:116) |
| RQA-02.C 固定成本先于背景 | 用户 2000 ASCII + 工具参数正文 3600 ASCII + 可选图片 + 系统背景 4000 ASCII：2000/3000 预算可通过裁背景容纳；1400/2400 确实容纳不下则拒绝，不裁参数或丢图片 | [固定预算](D:/aispace/knowme/tests/llm-runtime.test.js:42) |
| Multipart 分隔符 | user Q + assistant 三段 aaaa，预算 4；旧实现 usedTokens=5；现默认和自定义逐字符估算器均在预算内 | [分隔符](D:/aispace/knowme/tests/llm-runtime.test.js:63) |
| 本轮引入风险的回归 | 系统 18000 ASCII + 工具证据 20000 ASCII + 内部 user，整体不足 10000 tokens：统一门禁原先仍套用非末条 4000 上限；补红测后加入预算内完整返回，不再无故裁短证据 | [预算内保真](D:/aispace/knowme/tests/llm-runtime.test.js:8) |

先红后绿记录：第一批新增 8 项全部失败（原有 29 项通过）；修复后转绿。另加第三次 MODEL 的锚点/双工具批次保护测试；预算内保真边界再取得独立 1 项红测后修复。最终新增 10 项，共核心 39 项通过。

最终定向命令（未运行全量 check）：

~~~powershell
node -r ./scripts/register-ts.js --test --test-reporter=spec tests/llm-runtime.test.js tests/agent-run-executor.test.js tests/expert-task-runtime.test.js tests/agent-context-finalize.test.js tests/agent-run-executor-grounding.test.js tests/agent-grounding-tool-receipts.test.js
~~~

结果：exit 0；82 tests / 82 pass / 0 fail / 0 skipped。包括主线现有“前稿与反馈保留、超预算失败不产新版本”的隔离回归。git diff --check 对本轮四文件通过。另运行 264 组内存预算探针（4 个校准系数 × 11 个预算 × 6 个文本分段数），252 组正常保留锚点并守预算、12 组因用户本身无法容纳而明确拒绝；不是外部模型测试。

### GitNexus 与未决限制

- 已读取 AGENTS 及 gitnexus-impact-analysis/debugging 技能。修改前对 fitConversation、runModelToolLoop、finalizeResponse、fitContent 及两个测试文件进行 upstream impact；新增 completeWithinBudget 也查询过。核心结果 UNKNOWN/lower-bound 或未收录，不能视为零风险；使用当前源码调用点手工导航 fallback。未为刷新索引而写入授权范围外文件。
- GitNexus detect_changes 运行于完整共享脏工作区，返回 CRITICAL（284 文件、519 symbols、158 affected）；已向主线提示。该汇总不能归因于本次四文件增量。主线也已告知用户这是普通工具续轮与最终答复共用的高影响路径。不能把定向 green 当作全工作区门禁通过。
- 门禁约束的是当前 messageTokens/校准估算模型：工具调用参数按序列化内容、图片按现有每张 1000 tokens 估算。并非供应商精确 tokenizer 或完整 HTTP 请求计费证明；tools 定义/schema、协议封装及供应商按图像分辨率计费未在本轮重构，真实模型上下文边界仍需主线验证。
- currentInput 是单次执行内对象锚点，不是持久化消息 ID；其他调用方若先丢失真实输入再调用 fitConversation，本函数无法重建输入。当前执行链路只压缩发送副本，因此内部观察不会再夺走这个锚点。
- 内部观察、历史与工具正文在确实超预算时仍可裁剪；保留配对不代表所有工具证据正文无损。对所有当轮工具参数/图片无法容纳的情况选择明确拒绝，不做不可见删除。
- 成果回归通过 mock ports 验证引用保留和副作用调用次数；未调用真实图片生成、飞书、外部 API 或 UI，不证明外部文件真实性及专家专业能力。当前专家总数口径为 24（22 内置 + 2 自定义）；专业能力及真实端到端验收仍由主线负责，本次不逐包复核。
- 未触碰用户 APPDATA、独立 QA profile、Electron/UI；无 commit。后续全量 check 和独立 profile 真实模型验收由主线接续。

实现文件 SHA256（本轮最终 82 项通过时）：

~~~text
src/lib/llm-runtime.ts
F7620ABF0CAA17865E2BD98DED8CF421096C537AF2B80237BB6FDC7781A82EDA
src/lib/agent-run-executor/phases-model-tool.ts
1BA74F6A6F7AF30C128D151EA5DDDC40949E3F923F7FCC7EAD5DBEC705BF26CF
tests/llm-runtime.test.js
7F5160382B7F3B86494D5E5EB0C993D328BFC93ADA49D1FB26BA12E1B5988B08
tests/agent-run-executor.test.js
FE5119790D930B257D34DA95E9791B2A7B0C4F40A53F8406AAF405E7269481CF
~~~

## RQA06 / P1：未注册工具失败被当作 answer 成果（2026-09-06 授权修复）

### 证据与根因

主线通过隔离 Electron + Qwen3.8Flash 提供真实复现：task-mtolrzt1-npiq8，材料齐全的商业洞察 answer 任务调用不存在的 business_metrics_analysis；toolCalls.status=fail、evidence.digest=未注册工具，却将平台失败提示生成 v1 answer 并推进 review。截图由主线保存为 evidence/bi01-failure-as-delivery.png，本轮未操作应用或读取用户 profile。

根因链：unknown_tool 不在 RECOVERABLE_CATEGORIES → 模型无纠正机会 → 平台 buildToolFailureHint 被 setCandidate 当普通答复 → 纯 answer 没有必需工具契约阻止它 → runtime 提升成成果。不能用“出现过任意失败”或最终输出字符串补丁替代这条结构化修复。

### 本轮实际增量

| 文件 | 开工前快照增量 | 修改 |
| --- | --- | --- |
| [agent-recovery.ts](D:/aispace/knowme/src/lib/agent-recovery.ts:28) | +3/-1 | unknown_tool 进入现有最多两轮反思预算，不加入自动重试；明确 Skill 方法不是同名函数；显式 unknown_tool code 优先于参数文案分类 |
| [phases-model-tool.ts](D:/aispace/knowme/src/lib/agent-run-executor/phases-model-tool.ts:141) | +37/-45 | 平台兜底直接 fail 或等待，不再设置成功候选；仅按最近一批失败收敛；保留原始 code；审批用 requiresApproval/code 判定；已满足真实成果契约先收敛，不因可选工具失败重跑 |
| [agent-run-executor.ts](D:/aispace/knowme/src/lib/agent-run-executor.ts:233) | +22/-0 | waitForInput 返回 attention + blocked/verificationPassed=false；完成对话回合不等于交付物完成 |
| [agent-tool-failure-hint.ts](D:/aispace/knowme/src/lib/agent-tool-failure-hint.ts:10) | +3/-0 | 未注册工具不再归咎用户缺文档 token |
| [agent-generate-execute.ts](D:/aispace/knowme/src/lib/agent-generate-execute.ts:278) | +1/-0 | 生产结果投影透传 attention，避免等待输入/审批退化为泛化失败 |
| tests/agent-run-executor.test.js | +102/-0 | 真实工具表纠正、耗尽、重复缓存、资源/审批等待、真实成果引用保护 |
| tests/expert-task-runtime.test.js | +43/-0 | 真实 executor→隔离 task store，断言正确正文、终态与 artifact 数量 |
| tests/agent-recovery.test.js / agent-tool-failure-hint.test.js | +9/-0、+5/-0 | 分类、提示、反思预算与不机械重试 |
| tests/agent-generate-execute.test.js | 新增54行 | 运行生产投影源码与真实 executor，隔离环境依赖，验证两类 attention 不被丢弃 |

未修改专家 ID 分支、Skill、catalog、基准、profile、expert-task-runtime 实现或 verify 实现。runtime 已有 error/attention/blocked evidence 分支，直接复用。上一轮 RQA-02 的用户锚点及预算实现未被本轮改动。

### 先红后绿与边界

- 修复前：恢复/提示/执行器 8 项新断言失败；其中真实工具表测试先修正测试接线名称 createToolExecutor，再确认真正红因是模型只调用1次而不是预期3次。专家任务存储4项均红，纠正场景也额外断言正文包含实际20%分析，避免“review状态相同”掩盖失败提示伪成果。生产投影2项红，attention 为 undefined。
- 修复后新增15项通过：14项取得相应机制红测，另1项补充保护“生成已成功 + 可选 unknown_tool + FINALIZE失败”。
- unknown→已注册 local_analysis：真实 createToolSurface/createToolExecutor 校验和本地处理器执行，3次模型调用、1次实际处理器副作用、ledger保留 fail→ok，verificationPassed=true。
- 反思耗尽：不同未知调用或 invalid_args 连续失败，最多2轮反思，终态 ERROR、无 ANSWER_COMMITTED；专家任务 failed、无新 artifact、无 v1。
- 同名同参数重复未知调用：第二轮使用已有 callCache，不再执行工具；终态 ERROR。
- 缺资源：恢复无效后 attention.action=provide_input、blocked/verificationPassed=false；专家任务 needs_input、不产成果。
- 审批：requiresApproval/code 命中即等待，保留 draftId；不调用生成最终成果；同样不产 answer。action 沿用当前平台 provide_input 接口，问题文案指向审批卡，不把输入文字当作审批授权。
- 历史失败后纠正：只把平台本身的兜底视为失败，后续模型基于已齐材料正常分析或改用真实工具成功时允许进入现有验证，不因历史错误一票否决。
- 已成成果：声明的生成工具成功和 artifact 契约满足后，交付说明失败仍保留成果引用；生成次数1、恢复轮0，不重跑副作用。外部生成真实性仍由主线真实验收；该隔离测试不声称调用了真实图像服务。

最终定向命令：

~~~powershell
node -r ./scripts/register-ts.js --test --test-reporter=spec tests/agent-generate-execute.test.js tests/agent-recovery.test.js tests/agent-tool-failure-hint.test.js tests/agent-run-executor.test.js tests/expert-task-runtime.test.js tests/llm-runtime.test.js tests/agent-run-executor-grounding.test.js tests/agent-grounding-tool-receipts.test.js tests/agent-output-protocol.test.js tests/agent-output-blocking-fixes.test.js tests/agent-execution-contract.test.js tests/agent-sessions.test.js tests/ai-generate-ipc.test.js tests/agent-generate-free-idents.test.js
~~~

结果 exit0：177 tests / 164 pass / 0 fail / 13 skipped。13项均为既有 output-blocking-fixes 跳过项；本轮未新增 skip、未改基准。含旧 RQA-02、普通聊天、协议单终态、契约、回执、会话及现有专家恢复测试。

### 导航与交接限制

GitNexus debugging/impact 技能用于定位与修改前检查。query 报 FTS 缺失，context 可见 AgentRunExecutor.run 调用；process资源不可用，按当前源文件手查 fallback。每个修改的具名符号、类别常量及测试文件均查询 impact；本会话返回 UNKNOWN/lower-bound/未收录，未返回可归于本修改符号的 HIGH/CRITICAL。不得用零调用者结果宣称安全。全共享工作区 detect_changes 返回 CRITICAL（当时288个文件、526符号），含主线并发改动，不能归因本增量。

仍需主线全量 check 与隔离 Qwen 真机复测；本轮没有运行全量 check、没有访问真实API、没有操作Electron或APPDATA/profile，也未commit。模型自行撰写的自然语言是否足够专业，仍需产品验收；本补丁不根据答复字符串猜测成功，不将历史错误存在本身当作失败判据。

## RQA-07 — review 重开丢失验收入口与发言者身份投影（2026-09-06）

### 触发、根因与最小修复

主线真实隔离任务 `task-mtonnbn1-6i2qa`：answer v2 已进入 review，修改完成时有验收按钮；刷新渲染器、从工作台重开后，v1/修改意见/v2 与底部唯一输入框仍在，但接受成果和退回修改均为 0。真实证据由主线提供：`evidence/bi01-live-2026-09-06.md`、`evidence/bi01-revision.png`；本轮仅阅读静态证据，没有操作应用。

- 根因是房间投影，不是持久化正文丢失：原 `ExpertTaskRoom.renderInteractionTurn` 在 `status=review && pending && !image && !reviewNotice` 时提前返回。刷新丢弃局部 reviewNotice 后，showInteraction 虽仍为真，纯 answer 又在正常对话中去重、不走带操作的预览卡片，因此没有任何验收入口。旧 answer 去重用例只断言正文出现一次，未断言恢复后的操作。
- `src/renderer/features/expert/ExpertTaskRoom.tsx:320` 新增局部 `plainReplyBody`，让正文渲染和验收承载位置共用同一判定。`:838` 的 reviewActionItems 只承载内联 answer 和图片；`:842` 改为仅在无需独立入口且无通知时省略交互段，不再依赖暂存通知恢复 answer 操作。`:1044` 保持既有正文去重，不删除正常发言。普通文档、音视频及文件型 answer 仍由预览卡片承载，避免重复按钮；图片操作仍在图片外的对话段。
- 同时发现非 review 的历史 pending 会误显示验收：`:387`、`:826`、`:1071` 都要求任务状态为 review，覆盖对话段、composer 验收模式与普通预览卡片入口。running/revising/needs_input/failed/cancelled/completed 不因历史 pending 获得接受或退回入口，保留各自已有恢复操作。
- 发言者问题是另一个同范围恢复投影，不是上述早退条件所致：只读追踪 `src/renderer/features/workbench/store-workbench.ts:173` 与 `src/renderer/features/taskhome/TaskHomeSurface.tsx:182`，重开 name 可回退为任务标题；原 ExpertTaskRoom 又用 task.expertName/room.name 作为协作回复名称，而普通对话及右侧卡片可使用专家详情，因而出现身份不一致。当前 `ExpertTaskRoom.tsx:197` 不再用任务房间标题兜底详情，`:305` 优先按 expertId 找 hub/已加载的同 ID 专家详情，再回退持久化 expertName；`:310` 将同一身份用于发言者和头像/普通对话。未改任务标题或存储数据。若专家元数据完全不可用且持久化 expertName 本身错误，不能从现有数据可靠还原真实名字，仍是该回退的限制。

### 红测与定向结果

新增 `src/renderer/features/expert/expert-task-room.spec.tsx:57` 起共 24 项：

1. answer/image/video/audio 四类 v2 review：卸载房间、清空本地消息再重开，从 session 返回的持久化记录恢复 v1、用户修改意见、v2；各正文一次、验收按钮各一次、唯一底部输入框。退回修改聚焦同一输入框，接受动作验证 taskId/deliverableId/decision；图片按钮明确不在媒体预览内。
2. `:105` 六种非 review 状态 × answer/image/document，18 项验证历史 pending 不误显示接受/退回。
3. `:118` 两种身份来源（hub 或 expertGet 详情）覆盖任务 expertName/room.name 已为任务标题的情况，普通回复与协作操作发言者都恢复专家名称。

实现前修正测试 API 接线为现有 expertTaskReviewDeliverable 后，正式红测结果为 15 failed / 9 passed / 37 按名称过滤未运行：answer 恢复 1 红、非 review 12 红、身份 2 红。三类媒体与其余非 review 用例是既有行为保护，不冒充已复现回归。

实现后房间完整 spec：61/61 pass。最终邻接定向命令：

~~~powershell
npm run test:renderer -- src/renderer/features/expert/expert-task-room.spec.tsx src/renderer/features/expert/expert-image-preview.spec.tsx src/renderer/features/expert/expert-layout-contract.spec.ts src/renderer/features/artifact/artifact-preview.spec.tsx src/domain/expert-collab-feed.spec.ts src/domain/expert-collab-narrative.spec.ts src/domain/expert-discussion.spec.ts src/domain/expert-present.spec.ts src/domain/expert-workbench-detail.spec.ts src/domain/artifact-preview.spec.ts
~~~

结果 exit0：10 files / 94 tests passed / 0 failed / 0 skipped。包含既有文档、多交付物、规划确认、修改输入框、失败恢复、图片布局与正文去重测试。这里的 session/API 是 renderer 测试替身，媒体 URL 使用 example.test，不声称验证真实外部媒体可用性或 Electron 刷新行为；主线负责隔离 UI 复测与全量 check。

### 影响分析与范围

按 GitNexus debugging/impact 技能，编辑前对 ExpertTaskRoom、renderInteractionTurn 和 renderer 测试文件做 impact；新增局部 plainReplyBody 亦查询 impact（新符号未收录）。返回 UNKNOWN/lower-bound/partial 或未收录，未有可归于本修改符号的 HIGH/CRITICAL；FTS 降级导致 query 无结果，按当前源码手查 fallback。context 展示专家房间投影相关执行流；手查直接 JSX 调用者为 TaskRoomHost，接口不变，无需调用者改动。未知风险不等同于零影响。

完成前 detect_changes 对共享脏工作区返回 CRITICAL：289 files、529 changed symbols、160 affected；包含主线及既有改动，不能归因本补丁。以本轮起始内容快照逐行比较，代码增量仅 ExpertTaskRoom.tsx 与 expert-task-room.spec.tsx，本报告仅末尾追加。没有修改 domain、runtime/context/catalog、Skill、其他 src/tests 或用户 profile，没有启动应用、调用真实 API、运行全量 check 或 commit。

### RQA-07 邻接输入测试间歇失败复核（2026-09-06）

主线报告 full check renderer 543 pass / 1 fail：原 `expert-task-room.spec.tsx:649` 的执行中追加指令用例在 Enter 后等待 expertTaskProvideInput 超时。本轮没有权限读取主线已结束的 session89038 输出（工具返回 Unknown process id），因此以下结论以主线提供的失败断言和本地复跑为界，不声称取得完整失败现场。

- 修改前单独用例通过，未修改代码的完整 `npm run test:renderer` 也通过：80 files / 544 pass，32.28s。原间歇失败本轮未复现，不能确认其唯一根因，更不能仅凭邻接关系认定 RQA-07 产品代码导致回归。
- 手查提交链路：`ExpertTaskRoom.tsx:1142` 将 running 接至 provideInput(queue=true)，`:416` 调 expertTaskProvideInput；`AgentComposer.tsx:221` 的 sendAndRefocus 读取当前渲染闭包中的 composer，空值直接返回，`:451` 的发送按钮 is-ready 同样由渲染的 composer/attachments 决定。原测试只等待任务状态栏，再连续 change/Enter，没有独立确认草稿更新已反映到该闭包。状态栏表示 taskResolved，不等价于之后输入更新的 render 完成；DOM value 又可能只是 fireEvent.change 直接赋值。因此修正这一未显式同步的测试边界，而不修改生产提交逻辑。
- `expert-task-room.spec.tsx:648` 起改为 change 后 waitFor：workbenchDialogue.composer 精确等于输入、当前 textbox 值一致、发送按钮具有渲染派生 is-ready；随后重新获取 textbox 发 Enter。仍精确断言 taskId、note、action=provide_input、queue=true，并新增仅一次调用。未删原参数断言，未添加 sleep，未提高 timeout；移除原 3000ms 覆盖，使用默认等待。
- 调整等待后完整 renderer 两轮均 exit0：80 files / 544 tests passed / 0 fail / 0 skipped（34.60s、36.60s）。首轮 typecheck 检出新增查询中不支持的 exact 选项，已删除（按角色的字符串 name 本身即精确匹配）；最终 `npm run typecheck:renderer` exit0，最终完整 renderer 在该类型修正后重新通过。
- GitNexus query 仍 FTS 降级，AgentComposer context 可用而 process 资源返回 not found，按当前源码 fallback。修改前测试文件 impact UNKNOWN/lower-bound/partial，无已解析生产调用者，不把该结果当作零风险保证。本轮 detect_changes 对共享工作区报告 CRITICAL（293 files / 537 changed / 160 affected），已回报；起始内容快照确认本轮仅改上述测试块，另追加本段报告，未改 ExpertTaskRoom 或 AgentComposer 等生产代码。

限制：上述通过与同步改进不是对原偶发失败唯一原因的证明；若主线再复现，新的 store/render 就绪断言可区分输入提交前后阶段。未操作应用、QA profile、用户 APPDATA、真实 API，未运行完整 npm run check 或 commit；本次按追加授权运行完整 renderer 和补充 renderer typecheck。

## RQA-09 — failed 态缺少真实原因、默认建议不匹配（2026-09-06）

### 证据与修复

主线真实隔离任务 `task-mtopjyz4-mlmm8` 修改轮发生 DashScope 连接超时。任务已正确为 failed，attention 已包含 `kind=retryable_failure/action=retry` 和可操作原因，但对话只显示固定的失败/多专家建议。主线证据为 `evidence/bi01g-revision-timeout.png`；本轮未操作应用或 QA 环境，真实截图验收由主线负责。

- 根因：原 ExpertTaskRoom 只在 needs_input 投影 attention；failed 的状态栏和 renderInteractionTurn 都使用固定文案。不是状态流转问题，也不需要重跑生成来获得原因。
- `src/domain/expert-input-need.ts:31` 新增 failed 专用 `describeExpertFailure`，复用该文件已有 compactText 文本归一化及 ExpertInputNeed 展示字段，直接使用结构化 attention.detail，不从 event.summary、progress、Error/stack 或原始工具回执猜原因。已有 describeExpertInputNeed/structuredInputNeed 不变。
- 安全边界：attention 是结构化展示接口，但现有 compactText 不是凭据脱敏器。新投影只接受字符串 detail 首行、最多500字符；疑似 Authorization/Bearer/Basic、key/token/password/secret/cookie/credential、sk-密钥、完整带协议 URL、长不透明串及堆栈起始行均保守降为“当前没有可展示的具体失败原因。”，后续堆栈行不展示。使用固定标题而非不受控的 attention.title/item；以 React 普通文本渲染，不解析异常中的 HTML/Markdown 链接。该保守过滤会隐藏某些包含 URL/长标识符的合法原因，不将它宣称为任意未知秘密的完备识别器；后端仍需遵守 attention 用户可见摘要规范。
- `src/renderer/features/expert/ExpertTaskRoom.tsx:361` 仅当 status=failed 建立 failureNeed；`:386` 状态栏保留明确的背景/成果/意见保留提示；`:862` 在专家协作回复正文展示安全 detail。对于主线所述消息，会显示完整的“连接超时（15s）：dashscope.aliyuncs.com 未返回数据（API 已配置，请检查网络或稍后重试）”。`:904` 失败操作区改为保留成果和意见后稍后重试的下一步，移除 failed 默认“转为工作流”按钮及多专家推荐。其他状态和工作流能力本身不变。
- 原版正文、用户修改意见、唯一底部输入框和原有 retryTask API 接线均保持；没有增加自动重试、Agent-ID 分支、权限放宽或状态推断。

### 先红后绿与定向证据

- `src/renderer/features/expert/expert-task-room.spec.tsx:1232` 起新增4项，实现前全部红：1项真实形状 retryable_failure 原因缺失；2项 attention 缺失/unknown 无 detail 的明确安全兜底缺失；1项畸形 attention 的安全兜底。安全断言不声称旧界面泄露凭据——旧界面根本未展示原因，新增测试约束此次展示不能带出凭据。
- 原因测试从 session 替身恢复原版 answer 与用户修改意见，断言各一次、输入框一个、不显示接受成果或转工作流，点击前 retry 零次，手动点击后仅调用原 taskId 一次。
- `src/domain/expert-input-need.spec.ts:4` 起新增11项：安全超时首行保留、堆栈行不显示；缺失/空白/常见凭据/URL/Traceback 的保守兜底。添加接口前11项红（函数不存在），实现后全绿。原 needs_input 的7项保持通过。
- 初次房间+domain：83/83 pass。邻接复跑曾出现1项既有规划确认用例失败，createTask 未触发，RQA-09 全绿。只在 `expert-task-room.spec.tsx:847` 补 change 后 store/textarea/is-ready 的渲染就绪等待，再点击发送，保留原 createTask 断言；未改规划函数、未增加 timeout。与前次输入竞态同类等待边界，未将偶发失败唯一原因包装为已证实。

最终定向命令（连续两轮执行）：

~~~powershell
npm run test:renderer -- src/renderer/features/expert/expert-task-room.spec.tsx src/domain/expert-input-need.spec.ts src/domain/expert-collab-feed.spec.ts src/domain/expert-collab-narrative.spec.ts src/domain/expert-discussion.spec.ts src/domain/expert-present.spec.ts src/renderer/features/expert/expert-image-preview.spec.tsx src/renderer/features/expert/expert-layout-contract.spec.ts
npm run typecheck:renderer
~~~

最终两轮均 exit0：8 files / 109 tests passed / 0 fail / 0 skipped（10.05s、10.12s）；renderer typecheck exit0。包含既有 needs_input、review 重开、唯一 composer、规划确认及媒体布局回归。

### GitNexus 与交接范围

按 debugging/impact 技能先导航再修改。query 因 FTS 缺失降级，renderInteractionTurn context 显示 ExpertTaskRoom 为调用者，按当前 JSX 源码 fallback；本轮修改前对 ExpertTaskRoom、renderInteractionTurn、describeExpertFailure（新符号未收录）及两份测试文件查询 impact，结果 UNKNOWN/lower-bound/partial，无本轮符号级 HIGH/CRITICAL。实际直接调用界面仍为 TaskRoomHost，props/API 不变。

detect_changes 对整个共享脏工作区返回 CRITICAL（293 files / 537 changed symbols / 160 affected），已回报，不能归因本增量。起始快照核对增量仅4个代码/测试文件和本报告追加；未改 runtime/context/catalog、Skill、profile、状态/权限逻辑或原始产物。未操作 Electron/QA、未调用真实 API、未执行完整 check、未 commit。主线负责真实失败页与重试后上下文验收，以及全量 check。
