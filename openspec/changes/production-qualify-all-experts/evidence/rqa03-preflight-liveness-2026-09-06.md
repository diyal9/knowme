# RQA03：预检挂起时的取消、重试与执行轮次边界

日期：2026-09-06。独立只读诊断；未实施修复。

## 结论

**缺陷成立，建议按 P1 处理。** 当 getConnectorStatus 或 getConnectorTools 的 Promise 永不返回时，现有宿主不能保证取消后的执行收敛或可靠重试。两个入口表现不同：

- execute：cancel 能把任务标为 cancelled 并 abort 已登记的 controller，但预检不观察 signal，execute 仍挂起，controller/心跳定时器不释放，retry 被“专家仍在执行，无需重复启动”拒绝。
- createStart：第一轮预检之前没有 controller 登记；cancel 只改状态，创建请求不返回。若旧预检以后返回成功，原 createStart 可覆盖取消状态及事件，并启动新的 execute。
- createStart 挂起期间取消再重试，可以产生并发执行、controller 被覆盖，以及旧执行 finally 删除新执行 controller 的竞态；后续取消可能无法触达仍在运行的执行。

这不等于证明某次实际 QA 的连接器已永久挂起。本次没有真实 API/UI retry。额外在真实 MCP HTTP 传输源码中，用假响应复现了“响应头完成、响应体不结束”导致底层超时已被清除的具体可达缺口。

## GitNexus / 范围可信度

本轮遵循 gitnexus-debugging、gitnexus-impact-analysis：先 query，再 context 与 upstream impact，并用源码和可控执行补证。

- query 返回空，提示 FTS 扩展加载失败；未下载扩展、重建索引。
- createExpertTaskRuntime 的 context 可见 registerExpertTaskIpc 及既有 runtime 测试引用。
- registerExpertTaskIpc 的 context 可见 registerCoreIpc 上游。
- preflightExpertTools 在图中未找到，impact 为 UNKNOWN；createExpertTaskRuntime 的 impact 也是 UNKNOWN、partial/lower-bound。返回 impactedCount=0 不能解释为没有调用者。
- 无可用流程成员关系；图中 runtime 行范围也小于当前源码。以下入口链以当前源码为准，不将不完整图结果包装成 LOW 风险或全覆盖结论。
- 没有生产符号编辑；若实施，需要重新对 runtime 生命周期、preflight 和可能的传输修改点做 impact，并与 main 协调。

## 真实入口与等待链

1. src/ipc/expert-task.ts:5–12：同一个 runtime 的 create-start IPC 直接返回 createStart Promise；cancel/retry 为独立 handler，没有 IPC 级截止时间包装。
2. src/lib/expert-task-runtime.ts:773、854：createStart 已创建/更新 task 和 session，随后进入第一次 preflight；此处 controllers 中没有本轮记录。
3. 同文件 :922、932：使用 captured created.task.events 更新状态/事件，再 fire-and-forget execute；等待后没有取消/轮次所有权检查。
4. 同文件 :366、395–406：execute 建立 controller、登记并启动心跳；登记前没有 controllers.has 单飞守卫。
5. 同文件 :437–438：await 第二次 preflight 之后才检查 signal.aborted。
6. src/lib/expert-task-tool-preflight.ts:83–85：Promise.all 等全部候选连接器；每个先 await getConnectorStatus(id)，再视需求 await connectorProjection。
7. 同文件 :12–16：若 status 没有 projectedAllowlist，connectorProjection await getConnectorTools(id)。这两个调用都没有 signal 或宿主独立 deadline。
8. runtime :1038–1056：cancel abort 已登记对象、写 cancelled；retry 只要 controllers.has 就拒绝。:751–752 的 finally 才清心跳并无条件 controllers.delete(task.id)。

取消 handler 自身能返回，不代表原 createStart/execute Promise 已退出，也不代表底层探测已停止。新建任务尚未返回 ID 时，UI 是否能提供取消入口还依赖 ID 获知方式；本次明确复现的是已知 taskId 的真实 runtime 路径，不声称覆盖真实 UI。

## 可控反例与观测

运行命令（仓库根目录）：

```powershell
node -r ./scripts/register-ts.js openspec/changes/production-qualify-all-experts/evidence/rqa03-preflight-liveness-diagnostic-2026-09-06.js
```

最终运行 exit 0，七个诊断用例完成。脚本断言的是**当前缺陷表现**，不是修复后的绿色回归测试。

| 反例 | 受控条件 | 直接观测 |
|---|---|---|
| execute/status | getConnectorStatus deferred 不释放 | cancelled、signal.aborted=true，但 execute 未 settle，controller=1、心跳=1，retry 被拒 |
| execute/tools | getConnectorTools deferred 不释放 | 同上；两个 API 实参均只有 connectorId，无 signal |
| createStart/status | 首次状态探测挂起，cancel 后手动释放 | create 请求此前未 settle，controller=0；释放后 started=true，进入假模型边界，取消事件丢失 |
| createStart/tools | 首次工具发现挂起，cancel 后手动释放 | 同上 |
| createStart/cancel/retry | 重试预检与旧创建预检交错释放 | 三次预检、两个心跳；旧创建发起的 execute 覆盖 retry controller；先结束的 execute 清掉另一个 controller |
| optional-provider | a 已提供全部 requiredTools，另一个允许但非必需的 provider 挂起 | Promise.all 不返回；将可选 provider 改为拒绝后，预检立即 ok=true |
| actual MCP HTTP/body | 使用真实 createMcpSessionForTransport，假 fetch 返回响应头，json() deferred 不释放 | listTools 不 settle，但剩余 deadline timer=0、signal 未 abort；手动释放 body 后才返回 |

竞态的准确时序：

A=createStart 首次预检挂起 → cancel → retry 启动 B 并登记 controller B → A 返回，启动 C 并覆盖为 controller C → B 返回并在 finally 删除 C 的登记 → 再次 cancel 找不到 C → C 返回后仍进入生成边界。

JSON 的 modelCallsAfterSecondCancel 是第二次取消之后读取的**累计数组**，不是两个调用都发生在第二次取消之后：第一个属于 B，发生在其之前；第二个属于 C，发生在其之后。两次 signal 都为 false。

模型边界是注入的 runAgentGenerate 替身，返回 diagnostic_model_boundary_stop；因此结果中的 failed 是诊断主动截停，不是对生产最终状态的预测。所有 runId 都来自合成任务。本次无真实模型、连接器网络调用、用户数据或真实 sleep。心跳/传输 deadline 都以假定时器记录，挂起 Promise 由脚本显式释放，结束时无遗留假定时器。

使用真实 runtime/preflight/任务规范化及注册治理逻辑，存储、连接器 API、生成边界均为内存替身；传输用例另直接加载真实 mcp-host 源码。没有启动真实 controller 外的另一个模拟状态机来代替被测生命周期。

## 底层超时：已有能力与缺口

src/lib/connectors/index.ts:48、151 的 API 没有任务取消参数。MCP 分支会把 probeTimeoutMs / healthCheck.timeoutMs 传给 connector-capabilities；不能声称整个栈没有超时。

src/lib/connector-capabilities.ts:80、189 通过 session.listTools 获取健康状态/工具投影，并在 finally await session.close。宿主没有独立包住包含这些等待的完整操作。

src/lib/mcp-host.ts:7 默认超时 15000ms，stdio 请求有超时；HTTP :298 设置 abort timer，但 :306 在 fetch 返回响应头后 clearTimeout，:307 才 await res.json。因此响应体不完成时，这个本地 deadline 不再存在。本次通过假响应体确认了该状态；真实网络栈仍可能有自身超时，未验证其最长时限，不能据此宣称真实现场必定永久卡住。即使下层最终返回，取消响应仍不应依赖该等待。

预检构建的工具元数据 timeoutMs=30000 属于后续工具执行，不是 getConnectorStatus/getConnectorTools 的宿主超时。

## 最小通用修复建议（待 main 决定，未实施）

建议将“最小”定义为覆盖完整任务轮次，不是仅替换 Promise.all：

1. 在第一次异步预检之前建立 attempt/controller 所有权；createStart、execute、retry 共用单飞与轮次判定，创建到执行显式交接或复用同一 attempt。不能让 execute 悄悄覆盖同 taskId 的活跃 controller。
2. preflight 接收 signal 和可配置的整体/探测截止时间。宿主对 status、tools 等待设置取消/超时退出，即使 provider 不响应 abort 也能 settle；能接收 signal 的底层继续传播。
3. 取消与超时分开处理：取消保留 cancelled；超时产出明确、可重试的结构化问题，不误报成永久缺配置，也不得把未验真的 requiredTools 当可用。
4. 每个异步返回后的状态写入及启动动作都核验本轮所有权；旧结果、晚到成功/失败不能覆盖新 retry 或复活 cancelled。事件基于最新记录追加，保留原任务目标、材料、上轮上下文及持久化语义。
5. 清理按对象身份/轮次归属执行，例如只在 map 当前对象仍是自己时删除；定时器/监听器归本轮管理。只在 cancel 时删除 map、但不阻断旧 continuation，会放大重试竞态。
6. 宿主 race 只终止等待，不等于真正终止不支持 abort 的底层工作；必须处理晚到 rejection，并隔离晚到结果。下层可取消能力与完整响应体超时可作为配套修复。

不要只换成 Promise.allSettled（仍等永久 pending）；不要只在 execute await 后补一次 cancelled 判断（createStart 和跨轮次覆盖仍在）；不要只增加 timeout（取消仍迟滞且竞态仍在）。

可选 provider 应有有界策略，但不得“第一个满足 requiredTools 就返回”而跳过强制连接器、ACL、重复投影/归属冲突检查。需要与现有 registry/governance 的可用工具并集及错误处理语义一致；超时是否视为可选缺席必须明确，未知状态不能伪造为已核验。

## 交叉 scope / 协调

- **核心必需**：expert-task-runtime.ts 的 createStart/execute/cancel/retry 生命周期；expert-task-tool-preflight.ts 的探测上下文与有界等待，及必要小型共享 helper。
- **配套传输**：connectors/index.ts 的向后兼容 signal 参数、connector-capabilities 与 mcp-host 的传播及响应体 deadline。共享入口影响其他调用者，不能视作仅专家任务私有更改；若单独授权，先做 impact。
- **IPC/UI**：当前 IPC 无需因内部生命周期修复而必然改协议；是否增加创建请求句柄/即时 taskId 是另一个产品范围。本次不建议借机修改 UI。
- **与 main 的交叉**：main 正改 registry/governance 枚举与 matrix fixture；本次未编辑它们。preflight 依赖这些模块判断工具并集，实施时必须在 main 最终枚举版本上补跑集成回归，避免把挂起修复掩盖为权限放宽。
- **其他 runtime 路径**：provideInput、recoverQueuedTasks、revise/queued input 同样可能进入 execute；轮次守卫不能破坏恢复与补充输入排队。图不完整，影响仍标 UNKNOWN。

## 修复验证清单

- [ ] status/tools 各自永不 settle：取消使宿主任务 Promise 在可控事件轮内退出，controller/心跳/监听器清零，retry 可启动一次。
- [ ] 取消发生于预检前、状态探测中、工具发现中、预检完成与启动生成之间；均不进入被取消轮次的生成边界。
- [ ] createStart 首次预检取消后晚到成功/失败：不改 cancelled、不删取消事件、不复活、不覆盖新轮次。
- [ ] 交错 createStart/retry/execute 与重复启动：单飞或明确拒绝；旧 finally 不删新 controller；再取消仍能触达当前轮次。
- [ ] 虚拟时钟覆盖 status/tools/整体 deadline 与实际 HTTP body 阶段；不以真实 sleep 测试超时。
- [ ] 不遵守 signal 的 provider 可被宿主脱离等待；晚到 rejection 不产生 unhandled rejection；底层可取消 provider 的 signal 确实传播。
- [ ] mandatory/optional、多 provider、工具并集、ACL、禁用连接器、重复投影与认证失败保持严格行为，requiredTools 和证据核验不放宽。
- [ ] 超时问题可重试，取消不改写成配置错误；重试保留输入、材料、上下文及消息持久化。
- [ ] 真 IPC handler 绑定下的已知 taskId 取消/重试、首次新建返回行为；不依赖只测私有 helper。
- [ ] queued input、revision、恢复入口不丢请求、不并发重放。与 main 枚举最终版固定 hash 后复跑定向用例，再由 main 决定整仓检查与隔离 QA。

## 文件与完整性

仅新增本报告、独立诊断脚本与结果 JSON：
- rqa03-preflight-liveness-2026-09-06.md
- rqa03-preflight-liveness-diagnostic-2026-09-06.js
- rqa03-preflight-liveness-diagnostic-2026-09-06.json

没有修改生产代码、既有 tests、枚举/matrix fixture、原始 QA 输入或用户数据；没有 API、fullcheck、commit。

本轮诊断前后下列 SHA256 一致（不是对并发工作区其他文件的锁定）：

| 文件 | SHA256 |
|---|---|
| src/lib/expert-task-runtime.ts | 2B02318E45545D0C1B64F475EC75233E0A7294A5D282B674476A00BEABC10280 |
| src/lib/expert-task-tool-preflight.ts | B87A59005EEAF2013250DB5EABF56D3712D98E6DAF3525597F192A71A5C395EF |
| src/ipc/expert-task.ts | 05864B0FEF4375F365C5BEA4D6DE5C1752610FCD09677F144738975BED345C90 |
| src/lib/connectors/index.ts | 1ABC76D9D351E5A8332094A3D769B1F5DE67F107B53DF0364870E699CCC1EE2C |
