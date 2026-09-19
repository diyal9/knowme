# RQA03 宿主预检取消与轮次所有权：实施记录

日期：2026-09-06。main 授权核心修复；fullcheck 41442 green 仅作为修改前基线。

## 当前交付状态

核心实现及新增回归已落盘；**最终版尚不能宣布全部验证通过**。

初始六个生命周期反例及五项超时补充先红后绿；扩大回归曾 115/115 通过。之后补测规范化 taskId 单飞、同步启动异常清理，两项红测定位后已修正。但最终复跑被并发工作区的治理导出不一致阻断，测试尚未进入这两项最终断言。

阻断源：src/lib/agent-tools-surface.ts 的 authorized 调用 isOrchestrationToolName；其从 tool-contract-registry 解构导入该函数，而当前 registry 的 module.exports 尚无此导出，产生 TypeError: isOrchestrationToolName is not a function。这两个文件本轮未编辑，未打补丁或临时 shim 绕过。需要 main/治理修改方完成对应导出后重新跑下面的定向命令。

## 本轮修改范围

仅修改/新增下列源码和测试：

- src/lib/expert-task-runtime.ts：createStart/execute/cancel/retry 生命周期；预检 attention、桥接参数及进度事件的本轮身份守卫。
- src/lib/expert-task-tool-preflight.ts：status/tools 的有界等待，整体预检预算，取消/超时结果分类。
- 新增 src/lib/expert-task-preflight-wait.ts：宿主等待边界与资源清理 helper。
- 新增 tests/expert-task-preflight-liveness.test.js：18 个离线测试，真实 runtime/preflight/IPC 绑定，使用内存服务、受控 Promise 和假时钟。

原诊断脚本、原始回执/QA 数据不改；未改 connectors/mcp-host、UI、registry/governance、tool-surface、包或既有测试。未跑 fullcheck、真实 API、QA 或 commit。

## 重新 impact / 风险

本轮完整阅读 gitnexus-debugging 和 gitnexus-impact-analysis 后，执行 query、context、upstream impact。

- createExpertTaskRuntime、execute、createStart、cancel、retry、preflightConnectors：UNKNOWN，partial/lower-bound，无完整调用边；不能将 impactedCount=0 解释为零影响。
- preflightExpertTools、connectorProjection、preflightAttention：图中未找到，UNKNOWN。
- emitProgress 的补充 impact 也为 UNKNOWN；其所属 execute/runtime 已在修改前做过 impact。
- context 确认 registerExpertTaskIpc 和既有 runtime 测试调用入口；query FTS 降级，无可靠流程成员。
- 源码确认的共享路径包括 IPC、provideInput、reviewDeliverable、recoverQueuedTasks。对应输入续跑、版本修改和恢复回归纳入测试。
- detect_changes(scope=all) 扫描整个并发脏工作区：297 文件、544 changed symbols、160 affected，risk_level=critical。已告知 main；这不是本轮四文件的独立影响评级，不能用它宣称 RQA03 scope 已全图确认。没有越权修复其余文件或提交。

## 实现语义

### 轮次与单飞

controller 对象本身是本轮所有权标识。createStart 在第一次异步预检前登记；execute 在原始 ID 与 store 返回的规范化 ID 上检查活跃轮次。重复 create/execute/retry 返回 task_busy，不覆盖当前 controller。

createStart 预检后的每次状态更新/启动前核验 controller 身份与取消状态。成功时同步释放预览所有权并调用 execute 建立执行轮次，交接中没有 await。旧 createStart 的 finally 只清理仍属于自己的登记，不删除新 execute。

execute 在预检返回、生成返回、异步进度回调和心跳处校验所有权；旧回调不能修改新轮次。finally 只删除自己的 controller，且只由该轮处理队列；同步启动持久化异常也纳入 try/finally。

cancel abort 当前 controller、保留 cancelled 事件、清除取消轮次的排队标记。预检等待在 abort 后的 Promise continuation 中收敛并释放所有权；随后允许 retry。不是通过提前删 map 来伪造取消完成，也不承诺同一个同步调用栈内紧接 cancel 的 retry 必然已可启动。

### 有界预检

默认每个 status/tools 阶段 15000ms，整个一次 preflight 30000ms；分别可通过 runtime 依赖 preflightProbeTimeoutMs / preflightTimeoutMs 传入。底层 preflight 参数为 probeTimeoutMs / timeoutMs。非法、非正值回落默认；不是 0 表示无限等待。

每个 provider Promise 接入宿主取消/超时 race：晚到成功不继续发现工具、注册投影或写 task；晚到 rejection 始终有 handler 消费。整体超时使所有宿主等待脱离，finally 清理总定时器与外部 signal listener，各等待清理阶段定时器与监听器。

本轮不修改连接器 API 参数签名，不向底层新传 signal；**宿主停止等待不等于底层连接、进程、请求或模型已经停止**。也没有为 runAgentGenerate 新增通用超时；生成阶段仍依赖已有 controller 协作。

取消返回 cancelled 分支，不伪装成能力不可用。超时 issue 含 code=preflight_timeout、stage=status/tools/overall、retryable=true；runtime 返回 preflightIssues，并持久化 retryable_failure/retry attention。超时进入 failed，避免旧队列 finally 自动重试覆盖“请重试”；原任务材料和事件保留。

### 权限与输入边界

mandatory/optional 的既有投影、ACL、denylist、真实发现、provider 身份及重复归属检查保持；未扩大注册/授权。可选 provider 阶段超时沿用“可选失败不否决已确认完整并集”政策；整体超时不放行。没有改为“发现第一个满足工具集合即提前成功”。

createStart 预检期间的 provideInput 现在能识别活跃轮次并排队；手动补充的材料和 input_queued 事件从最新 task 合并保留，成功交接前消费该预览队列，单次执行收到新增材料。execute 的正常队列续跑、已有修改/恢复语义仍由原路径处理。

## 红绿证据

全部日志在同名 JSON 中，不以 exit 0 的旧诊断脚本当作修复回归。

| 阶段 | 结果 |
|---|---|
| 生产改动前：六个生命周期反例 + 四个入口/阶段超时 + 整体超时 | 11 fail / 0 pass |
| 首轮实现 | 11 pass |
| 与原 runtime/preflight/required-skills/profile 联合回归 | 110 pass |
| 新增排队、IPC、资源清理边界 | 15 pass / 1 fail；失败证明超时自动续跑 |
| 超时停为 retryable failed 后联合回归 | 115 pass |
| 再补规范化 ID 和同步启动异常 | 16 pass / 2 fail；随后已修正 |
| 最终联合复跑 | profile 5 pass，4 个测试文件加载失败；治理导出错误，不计为最终修复绿测 |

新增测试覆盖：两阶段 execute 取消/重试、两阶段 createStart 取消不复活、交错轮次/重复启动、可选 provider 有界并集、两入口两阶段结构化超时、整体预算、晚到 rejection、预览排队材料、超时排队保护、真实 IPC 新建/既有 ID、helper 各出口定时器/监听器、规范化 ID、同步启动异常清理。

静态检查：node scripts/lint.js exit 0（含 architecture/nocheck；现有 renderer 文件 1343 行 advisory warning）；最终四文件 vm.Script 语法检查与定向 git diff --check exit 0。静态结果不替代被阻断的运行回归。

重验命令：

```powershell
node -r ./scripts/register-ts.js --test tests/expert-task-preflight-liveness.test.js tests/expert-task-tool-preflight.test.js tests/expert-task-runtime.test.js tests/expert-required-skills.test.js tests/expert-execution-profile.test.js
```

## Hash 交接与 main 剩余项

最后修改在 41442 基线之后，不能用其 green 覆盖本轮。以下为最终语法/diff 检查时 SHA256：

| 文件 | SHA256 |
|---|---|
| src/lib/expert-task-runtime.ts | A713519A70AB9D7AD8747EBF7E58F9F8BFCDAC47C571C9BF3D1356B003FE0D55 |
| src/lib/expert-task-tool-preflight.ts | F89C3DE9F89A5B21119D0F4D6BE6F0C3F10C77912E45C6CF6B180806275E07B9 |
| src/lib/expert-task-preflight-wait.ts | 17E3497A7920AB94D7D3637C5152AC758679170AC3B403D17B96563B05EB70F7 |
| tests/expert-task-preflight-liveness.test.js | A6C8731EE55AD04A3F5B0A9464770D2DF91765202F79EBA2DCB6CA5AAD8B5F53 |

原 rqa03-preflight-liveness-diagnostic-2026-09-06.js 的 SHA256 前后一致：8D3175FC3FC191CC70804DE051AF17B01F8176BC5507207C6EBCFDEA748DC443。

阻断时只读记录：agent-tools-surface.ts=4AE99DF3D0B5F48C344A82A3A02EDA482A0A0B3FE1F1BC0692A48FCE7F058B2D；tool-contract-registry.ts=DA7F3BB5C09F72EB5794F27F42C5775CD15D5A1F0205CC5AC6BE466B6B6AD7E8。

main 剩余：协调完成治理导出一致性，再对上述最终 hash 重跑定向回归；通过后由 main 决定整仓检查和隔离 QA。本轮没有恢复或覆盖他人治理修改，也没有把此前 115 项通过冒充最终版通过。

## 追加：RQA01 类型透传完成后的最终重验

2026-09-06：共享加载阻断已消失；RQA03 全部 18 项最终断言已实际通过。随后按 main 授权修复 runtime 的 typed attention 透传及 provide_input 暂停点，补充 9 项回归，五文件联合最终 126/126 通过；lint、定向 diff 检查通过。原诊断脚本不变。

本节更新此前“最终回归被阻断”的当前状态，历史红绿日志保持原样。最新 runtime/tests hash、RQA01 修改边界和完整红绿回执见 rqa01-runtime-typed-attention-2026-09-06.md / .json；本报告前述旧 hash 不覆盖追加修改。仍未运行 fullcheck/API/QA/commit。
