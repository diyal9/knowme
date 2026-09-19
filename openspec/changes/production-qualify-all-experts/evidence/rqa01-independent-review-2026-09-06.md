# RQA01 独立只读安全复核 — 2026-09-06

## 结论

当前不能仅以12项定向全绿认定“不确定副作用不会重发”。本次找到3个P1级安全缺口，均以当前生产 executor 跑离线内存反例：第一次不确定操作后，第二个 handler 仍被执行；最终结果可到 verificationPassed=true。

未调用真实API/应用/QA，不改src/tests，不跑fullcheck。仅新增本报告。测试中的“effects=2”是内存计数模拟两次可能副作用的 handler 进入，不是声称外部目标已被真实写入两次。现有 event.payload 断言已修、12项通过，不将原测试断言错误算作生产缺陷。

| 编号 | P1风险 | 复现结果 |
|---|---|---|
| IR-01 | 内层deadline被包装成cancelled，外层未取消，漏掉不确定写入门禁 | 20ms内层/500ms外层以及20ms同期限均出现：handler进入2次、model2次、父signal=false、verified=true |
| IR-02 | 未标准化错误及registry丢失运输错误码，使非安全调用落入unknown后继续sibling/reflection | Bad gateway同批2次；reflection改参数2次/model3次；真实registry的ECONNRESET→tool_failed也复现 |
| IR-03 | 参数等文本匹配优先于明确tool_timeout，安全决策可被错误文案降级 | code=tool_timeout且text含“参数已发送，但连接超时”→invalid_args→同批2次、verified=true |

这些不是历史失败一票否决：问题是“本次可能生效但尚无确定回执”的调用未被隔离，后续执行不能证明第一次没生效。确知未执行的参数校验、unknown_tool、缺资源、审批，及已确认的成功成果，应分别保留原有合法恢复/展示路径。

## 导航与证据限制

- 已读AGENTS和gitnexus-debugging。query(tool retry timeout abort invocation policy)返回空并报告FTS extension缺失，索引时间2026-08-27；context(runModelToolLoop)只确认run调用该循环，epistemic=lower-bound。
- 因本轮只读授权，不修复索引/FTS或启动网络安装。降级为当前diff、完整相关函数、调用点和隔离运行；没有将旧图的缺边解释为不存在风险。无代码符号编辑，未申请impact，也未提交。
- git diff相对HEAD包含前轮累计改动；本报告按当前函数行为定位，不把全部diff归为本轮RQA01新增。
- 正确路径为 src/lib/agent-run-executor/tool-invocation-policy.ts，不是src/lib根目录。
- 已读Arendt正在修改的surface当前版本，确认call.signal/timeoutMs已透传。没有改其文件。IR-01是透传之后依然存在的取消原因语义问题，不是泛指signal尚未透传。

## IR-01 — deadline和用户取消混为一类，绕过executor的不确定结果保护

精确定位：

- src/lib/tool-contract-governance.ts:197 定时器abort；:205—237 invokeHandlerWithGovernance；:230—231 对所有abort都抛 code=cancelled。
- src/lib/tool-contract-registry.ts:277—279 捕获时先匹配 err.code=cancelled，优先于耗时判定，最终保留cancelled。
- src/lib/agent-tools-surface.ts:292—304 已将调用timeout转为剩余预算并传入handlerCtx，内层可能比外层更早到期。
- src/lib/agent-run-executor/phases-model-tool.ts:532—569 外层Promise.race；:602只看父signal是否aborted；:717只截停network/timeout；:442开始的sibling循环未被此次内层cancelled阻断。

触发：

1. 注册声明write/sideEffects=true、timeoutMs=500的真实registry工具；surface继承getRemainingTimeoutMs=20。
2. 模型同轮发出两个operation调用，参数不同；第一个handler进入后不返回，也不因signal停止（模拟已发出不可撤销请求）。
3. registry的20ms定时器abort，handler信号确实变为aborted；包装结果是 {ok:false,code:'cancelled',text:'cancelled'}，但Run父signal未取消。
4. 外层较长timer被正常清理；安全门禁既不将其视为取消整个Run，也不识别成不确定超时；于是执行第二个handler，随后允许成功答复。
5. 将工具契约改为20ms、内外同20ms，仍复现。内层计时先注册/扣除装配耗时，并不需要人为设置巨大期限差才能触发。

实际：inner result cancelled；effects=2；modelCalls=2；firstHandlerAborted=true；parentAborted=false；verified=true；没有operation_status_unknown attention。

期望：内层期限到期应保留timeout来源；对于非安全调用停在结构化不确定结果，不能继续sibling/reflection，不能普通成功交付。真正的父级取消仍返回cancelled。声明只读的内层超时应继续使用受限重试策略，而不是因“cancelled”分类无意失去该策略。

最小修正方向：跨registry/surface/executor保留abort来源（父取消/调用deadline/预算耗尽）及是否已进入handler；不能只把所有cancelled改成timeout，因为真正用户取消不可重试。若deadline前确知未进入handler，保持“未执行”的区别；不把该情形误称已生效未知。

现有测试缺口：agent-tool-retry-contract.test.js用ports.tools.execute直接返回永不settle的Promise，只触发外层makeToolTimeoutResult；不会经过真实registry内层timer，因此即使外层timeout/abort测试全绿也无法发现本问题。

## IR-02 — unknown错误可触发同批继续及模型重发；真实registry会制造这种unknown

精确定位：

- phases-model-tool.ts:582阻止非safe工具的直接backoff重试，这一层正确。
- 同文件:717的后续门禁仅含network/timeout；:755—778的反思没有非安全调用的“执行状态未知”约束。
- src/lib/agent-recovery.ts:18—29把unknown列为可恢复；:87默认unknown；buildReflectionNote允许更换工具或参数。
- src/lib/tool-contract-registry.ts:277—294将非cancelled、未超时的异常码统一为tool_failed，仅复制message，原始ECONNRESET码丢失。
- src/lib/agent-tools-surface.ts:354附近handler catch也会将throw压成tool_failed，缺少运输失败/执行阶段信息（行号以当前文件为准）。

触发A（同批）：write工具第一次进入后返回 {ok:false,code:'tool_failed',text:'Bad gateway'}；第二个operation参数不同。结果effects=2/modelCalls=2/verified=true。

触发B（模型恢复）：第一轮仅一个调用，返回同上；第二轮模型在reflection后调整value重新调用同一工具。结果effects=2/modelCalls=3/recoveryRounds=1/verified=true。工具缓存只阻止相同name+args的再次调用，不足以防止改参数/换工具重发同一副作用。

触发C（真实相邻链，不仅mock自造错误）：registry handler抛 Object.assign(new Error('fetch failed'), {code:'ECONNRESET'})；回到executor已变为tool_failed/fetch failed，classify落unknown；后续sibling执行，effects=2/modelCalls=2/verified=true。未访问网络，只在内存模拟丢失回执的运输错误。

期望：对于非声明安全且已进入handler的未知失败，默认不能证明副作用未发生，应阻断后续可能重发，并要求核对结果。不允许用“没有匹配到network正则”作为安全依据。应保留结构化错误类别/执行阶段/ack状态，而不是不断扩展自然语言关键字。

边界：未知工具名本身是在执行前校验失败，可继续有界纠正；确定未执行的invalid_args/审批/资源缺失也不能统一变成“可能已执行”。必须以宿主验证/handler执行阶段区分，不能单靠模型可见错误字符串。

现有测试缺口：thrown transport只让ports.tools.execute直接throw ECONNRESET且message也带ECONNRESET，外层catch保留原码，正则必命中；没有经过registry将原码抹掉的路径，也没有unknown失败+改参数/sibling反例。

## IR-03 — 明确超时码被普通“参数”文本抢先分类

精确定位：

- src/lib/agent-recovery.ts:61先匹配cancelled文本，:66—67匹配invalid_args/参数/argument；到:70才判断code=tool_timeout。
- phases-model-tool.ts:581、:717依赖同一个分类结果决定重试和截停。

触发：write/sideEffects=true工具返回 {ok:false,code:'tool_timeout',text:'参数已发送，但连接超时'}。classifyToolError实际返回invalid_args。同轮第二个操作照常执行，effects=2/modelCalls=2/verified=true。

期望：可信的规范错误码/宿主执行结果优先于文案；超时不能因提示中提到参数而变成安全参数修正。即便参数确实有错，也不等于能够证明先前副作用未发生。

修正不能只换一句超时提示：第三方/本地适配器错误文案不可穷举；安全动作应依据结构化类别和执行状态，不以“请补参数”“已取消”等任意子串覆盖可信code。错误分类可为UX保留启发式，但不应承载是否可重放的最终权限。

现有测试缺口：网络样例全部是纯ECONNRESET文本；deadline样例使用平台固定纯超时文案，无结构化code与混合message的冲突测试。

## 已验证正常的范围，不扩大结论

运行命令：

    node -r ./scripts/register-ts.js --test tests/agent-tool-retry-contract.test.js

结果12 pass /0 fail。未跑整仓测试。已知event.payload错误已不存在于当前结果。

- policy严格要求risk='read'且sideEffects===false；单有idempotencySupported不放行。无记录、risk read但无sideEffects以及write均不直接backoff重试。
- 正整型、有效计时上限以内的契约timeout使用该值，否则fallback；现有测试覆盖多种非法值。
- 声明安全read可执行400/800ms受限退避；退避中父abort阻止下一次调用。
- 外层timer可将本次invocation signal置aborted，父取消也透传，race会消费既有Promise的迟到reject；12项中这些路径正常。
- waitForInput标题按operation_status_unknown显示“需要核对操作结果”，并返回blocked/verificationPassed=false；本次漏洞在这些路径根本没进入waitForInput，不是标题分支缺失。
- cancel信号是合作式通知，不是撤销已到达远端的写入，也不是杀死任意CPU/忽略signal的handler。报告不声称Promise.race已物理停止副作用。
- 真实surface/registry检查的只是本地取消契约；未认证所有Connector/MCP/供应商SDK最终消费signal。该边界仍需主线负责实际集成验证。
- 不以任意历史错误阻止后来确定成功的结果；本报告只针对仍未消除的不确定副作用，避免无端伤害已验证artifact保护。

## 可执行离线复现

在D:/aispace/knowme PowerShell执行下列代码。仅使用mock LLM、内存handler与生产executor/registry/surface；无API、无userData，registry审计在userData缺省时不落用户目录。注册器仅使用既有系统临时TS编译缓存，不写src/tests。

```powershell
@'

const { AgentRunExecutor } = require('./src/lib/agent-run-executor');
const { createMockRunPorts } = require('./src/lib/agent-run-ports');
const { classifyToolError } = require('./src/lib/agent-recovery');
const { createRegistry } = require('./src/lib/tool-contract-registry');
const { createToolSurface } = require('./src/lib/agent-tools');
const contract={source:'builtin',capability:'diagnostic',risk:'write',sideEffects:true,requiresApproval:false,scope:'ephemeral',timeoutMs:500,idempotencySupported:false,rollbackSupported:false};
const call=(id,value)=>({id,name:'operation',arguments:JSON.stringify({value})});
async function run(label, errorResult, reflection=false, inner=false){
 const fixture={input:{prompt:'Perform one operation',tier:'assist',forceTools:true,conversationMode:'expert-execution'},llmScript:[
  {response:{toolCalls:reflection?[call('a',1)]:[call('a',1),call('b',2)]}},
  ...(reflection?[{response:{toolCalls:[call('c',3)]}}]:[]),
  {response:{text:'The operation returned a result.'}}
 ]};
 const ports=createMockRunPorts(fixture);let effects=0,modelCalls=0,seen=[];
 const complete=ports.llm.complete;ports.llm.complete=(...a)=>{modelCalls++;return complete(...a)};
 ports.tools.surface.getToolRecords=()=>[{function:{name:'operation'},_knowme:contract}];
 ports.tools.execute=async c=>{effects++;return effects===1?errorResult:{ok:true,text:'ack'}};
 if(inner){
   const registry=createRegistry();
   registry.registerTool({type:'function',function:{name:'operation',parameters:{type:'object',properties:{value:{type:'number'}}}}},contract,async(args,signal)=>{
    effects++; seen.push(signal);
    if(effects===1) return new Promise(()=>{});
    return {ok:true,text:'ack'};
   });
   const surface=createToolSurface({registry,includeBuiltins:false,deps:{getRemainingTimeoutMs:()=>20}});
   ports.tools.surface=surface;
   const executor=surface.createToolExecutor({getRemainingTimeoutMs:()=>20});
   ports.tools.execute=async c=>{const r=await executor.executeToolCall(c);console.log(label,'inner result',r.code,r.text,'parentAbort',ports.signal.aborted);return r};
 }
 const result=await AgentRunExecutor.run(fixture.input,ports,()=>{});
 console.log(JSON.stringify({label,category:classifyToolError(errorResult),effects,modelCalls,recoveryRounds:result.metrics.recoveryRounds||0,attention:result.attention?.kind,verified:result.executionEvidence?.verificationPassed,error:result.error,firstHandlerAborted:seen[0]?.aborted,parentAborted:ports.signal.aborted}));
}
(async()=>{
 await run('unknown sibling',{ok:false,code:'tool_failed',text:'Bad gateway'});
 await run('unknown reflection',{ok:false,code:'tool_failed',text:'Bad gateway'},true);
 await run('timeout masked by args text',{ok:false,code:'tool_timeout',text:'参数已发送，但连接超时'});
 await run('inner deadline before outer',undefined,false,true);
})().catch(e=>{console.error(e);process.exitCode=1});

'@ | node -r ./scripts/register-ts.js -
```

附加变体（保持上方脚本其余不变）：

1. IR-01同期限：将contract.timeoutMs从500改为20，仅保留最后一次run调用；结果仍为inner cancelled、effects=2、verified=true。
2. IR-02真实异常码丢失：将registry handler内的 if(effects===1) return new Promise(()=>{}); 替换为 if(effects===1) throw Object.assign(new Error('fetch failed'), {code:'ECONNRESET'});，仅运行最后一次run。输出第一项inner result为tool_failed/fetch failed；第二次为ok/ack，effects=2、verified=true。
3. 示例JSON里的category取自传入errorResult；内层变体该参数为undefined，所以category=null不表示真实内层结果成功。内层实际code请看紧邻的inner result日志。

## 建议主线追加的最小回归矩阵

| 路径 | 必须断言 |
|---|---|
| 非安全handler entered后unknown/502/fetch failed | 实际进入1次、模型1次、sibling未执行、无reflection，blocked且不产成功成果 |
| registry抛ECONNRESET但message不含该词 | 原始传输类别/不确定状态跨层保留；同上 |
| code=tool_timeout而message包含参数/permission/cancelled | 可信code或执行状态不被文本改写；非safe调用不重放 |
| 内层deadline较短及同期限，父signal未abort | 与外层timeout一致的不确定结果；safe read仅有界重试 |
| 父取消、退避取消、晚reject/晚resolve | 不新增调用/晚成功交付，无unhandled rejection；不声称撤回已生效请求 |
| 执行前invalid_args/unknown_tool、审批、明确未执行 | 保留有界纠正/等待路径，不被不确定写入统一截断 |
| 已确认成功artifact后可选失败 | 成果保留；新不确定写入不能被成功artifact掩盖，历史已纠正失败不误伤 |

## 当前审查快照 SHA-256

以下为复现时当前文件，不代表本代理更改了它们；主线/Arendt后续修改需按新hash重测，不把本报告视为对未来版本的结论。

- phases-model-tool.ts: E8FD6F87A95CFA2559D2787A8B8779F7B4BE6ED49E0BFE4C4DA89941ED4AD900
- agent-run-executor/tool-invocation-policy.ts: F68AD1765885A9C743B087C61ED0FBAB898048B78D457733568B9BC4A6405616
- agent-run-executor.ts: 69612B8A488C634445FC7065F607A296EBBA864109B748F4154EDD4FFC0F174F
- agent-tools-surface.ts: 2DDA5FD7780F5CB2BE44F0EAAF269AAB5F7291C492EDFCEFC94C8D25F7E3A7D3
- tool-contract-registry.ts: DA7F3BB5C09F72EB5794F27F42C5775CD15D5A1F0205CC5AC6BE466B6B6AD7E8
- tool-contract-governance.ts: CE38EFEFE9FBA8C9884CB84A56DF5A074AD56596C2BD5A344C48BAFDAD8D51A7
- agent-recovery.ts: 6C3C9BCD88FBC9B58477535D6D92B7544120A6D96665DCAA800E339C2391E051
- tests/agent-tool-retry-contract.test.js: B3A69D1EA69BE70E29B2800F74A74F08884E090C11620D4855328F6BA3236AE8

## 追加复核：原3个P1关闭，零预算裸surface残余单列（2026-09-06）

本节记录主线已收到的第二次独立复核，不覆盖前文历史发现及旧hash。结论仅绑定下列新快照，不自动覆盖Peirce后续零预算守卫修改。本次追加仅编辑报告，无源码/测试修改、API、UI/profile操作或fullcheck。

### 闭环结果与可信边界

- **IR-01关闭**：原内层20ms/外层500ms反例现返回tool_timeout，父signal未取消、handler信号已abort；仅进入1次handler、调用1次模型、无sibling/reflection，attention=operation_status_unknown、verificationPassed=false。定向回归另覆盖同期限、合作式AbortError、父取消及迟到reject。
- **IR-02关闭**：原unknown sibling和unknown reflection反例均在第一次不确定失败截停，不再改参数重发。真实registry保留运输错误码；无code Error和字符串reject实际返回tool_failed，不凭空虚构cancelled。
- **IR-03关闭**：tool_timeout配合“参数已发送，但连接超时”现分类timeout；更重要的是unsafe失败截停依据宿主执行状态而非code/文案分类。canonical code仅参与只读重试和UX。
- **伪造false不能放行**：额外跨层反例涵盖裸handler、真实registry内层handler、伪registry形状对象及公开isRegistryToolHandler属性；即使参数/返回对象含executionStarted:false，实际进入后均由宿主返回true，handler1次/model1次/blocked。
- **父取消**：进入前取消handler0次；进入后取消handler1次，返回cancelled。迟到reject被消费。
- **registry零预算**：经真实surface→registry，getRemainingTimeoutMs返回0时handler0次、executionStarted=false、code=tool_timeout。此为“工具未执行”保证，不等同强制整轮失败：无requiredTools的隔离fixture仍可继续模型文本答复；不将这一点冒称完成了工具操作。

独立内存反例未执行外部写入。signal仍是合作式取消通知，不代表撤销已经到达远端的请求，也不是CPU强制终止能力。未认证所有供应商SDK最终消费signal。

### 定向测试及快照时序

最终运行（exit0）：

```powershell
node -r ./scripts/register-ts.js --test tests/agent-tool-retry-contract.test.js tests/agent-recovery.test.js tests/agent-run-executor.test.js tests/tool-contract-execution-state.test.js tests/tool-surface-governance.test.js tests/agent-tool-execution-state.test.js
```

结果：**162 tests /162 pass /0 fail /0 skipped**，5 suites。首次五文件127通过，随后加入surface宿主状态测试完成上述六文件复跑；不将两次计数相加。原反例脚本与额外宿主状态反例也在最终源码下再次执行。

审查中surface由9878f439…更新为0ae7ba72…（加入执行前验证/摘要异常的宿主状态处理），已阅读该变化并在最终版本重跑；以下13份源码/测试hash在最后复跑收尾核验一致。未把早期结果套到未读新版本。

### 残余：裸surface零剩余预算仍进入handler

状态：**待Peirce入场守卫修复，尚未复验关闭**。主线已授权其同scope处理；后续本代理只复查该边界，不重新全面审查已闭环三层。

定位（下列surface hash对应行号）：src/lib/agent-tools-surface.ts:315—325。裸handler分支构造handlerCtx.getRemainingTimeoutMs，但没有先检查其结果便执行handler。registry具备预算入场拦截，裸surface不能借用该保证。

独立复现步骤：

1. createToolSurface({includeBuiltins:false, extraDefinitions:[声明write/sideEffects=true的operation], handlers:{operation:内存计数handler}})，不经过registry。
2. createToolExecutor({getRemainingTimeoutMs:()=>0})；通过生产AgentRunExecutor下发带正timeoutMs的operation调用。
3. handler将计数加1并返回{ok:false, code:'invalid_args', executionStarted:false}。
4. 实际handler进入**1次**，surface正确把执行状态纠正为true，主loop随后blocked；虽然没有重复写入，仍违反零剩余预算不应入场的边界。

对照：相同预算经registry路径handler进入0次。因此原3个不确定副作用重放P1已关闭，但不能宣称所有surface都已保证零预算不执行。

后续仅核对：0/负剩余预算阻止裸handler及相关直接runner入场并返回宿主false；正预算、原signal/timeout透传保持；registry原有零预算保证不回退。以Peirce实际最终改动范围选择定向测试，不扩大为fullcheck或真实API测试。

### 第二次复核 SHA-256（源码与定向测试）

- src/lib/agent-run-executor/phases-model-tool.ts: `40bb73aa4cc9d0305fdb509ccf3bfda00c8a0a573f545f6b9867a5c999b4c75d`
- src/lib/agent-run-executor/tool-invocation-policy.ts: `f68ad1765885a9c743b087c61ed0fbab898048b78d457733568b9bc4a6405616`
- src/lib/agent-run-executor.ts: `69612b8a488c634445fc7065f607a296ebba864109b748f4154edd4ffc0f174f`
- src/lib/agent-tools-surface.ts: `0ae7ba72aa1f6b306901905907bf535c98f07eefc52888cce91edd6c8477f836`
- src/lib/tool-contract-registry.ts: `cb41237c3baa8e27258363c47e378784eea3a6c748a40f87288ed299379351b1`
- src/lib/tool-contract-governance.ts: `423c9bcd238ae9c46ca18a9dde9582dcc99e635459f414edbcea36236fa4bbec`
- src/lib/agent-recovery.ts: `f03e52319a8de36f28917f24611966a84df783b1a4bcbc77d42f7133a74db7b4`
- tests/agent-tool-retry-contract.test.js: `505bf955cb6f10caf93150a56acc3bc514fa0e735418804ed7057c4bac448afa`
- tests/agent-recovery.test.js: `e933f2ead395cd39e8b18401673880ca2d1ae7efc23ac87f0eab1ab1b44df6e5`
- tests/agent-run-executor.test.js: `9aa1c3e6d5f559fe495ed0cb20f679de52950398d873fd63b2a89b7eb4ae4bcf`
- tests/tool-contract-execution-state.test.js: `ee42ab5937b613fed2a5646e9638a41f8153024fc51235dfb276728ea5eee028`
- tests/tool-surface-governance.test.js: `d08a4818c044b1fd9cb480c0c43cd0fa3b999ea61cf6f547e7c5aed1ae3d0f6f`
- tests/agent-tool-execution-state.test.js: `1cb71ae00b7f41649c5cd3e69ccb487ff7da744f3f0e37de573c8d9e685315cc`

上述hash为已完成复核的历史快照，后续源码发生变化时应附新边界复核hash，不替换本节。

## 追加边界复审：bare surface零预算入场残余关闭（2026-09-06）

本节仅复核Peirce新增的预算入场守卫，不重审全部源码，不替换前述3P1发现、162通过记录和曾经开放的残余状态。以下新证据确认**该零预算入场残余已关闭**；本代理仅追加报告，未改源码/测试、未调API/应用/profile，未跑fullcheck。

### 当前代码与覆盖范围

src/lib/agent-tools-surface.ts:219新增assertEntryBudget，从宿主deps.getRemainingTimeoutMs（或options.deps回退）读取预算；数值<=0时在实际调用前抛tool_timeout。四个内建runner（search_knowledge、fabric_search、kb_query、kb_get）及裸extra handler均在executionStarted=true之前执行该守卫。

守卫是入场检查，不是重写正预算deadline/取消策略；未知/未提供预算不被误判为0。模型参数中的budget/getRemainingTimeoutMs/timeoutMs不能代替宿主预算。此次认证的是零/负数及预算读取异常的已测边界，不声称所有任意类型/无效宿主预算都已有新的校验契约。

### 实际复核

仅运行预算相关定向用例（exit0）：

```powershell
node -r ./scripts/register-ts.js --test --test-name-pattern='surface entry budget|surface positive admission budget' tests/agent-tool-execution-state.test.js
```

**36 tests /36 pass /0 fail /0 skipped。**

覆盖5种入口各自的0、-1、正预算1000、未提供预算、预算函数抛错、预算属性getter抛错，以及options.deps回退；额外验证正入场预算不会延长registry较短deadline，原signal传递仍使handler信号在超时后aborted。

独立再次运行前一节原零预算fixture，仅选择registry-zero和raw-zero两项；使用生产AgentRunExecutor及真实surface/registry，mock模型和内存handler，不产生外部效果。两项均添加断言：handler调用数必须0，所有工具返回均为tool_timeout且executionStarted=false。结果：

| 路径 | 旧反例handler进入次数 | 本次进入次数 | 本次工具结果 |
|---|---|---|---|
| 裸surface，不经registry | 1 | 0 | tool_timeout，executionStarted=false |
| 真实surface→registry对照 | 0 | 0 | tool_timeout，executionStarted=false |

原fixture同轮有两个请求，两者都在入场前拒绝，不因第一个失败而偷偷进入第二个handler。该无requiredTools fixture仍可继续纯文本模型答复（modelCalls=2、verified=true）；这里只认证没有工具执行，不把纯文本答复解释为完成了外部操作，也不把这一既有语义扩大为本次预算守卫的重放缺陷。

### 本次边界复核 SHA-256

- src/lib/agent-tools-surface.ts: `46cb19f42972b59dbcff10ef8fdf32a55f0f6d148ca5ffd64ab864abd17d620a`
- tests/agent-tool-execution-state.test.js: `5145a6dc7ec504063247b7625cf5c9facfe71fdffb07a5a09cd23235132763f1`
- src/lib/tool-contract-registry.ts: `cb41237c3baa8e27258363c47e378784eea3a6c748a40f87288ed299379351b1`
- src/lib/tool-contract-governance.ts: `423c9bcd238ae9c46ca18a9dde9582dcc99e635459f414edbcea36236fa4bbec`
- src/lib/agent-run-executor/phases-model-tool.ts: `40bb73aa4cc9d0305fdb509ccf3bfda00c8a0a573f545f6b9867a5c999b4c75d`
- src/lib/agent-run-executor/tool-invocation-policy.ts: `f68ad1765885a9c743b087c61ed0fbab898048b78d457733568b9bc4a6405616`

surface由上一节0ae7ba72…先更新为43f0f26a…，收尾又更新为46cb19f4…；上述测试由1cb71ae0…更新为5145a6dc…。最后一次surface变化仅让私有WeakSet认证的registry wrapper沿用registry自身预算守卫，从而保留schema/ACL先验证的顺序；裸handler仍在入场前检查预算。已读取该局部差异，在最终46cb19f4…版本重新执行36项预算定向和原两项零预算反例，均通过。

另仅针对这一wrapper豁免补跑`registry trusted schema and budget rejection|registry execution ACL rejection`过滤的3项测试，3/3通过。最终边界复查共36+3项定向通过（分两次命令执行），并非重跑全部162项。registry/governance及loop/policy仍与上一轮已认证快照一致，不将历史计数相加冒充全量check。

### 最终冻结状态

本报告在surface `46cb19f42972b59dbcff10ef8fdf32a55f0f6d148ca5ffd64ab864abd17d620a`、测试 `5145a6dc7ec504063247b7625cf5c9facfe71fdffb07a5a09cd23235132763f1` 下完成最终复验；复验收尾hash未变。原3P1与裸surface零预算入场残余均已按各自记录闭环。本代理至此冻结报告，不再扩展源码审查或修改任何源文件；主线负责正在执行的全量check和实际集成验收。
