# RQA26 图片生成前拒绝的执行状态分类

2026-09-06。当前阶段：诊断/红测已完成，源码修复待共享边界文件协调。未访问 QA、profile、模型或真实服务。

主线真实证据：旧 R01 `task-mtpkut6w-6cluf` 的附件图片已在模型输入中，参考图引用解析在 generate 请求前失败；0 次 generate provider 请求，却被标记 operation_status_unknown。附件注册由主线负责，本次不修改 agent-media-resources.ts / agent-generate-tool-surface.ts。

## 调用链和必要边界

- `agent-image-tools.ts` / buildImageTools：generate_image 的参考资源解析 catch 返回 media_reference_unavailable，调用 callPangoTool 在它之后；目前缺少可信的未发送证据。
- `tool-contract-registry.ts` / execute：handler 入场即设置 executionStarted=true，并通过 wrapEnvelope 覆盖 handler 自报值。
- `agent-tools-surface.ts` / createToolExecutor：只信任被私有 WeakSet 标记的 registry wrapper 的 false；普通 handler 返回 false 会被覆盖。
- `agent-run-executor/phases-model-tool.ts`：unsafe + failed + validation 未拒绝 + executionStarted 非 false 即进入 operation_status_unknown。

后两层保护是 RQA01 的反伪造约束，不能简单删除或增加 error-code 白名单。media_reference_unavailable 字符串本身不能证明请求未发出。

## 红测

新增 `D:/aispace/knowme/tests/rqa26-image-dispatch-boundary.test.js`，命令：

```text
node -r ./scripts/register-ts.js --test tests/rqa26-image-dispatch-boundary.test.js
```

实际 exit1：9 tests / 4 pass / 5 fail。全部是业务断言失败，无虚构 API/TypeError。

1. 直接早期拒绝 providerCalls=0，但 executionStarted 为 undefined：红。
2. 裸 surface、registry→surface 两条路径 executionStarted 都为 true：2 红。
3. 两条真实 AgentRunExecutor 路径都得到 operation_status_unknown：2 红。
4. 请求进入后丢响应：两条路径均只调用一次、不调用 sibling、不 reflection/retry、unknown 保留：2 绿。
5. 普通 handler 伪造 media_reference_unavailable + executionStarted=false + dispatchStatus=not_dispatched：两条路径仍 unknown，不重试：2 绿。

测试 fake fetch 完全替代网络；使用实际图片 handler、registry、surface、executor。测试 SHA-256：`4931c5725c7a50ae5ce788479c1a3055b55f5d13ae42bf710ab3d94d3d4495b1`。

## 提议修复及风险协调

拟新增 `src/lib/tool-dispatch-outcome.ts`：通过进程内对象身份记录受信任的早期拒绝，不信任 JSON 字段或供方错误码；图片工具仅在尚未进入 generate 请求的已知分支产生标记。请求开始后的网络/timeout、输出校验或保存失败不得获得此标记。

还需要 `src/lib/tool-contract-registry.ts` 和 `src/lib/agent-tools-surface.ts` 极小消费点改动，才能在保留假 false 保护的同时传播真实未执行事实；无需更改 MODEL 的 unknown 规则。主线须确认这两个额外文件的归属后才实施。不触碰 RQA25 图片元数据/生成后回执。

已完整读 GitNexus debugging。query FTS 降级；buildImageTools context 找到 buildRunToolSurface 及图片测试。对 buildImageTools、execute（registry 文件限定）、createToolExecutor（surface 文件限定）分别 impact，均 UNKNOWN/lower-bound/零已解析依赖；不是安全证明。实际共享执行链已手读，registry/surface 按 HIGH 人工风险提前告知，当前未修改任一源码符号。

审查时源码 SHA-256：

```text
d235ee44b6f33c6ae8f4f8c03474947e4c37607cbf57c52d76d3fc53f5b1a59e  src/lib/agent-image-tools.ts
7ceee13b617f72cf4fae2407333e5197833a26760266241cadea5b1f4724efd8  src/lib/tool-contract-registry.ts
a53463df74e9aadffecaeb561f95dbba828fcb996292dc25d9a6e16f7f554600  src/lib/agent-tools-surface.ts
```

## 已授权实施与最终状态

主线已确认本审查者拥有新增可信模块及 registry/surface 两个消费点，并接受人工 HIGH 风险；以上“待协调”为历史阶段，保留红测证据。随后已重跑三个修改符号的 GitNexus impact（仍 UNKNOWN/lower-bound），完成以下最小改动：

- 新增 `src/lib/tool-dispatch-outcome.ts`：`createPreDispatchFailure(code,text)` 创建冻结对象，在模块私有 WeakSet 登记；`isTrustedPreDispatchFailure(result)` 只判断该进程内对象身份。公开 `executionStarted:false` / `dispatchStatus:not_dispatched` 字段是说明，不是可信凭证。
- `src/lib/agent-image-tools.ts:336,342`：仅空 prompt、参考资源解析拒绝两个 generate 请求前分支使用标记。保持错误 code/text；不触碰 callPangoTool、输出字节验证、保存、尺寸元数据或回执构造。
- `src/lib/tool-contract-registry.ts:311`：原 handler-entry 事实默认保守；只有原始可信早期拒绝对象可以令输出 envelope 的现有 executionStarted 字段为 false。
- `src/lib/agent-tools-surface.ts:370`：裸 surface 同样识别原始本地对象；registry wrapper 的既有私有身份保护保持。普通 handler 的 false、code 或 dispatchStatus 均不成为证据。

未修改 MODEL/重试分类表、审批/权限逻辑、附件注册或上下文链路。不把 media_reference_unavailable 加成绕过 unknown 的字符串白名单。传播使用现有 executionStarted 字段；没有新增可由模型填写的授权接口。

### 测试结果

原 9 条红测 **9/9 green**。新增 4 条（含循环矩阵）测试，最终新文件 **13/13 green**：

- 冻结对象不可改写；JSON roundtrip、spread、原型继承均失去可信身份，在裸 surface/registry 下重新按已进入 handler 处理。
- 空 prompt 在参考图解析和 provider 调用之前拒绝，两种工具面均明确未执行。
- 实际 fake MCP JSON 中携带 `isError:true/executionStarted:false/dispatchStatus:not_dispatched`，两种工具面都保持 executionStarted=true；没有信任外部字段。
- 原有真实 executor 双路径断言继续确认：零请求拒绝非 operation_status_unknown、无工具自动重试、不验证为成功成果；post-dispatch 丢响应与伪造 false 保持 unknown、单次调用、无 sibling/reflection/retry。

定向命令及实际结果：

```text
node -r ./scripts/register-ts.js --test tests/rqa26-image-dispatch-boundary.test.js tests/agent-tool-retry-contract.test.js tests/tool-contract-registry.test.js tests/tool-execution-governance.test.js tests/tool-surface-governance.test.js tests/agent-image-tools.test.js tests/agent-media-resources.test.js
# exit0: 115 pass / 0 fail / 0 skip

node -r ./scripts/register-ts.js --test tests/image-artifact-metadata.test.js tests/agent-recovery.test.js tests/harden-tool-surface.test.js
# exit0: 73 pass / 0 fail / 0 skip

git diff --check -- src/lib/agent-image-tools.ts src/lib/tool-contract-registry.ts src/lib/agent-tools-surface.ts
# no whitespace errors
```

合计 **188 项定向通过**，未跑 fullcheck。图片工具/媒体/元数据测试使用隔离 fixture，不接触真实 profile 或外部模型。主线负责真实任务与全量验收。

### 信任与未决限制

此 WeakSet 是宿主内部可信代码约定，不是任意本地 Node 插件的沙箱。能够执行任意宿主代码并调用创建函数者已位于该信任边界内；模型、远端 JSON 和持久化文本不能制造标记。不得未来把 provider 返回值或读取到的 JSON 重新送进该创建函数，也不得在副作用启动后签发。

只签发上述两个生成前已知分支；其他工具、本地配置失败、生成开始后的超时/网络/输出校验/保存失败没有借本次改动升级为“可安全重试”。外层超时在 handler 结果返回前先终止时仍保守 unknown，本次未声称补齐所有预执行取消时序。已消除本次参考图明确拒绝的误分类，不意味着附件引用注册或实际图片编辑专业质量已通过。

`gitnexus_detect_changes(all)` 实际汇总整个共享脏工作树：323 changed files、705 changed symbols、172 affected、CRITICAL；这包含他人/历史增量，不是本次 diff。未提交、未回退任何共享文件。该结果不能作为本次范围干净证明；本次使用上面的逐点 patch 清单和 SHA 交接。

最终 SHA-256（路径相对 D:/aispace/knowme）：

```text
6d0e2f86f7a3d33a9225ad6407321f12dfb5011e31538fd45aad4e68790b98cc  src/lib/tool-dispatch-outcome.ts
14ae3dabd73d36467542a6a0c7d2a71b46977f6228a5cce9c65084bb454ede6f  src/lib/agent-image-tools.ts
79461231babbaaa01b1cac850b12c18356c01048d448ee145043ccc7c120eaab  src/lib/tool-contract-registry.ts
60f82e974e0e92730894846095d06b41e3af81f034dc96d8dec1db126f9a0d74  src/lib/agent-tools-surface.ts
9097bdfcc3bf6dfb160efa3936ad803d55c7a1ff679a7f297fa9f5d055d028d9  tests/rqa26-image-dispatch-boundary.test.js
```

### 附件引用参数说明同步

主线接入 `attachment:image_<完整SHA256>` 协议后，按其要求仅更新 `agent-image-tools.ts:47` 的 reference_images description：原样使用本轮图片旁提供的附件引用，兼容 artifact 引用及已登记成果路径/HTTPS/data URL；不要编造 ID 或以附件名称/路径替代附件引用。参数类型、授权、resolver、生成后行为均未修改。

GitNexus impact(IMAGE_TOOL_DEFS) 未找到目标，风险 UNKNOWN；通过源码确认仅 schema 描述文本变动。执行 `node -r ./scripts/register-ts.js --test tests/rqa26-image-dispatch-boundary.test.js tests/agent-media-resources.test.js tests/agent-image-tools.test.js`，实际 **27/27 pass、exit0**。这是本地定向回归，不代替主线的真实附件链路/图片编辑复验。

此说明增量后的 `src/lib/agent-image-tools.ts` 最终 SHA-256 为 `3c855dcf9fd502b619e887c540fd1188b95489dff15fe6a0445d31bd3d19def0`，替代上节该文件 hash；其余本次文件不变。主线 fullcheck16136 可能先于该描述增量启动，需按 hash 核对。

## 整合后只读收尾核查

2026-09-06。本轮仅读取源码、附件相邻调用点、测试文本和文档，并追加本节；未改代码/测试/产品文档，未访问 QA/profile、未运行测试或付费服务。

### 范围冻结

四个源码文件及新测试与上次交接的最终 hash **全部一致**：

```text
6d0e2f86f7a3d33a9225ad6407321f12dfb5011e31538fd45aad4e68790b98cc  src/lib/tool-dispatch-outcome.ts
3c855dcf9fd502b619e887c540fd1188b95489dff15fe6a0445d31bd3d19def0  src/lib/agent-image-tools.ts
79461231babbaaa01b1cac850b12c18356c01048d448ee145043ccc7c120eaab  src/lib/tool-contract-registry.ts
60f82e974e0e92730894846095d06b41e3af81f034dc96d8dec1db126f9a0d74  src/lib/agent-tools-surface.ts
9097bdfcc3bf6dfb160efa3936ad803d55c7a1ff679a7f297fa9f5d055d028d9  tests/rqa26-image-dispatch-boundary.test.js
```

本次 dispatch 范围仍仅为：新可信对象模块、imageTools 两个本地前置失败分支及引用描述、registry/surface 两个可信身份消费点。未新增 provider 错误码放行、MODEL 自动重试或生成后回执变更。主线附件注册增量独立于这份范围声明。

共享 git diff 包含此前 registry/surface 等大量既有改动；整树 detect 的 323 files / 705 symbols / 172 affected / CRITICAL 不是本轮完整安全审计或责任归属证明。本节以已交接 hash 和精确改动点核对，不把整树 diff 冒认成本次增量。

### 产品文档核查：一处需收窄的表述

已全文读 `docs/agent-image-artifacts.md`，本次所读 SHA-256：`9c2ded3891ad820b01617c6708a128b3f9b6a7f0581b4c4a5afb3ab0593953b0`。

**[文档 P2] 第 41 行末“完整解码仍由图片工具链负责”在附件段中可能过度暗示输入图已验证。** 当前 `image-attachment-resources.ts:8-20` 对附件只做 kind/data URL、大小、规范 base64 和字节 hash；`agent-media-resources.ts:15-18` 找到引用后直接返回附件 dataUrl。`agent-image-tools.ts:340-345` 将解析值传往 provider，完整解码发生在随后生成输出的 persist/save 链，未保证参考附件发送前已经过本地完整像素解码。

建议主线将该句明确为：“附件引用仅确认本轮可引用字节；当前不保证参考附件在发送前完成本地像素解码。生成输出仍需完整解码和保存后才能产生图片成果/回执。”本次按授权不改产品文档；这不是新发现付费调用失败或要求扩大本轮实现范围。

其他关键描述与当前实现一致：

- 第 39–43 行的同轮引用、文件名非授权、前三张限制及显式空列表不回退 payload，与 `image-attachment-resources.ts:23-26`、`agent-generate-tool-surface.ts:238` 及实际 resolver 对应。hash 是内容标识而非 task 专属 token；相同字节若明确在另一任务本轮也提供，可使用同一 hash，不构成跨任务扩权。
- 第 47–49 行的本地可信失败对象和拒绝信任服务/模型 false，与实现一致。“等前置失败”应理解为当前已接入的两个分支，不是所有本地错误/所有取消时序都能证明未发送。
- 文档明确原字节回执不证明后续改写、画面专业质量或额外付费权限；真实工具成功/任务 review 不等于专业资格，表述未混淆。
- 第 53–57 行已经区分工程 fixture 与真实专业评测；README:47-54 已明确 Chromium 安装前提和不得静默 skip。不能将所列不同测试文件拼成一个无替身、完整真实 UI 端到端测试；本次未作该承诺。

### 主线验收结果（来源标注）

以下来自主线本轮明确通告，本审查者没有重读 QA 或执行该 fullcheck：

- 原 R01 `task-mtpkut6w-6cluf` 的前置引用失败、0 次生成记录保留 **N/A**；不因后续修复追填旧运行专业成绩。
- 修复运行时下 old/candidate 四格参考编辑均进入 review，无超额付费；不把 review 单独当作专业能力通过。
- 完整 check **session51355 exit0**：backend **3335 pass / 51 skip / 0 fail（3386 total）**，renderer **606 tests / 86 files**，lint/typecheck 通过。

收尾结论：本次 dispatch 源码范围已冻结，历史红测与修复证据保留；未见此次整合扩大调用后 unknown 的重试权限。上述附件解码文档措辞需由主线决定收窄，除此不新增代码任务或范围扩张。

### 文档 P2 关闭复核

2026-09-06，只读复核 `docs/agent-image-artifacts.md:41` 当前正文，已明确：“附件引用仅确认本轮可引用字节，当前不保证参考附件在发送前已完成本地像素解码；生成输出仍需完整解码并保存后才能产生图片成果与事实回执。”该句准确区分参考输入的引用/字节检查与生成输出的解码保存要求，不再暗示输入发送前完成像素验证；上述文档 P2 **关闭**，保留历史发现供追溯。本次仅追加本记录，未修改源码、测试或产品文档，未访问 QA/profile 或调用服务；源码未变按主线确认，不重跑工程测试。
