# RQA25 图片元数据只读复核 — 2026-09-06

> 后续授权补充已完成，见末尾：P2 已复测关闭；新增真实 runtime.execute 晋升/保存回归，75 项定向通过。下文首次审查与 73 项结果作为历史记录保留。

## 结论与发现

当前所读版本未发现正常生成链上的 P1 元数据丢失：实际解码信息进入工具正文、artifact.meta.image、receipt.images；非视觉模型也收到尺寸文本。专家新 artifact 落库已展开 candidate.meta，没有再次覆盖 image。此结论不等于真实专家已理解/遵守尺寸，也不等于视觉 QA。

- **P2，formatter 畸形字段处理不足**：`src/lib/image-artifact-metadata.ts:16–17` 的 `Object.hasOwn(..., image.mimeType)` 与 hash 正则隐式转换值。实测 `sha256: ['a'.repeat(64)]`、`mimeType: ['image/png']` 都被接受并生成“实际图片”说明；任一字段设为可 JSON 保存的 `{ "toString": null }` 则抛 `Cannot convert object to primitive value`。`buildMediaObservation` 的 facts.map 在图片加载 try/catch 外，故此异常并非正常忽略坏元数据。最小建议：两字段先验 primitive string，再做 MIME/hash 校验，并补数组、普通对象、toString:null 控制。不要求增加授权机制。正常 saveValidatedImage 只产生正确字符串，尚无真实生成任务因该缺口失败的证据。
- **回归覆盖缺口**：新 10 项测了 normalizeArtifact，但没有直接锁定 expert-task-runtime 的 meta 合并。建议主线加“完整 image 元数据经真实 runtime.execute 晋升后、session JSON 重开仍相等”的固定回归，避免未来把 meta 改回仅 taskId/deliverableId/runId。现有同 ID artifact 分支直接复用，不自动补旧记录的缺失元数据；这不是本轮新 artifact 的已证实断链，也不能将旧无回执记录追认为已解码。

## 实际源码链与信任边界

1. `image-validation.ts:88–110`：保留原 width/height；新增 displayWidth/displayHeight 使用 GIF logical canvas 的预算尺寸，EXIF 5–8 交换轴。原文件字节不被旋转/重编码；报告的是显示画布，不是请求尺寸。既有大小/像素/帧数与实际解码校验仍在。
2. `agent-image-tools.ts:202–242,358–369`：先校验并保存原字节，再从 decoded result 构造尺寸、帧数、MIME、byteLength 和完整 SHA256。工具正文先列本地事实，再列标记为未核验的 provider 说明；provider 宣称和请求 size 不覆盖这些字段。receipt.images 同源。当前文件 **387 行**，未超所提示的 400 行边界。
3. `agent-tools-surface.ts:377–385` 原样传 artifactRefs/receipt；`agent-run-executor/phases-model-tool.ts:896 起、1040 起` 汇总 rich refs，保存工具消息，调用实际 media port。`agent-run-kernel-adapter.ts:275` 连接 buildMediaObservation；`agent-media-resources.ts:34–42` 在 supportsVision 判断之前加入元数据。model tool text 中亦有尺寸，不依赖视觉加载成功。
4. `phases-ground-persist.ts:251–274` 后合并 rich artifactRefs，传回 executor；生产 adapter 保存完整工具消息。`agent-sessions.ts:189–195` 保留 tool artifactRefs/receipt，`:219` 经 normalizeRun 保留 run.artifacts.meta。`agent-run.ts:134` 未丢 meta。
5. `agent-generate-execute.ts:250–256` 将工具 artifactRefs 返回专家层，即使它们未进入 generic session.run.artifacts。`expert-execution-profile.ts:130–165` 保留对象字段并优先收集 artifactRefs。`expert-task-runtime.ts:747–765` 为新 artifact 构建 `meta: { ...(candidate.meta || {}), taskId, deliverableId, runId }`，然后保存 session；deliverable 本身保存 session#artifact 引用，不必复制整份 image。已有同 ID 分支不合并，见上限界。

protocol/source 标签只是数据 schema，不是不可伪造的安全令牌；formatter 不重新解码文件或复核 hash。正常生成路径的可信来源是 host 对所保存字节执行的校验，不是标签本身。后续文件被外部改写时，旧回执不证明当前预览字节仍相同。未发现本次修改以该标签替代工具授权或视觉验收。

## 独立执行证据

使用仓库 TS preload，无真实模型/网络/用户 profile：

```text
node -r ./scripts/register-ts.js --test tests/image-artifact-metadata.test.js tests/agent-image-tools.test.js tests/agent-media-resources.test.js tests/image-validation.test.js
36 tests / 36 pass / 0 fail / 0 skip / exit 0

node -r ./scripts/register-ts.js --test tests/expert-execution-profile.test.js tests/expert-task-runtime.test.js
37 tests / 37 pass / 0 fail / 0 skip / exit 0
```

另作**内存探针，未改测试文件**：复用 RQA16 有限离线 fixture 的 runWire，经真实 AgentRunExecutor → buildProductionRunPorts → 捕获 requestAgentCompletion.body。仅工具结果替换为合成的 31×47 PNG 元数据，传输/工具效果/session 存储均为 fixture。观察到 DONE、2 次 mock 请求、1 次 mock 工具调用；最终 body 包含 `31 × 47 px` 和“当前模型不支持视觉输入，未进行图像内容检查”。result.artifactRefs、保存后 JSON roundtrip 的工具 artifactRefs/receipt.images 均保留 image 完整对象。

再用真实 collectResultArtifacts、addArtifact 与 normalizeSession 执行当前专家 meta 合并形状，JSON roundtrip 后 image 对象仍完整。这后一段不是一次完整 runtime.execute 元数据集成测试；37 项原有专家测试也未断言该新字段，故保留上述回归建议。

探针第一次用 vm 独立 realm 运行 fixture，因 structuredClone 产生跨 realm prototype 导致 fixture 的 deepStrictEqual(policy, originalPolicy) 失败；改为同 realm Module._compile 内存运行后通过，未删除该断言。该次失败不是生产 policy 变更或元数据回归。formatter 的数组/对象复现与该 fixture 问题无关。

## 版本锚点与限制

本次 GitNexus debugging 技能已读取；query 未返回有效链路（FTS 降级），normalizeArtifact context 确认 addArtifact 等调用后采用源码 fallback。索引结果不是无风险证明。目标新增文件在当前 Git 中为 untracked，`git diff` 不能提供其前后差异；本报告是当前源码/实际定向执行审查，不声称恢复了完整历史补丁。未修改任何源码或测试，未运行 fullcheck；正常测试临时 fixture 不属于用户 profile。

复核前后以下 hash 相同：

| 文件 | SHA256 |
| --- | --- |
| src/lib/agent-image-tools.ts | D235EE44B6F33C6AE8F4F8C03474947E4C37607CBF57C52D76D3FC53F5B1A59E |
| src/lib/image-validation.ts | 94E9CD2741AC62B877214EA5132D8F080D6A9424148F2AE6C17C334CE1F916EA |
| src/lib/agent-media-resources.ts | AE2D0DD36620E2F16662A72D9B7DCCEC710147B920B867749F2D714D202C4640 |
| src/lib/image-artifact-metadata.ts | 45CCAD90889A6A93F13A857D1F5063E06FD0FE0AA4ED8CF3447C74FF56846E94 |
| src/lib/expert-task-runtime.ts | 505049371302D1E99105BDA6481DFC44B828E7668C8AA104B70027256C35E3D1 |
| tests/image-artifact-metadata.test.js | 1645F63179110BADB38C4DEFFBCAB50ADF647A453BEFC019415B429351F17B28 |

未检查实际 QA 已加载模块、真实同-run模型上下文、UI 预览效果或付费生成。未将当前磁盘代码推定为 QA 已加载版本，也不以 73 项定向通过宣称端到端专业/视觉验收通过。

## 授权补充：真实晋升回归与 P2 关闭

仅新增 `tests/expert-task-runtime.test.js:241` 的一项 `RQA25 preserves decoded image metadata and receipt through execute promotion and session reopen`；未改已有测试/helper，也未改任何生产源码或主线拥有的 image-artifact-metadata.test.js。GitNexus query 仍为 FTS 降级，normalizeArtifact context 为 lower-bound；本次没有需要修改的既有生产/helper 符号。

### 新回归实际覆盖

真实 `runtime.execute` 使用既有 imageCapabilityHub/imageConnectorsApi harness；runAgentGenerate seam 内运行真实 AgentRunExecutor + buildProductionRunPorts。真实 buildImageTools 处理本地 sharp 生成的 **31×47 PNG**（mock provider 字段及请求 size 故意写 1080×1440），真实校验、保存原字节并产生回执。仅模型/MCP transport、连接器状态和 session 存储边界为 fixture，没有请求外网或用户 profile。

- 模型只有两次 mock completion，图片 transport 恰一次；第二次实际 adapter request.body 含 31×47。
- 同一 save seam 供生产 adapter 和专家 runtime 使用，每次保存都 JSON.stringify，再 JSON.parse + normalizeSession，避免共享对象别名造成假阳性。
- runtime 晋升前 session.run 没有该 artifact；晋升后确实调用 save。重开 artifact.meta **完整相等**于 image 解码信息加实际 taskId/runId/generated-image deliverableId；保存文件字节与原 fixture 完全相等。
- 重开 tool 消息的 receipt 与实际 buildImageTools 整份 receipt **深相等**；receipt.images 与独立计算的尺寸/MIME/字节数/SHA256 期望相等；tool.artifactRefs.meta.image 同样相等。
- 临时 task store 从磁盘重新创建后，唯一交付物仍指向该 session#artifact。

首次新测试运行 **0 pass / 1 fail**，原因是测试 adapter.settings 漏配离线 apiEndpoint，触发“未填写 API Endpoint”；补齐 fixture 后 **1 pass / 0 fail**。这是 harness 配置失败，不冒充生产缺陷红测。

另作仅内存的精确生产变异：Module._compile 将专家晋升的 `meta: { ...(candidate.meta || {}), taskId... }` 替换为旧覆盖形状，仅选中新回归执行。实际 **0 pass / 1 fail / exit 1**，断言明确显示落库 meta 缺少完整 image 对象（测试第 348 行）；生产文件未写入该变异。随后原磁盘源码完整定向运行转绿。这证明新断言能捕获所针对的 metadata overwrite，不只验证 fixture 自身。

### P2 复测与最终定向结果

主线当前 formatter 在任何 MIME/hash coercion 前验证 primitive string，并限制 primitive 非空 id；media observation 的错误标签也不再直接转换畸形 id。独立读源码并运行主线新增控制：MIME/hash/id × array/plain object/toString:null × nonvision/vision，**18 组模型模式组合在 1 个 test 内**。全部通过，原报告 P2 在以下版本关闭，不是授权或视觉安全令牌机制的改变。

```text
node -r ./scripts/register-ts.js --test tests/image-artifact-metadata.test.js tests/agent-image-tools.test.js tests/agent-media-resources.test.js tests/image-validation.test.js tests/expert-execution-profile.test.js tests/expert-task-runtime.test.js
75 tests / 75 pass / 0 fail / 0 skip / exit 0
```

这是原 73 项 + 主线 1 项组合控制 + 新增 1 项真实晋升回归；不将 18 个内部循环重复算作独立 tests。未运行 fullcheck。主线报告的 check85858、UI 与原字节 replay 仍属主线证据，本回归不替代它们。

冻结锚点：

| 文件 | SHA256 |
| --- | --- |
| tests/expert-task-runtime.test.js | 2D9C696B3825D7169579B44A07B76CA8E3D37F5AD49ED9CE62AFD47004A6550D |
| src/lib/expert-task-runtime.ts（未改，仍同首次复核） | 505049371302D1E99105BDA6481DFC44B828E7668C8AA104B70027256C35E3D1 |
| src/lib/image-artifact-metadata.ts（主线修复） | D1192D5BBB55E1CE02C368B39CA9A6D5F8F51203298F675A76AF0E5744285E0D |
| src/lib/agent-media-resources.ts（主线修复） | 0FB96C4F7287B147A6F6E45EB2AB983B59D36CB8DA6381CE058082F6D7E1BE7A |
| tests/image-artifact-metadata.test.js（主线拥有，未改） | 1F216325BFA4716955B4A9296288E9C2FE14189B05E49E2A87AC49978FC132D9 |

### 剩余边界

本项关闭新图片正常晋升的元数据覆盖回归缺口。session 采用真实 JSON/normalize，但存储回调为内存 seam；task store 与图片使用隔离临时磁盘。runAgentGenerate 的 prepare、真实安装/L1、完整 UI/IPC 磁盘重启、真实模型视觉理解不在此用例内；不是一次真实付费任务或专业资格认证。旧同 ID artifact 不补 metadata 的分支未扩大处理。未审查新增 Chromium frontend test 的 CI 浏览器安装依赖。
