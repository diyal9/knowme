# RQA24：image-producer 包与图片链路有界只读审查

2026-09-06。仅读取相关仓库源文件，执行无 IO 副作用的交付契约投影探针；未修改源码、测试、包、profile，未调用模型、图片服务、安装或 UI，未跑 fullcheck。本文不是实跑验收。主线控制 QA PID 9072；本轮没有 RQA24 model run。

## 1. 包版本、依赖与实际来源必须分开

| 对象 | 当前仓库读取结果 |
|---|---|
| `src/catalog/experts/image-producer/EXPERT.md` | 3.3.0 |
| 同目录 `manifest.json`（legacy） | 3.3.0 |
| 同目录 `capability.manifest.json` | **3.2.0** |
| `src/catalog/catalog.json` image-producer entry | **3.1.0** |
| 三个内置 th-art Skill 正文、各 sidecar、catalog entry | 均 1.0.0 |

主线另外报告：**实际 QA installed entry=3.1，EXPERT/legacy/canonical=3.2**；三个 Skill entry 为 source=local-repo、linked，来源 `D:/aiworkspace/th-art/.cursor/skills`，QA 根 `capabilities/skills` 无副本是预期。本文未读取该外部仓库或 QA 安装内容，以上实际安装信息明确属于主线提供，不能用当前 src 3.3.0 的编辑/视觉复核 SOP 证明 QA 已加载同文。

专家 canonical 必需 Skill：`th-art-intake`、`th-art-prompt-enrich`、`th-art-pango-generate`。两个 connector `pango-image-mcp`、`photoshop-mcp` 均为可选依赖；但默认图片交付必须真实调用 generate_image，故“连接器可选”不等于“生图可省略”。这是允许 provider adapter/配置发现的结构，不应仅因 optional 判包错误。

权限：connectors 仅上述两个 ID；tools 仅 list_paint_models/generate_image；network/write=true、externalWrite=false。Photoshop 虽被绑定且 SOP 允许可选处理，其工具名并未被专家 allowlist 放行；**不能承诺当前包必然可用 Photoshop 后处理，也不应为了主生成流程扩大权限**。三个仓库 Skill 分别负责澄清、编译和生成；生成 Skill 最后一条仅说按 Brief 与反馈再生成，没有明确强制 reference_images。当前 EXPERT 3.3.0 第 7/8 步明确参考图编辑、保留项、真实视觉检查；两者不是明确相反指令，但执行 Skill 的约束较弱，且不能外推到 linked Skill。

版本清理的精确范围：若以后调整专家版本，应对齐该目录三件套及 catalog 对应 entry；若调整内置 Skill，再对齐该 Skill 的 SKILL.md、capability.manifest.json 和 catalog entry。**本阶段不覆盖 linked Skills，不把安装 entry 3.1 当正文必为 3.1，也不自动升级依赖。** 通用 curated 安装取 catalog 外层版本记录 entry，sidecar 规范化可保留 raw.version，足以解释存在分层版本差异的可能机制，但未重建本次安装历史，不能断定唯一成因。

### 同 ID：standard、linked、pack 的选择语义

`src/lib/skill-runtime.ts:382–546`：

1. 扫描安装根内有效标准 Skill，记录 seenIds。
2. 再读取 install store 的 enabled linked entry；realpath(originRoot + originPath) 必须仍在 originRoot 内、目录存在并有可解析 SKILL.md。其运行记录 source 为 `linked-repo`，从链接目录加载正文与 sidecar，并按实际正文生成 contentHash。
3. 已被 standard/linked 占用的 ID 不再使用 pack source。catalog 中“存在内置同 ID 条目”本身不会自动让它成为模型正文。

因此 QA 无标准副本不等于缺失依赖；反而若以后安装同 ID 内置副本，可能遮蔽 linked 源或改变安装记录，应作为显式迁移处理。依赖及 requiredSkills 按 ID 解析，没有在本专家声明中钉死 origin/version。`capability-hub/runtime.ts:expertRuntime` 的可用性与快照 hashes 同样经 Skill runtime 查找；合法 linked 可满足绑定。正文随链接源变动而变，不等于会话快照已复制并冻结全文。主线后续需保存实际解析 source/dir/version/hash 与同 run L1，不能以仓库三个短 Skill 的长度替代 linked 方法的上下文预算证据。

## 2. 交付契约：正常路径严格，但自定义多交付有缺口

canonical 的 execution.strategy 为 `confirm-then-generate`；只有一个声明交付 `generated-image`，无 execution.routes 默认路由。该交付要求：三个 requiredSkills、generate_image requiredTool、对应 tool_result evidence、image artifact、minArtifacts=1、tool_success + artifact_present。`executionRoute: pango-generate` 是交付说明字段，**不是**可供 `selectExecutionRoute` 匹配的 routes 数组。

使用真实 `expert-execution-profile.ts:resolveOutputSpec` 与当前 canonical 做纯函数探针，实际输出：

| 请求 | 实际投影 |
|---|---|
| 默认 | generated-image，保留所有上述要求 |
| 一个自定义 primary 图片交付 | 继承所有要求，但 id/title 被规范成 generated-image/生成图片 |
| 两个自定义图片交付 a/b，均不匹配声明 ID | 选中 a；requiredSkills/requiredTools/evidence/artifacts/conditions 全空，minArtifacts=0 |

这是可确证的包/通用投影边界，尚未执行真实 createStart。代码入口允许 requestedDeliverables 数组；默认 UI 正常单图片路径不因此被判失效。若 RQA24 只测正常单交付，保留该已知项；若未来支持任意多交付，应先明确 ID 保留/合并语义及默认契约，再通过通用包路由与测试解决，不靠专家 ID 分支。

`expert-task-runtime.ts:665–728` 会对本轮 artifact 与 executionEvidence 执行契约评估，缺工具成功/图片时转 needs_input，普通说明不会替代要求的图片。minArtifacts=1 只证明至少一张，**不会自动保证用户请求 n=4 已齐**；生成工具部分成功时会返回成功图片和 rejectedImages。数量、比例、改动是否实现仍需独立验收。

## 3. 当前通用图片链路

### 生成、下载、落盘与回执

`agent-generate-tool-surface.ts:219–245` 根据 requiredTools/connector 范围投影 provider adapter，不按 image-producer ID 特判；为 image tools 注入 runId、userData、signal 和当前 session artifact resolver。`agent-image-tools.ts:resolvePangoMcpConfig` 依次检查显式配置、有效 Capability Hub connector、环境配置、默认本机 Cursor MCP 配置。本文没有读取凭据或这些用户配置；QA 应记录最终 source，不能仅凭“有包”确认 provider 来源。

`buildImageTools` → `callPangoTool` 发送 tools/call JSON-RPC；处理 HTTP/RPC/isError。生成结果先收最多四个 inline image；只有“没有 image block”才尝试从 text 抽取图片后缀 URL（最多四条）。坏 inline 图片不转而信任 URL，是有意 fail closed。仅 structuredContent/resource_link、没有扩展名的签名 CDN URL、服务返回 SSE 而非当前 JSON 解析预期，都不是这段 adapter 已证实支持的返回形态；需要真实服务回执核对，不能先称 API 已兼容所有图片响应。

`image-download.ts`：仅 HTTPS、无 URL 凭据，逐跳安全地址/DNS 检查并固定已检查地址，最多四跳；每下载上限 15 秒，URL 批处理 deadline 30 秒，字节预算封顶。URL 字符串本身不算 artifact。

`image-validation.ts`：24 MiB、维度/像素/帧数预算、声明 MIME/容器核对、sharp 全帧解码；拒 SVG/APNG。`saveValidatedImage` 校验后写到指定 userData 的 `generated-images/<safeRunId>/...`，临时文件后 rename；仅保存成功项产生 image artifact 和 save receipt。目录写失败、损坏、HTML 冒充 PNG 均不能获此回执。原生 metadata 阶段没有完整 wall-clock timeout，源码已有说明；不能把 sharp 的 5 秒设置说成端到端硬截止。

生图为 sideEffects=true、non-idempotent、requiresApproval=false；已进入调用但失败/超时可能已经收费生成。当前 `phases-model-tool.ts:1028` 通用非重试安全分支会停到 operation_status_unknown，防自动重放，不能照底层“稍后重试”文案直接再付费调用。确认 Brief 主要由专家 SOP 与用户确认后 createStart 工作流承担，工具 schema 本身没有独立“用户已确认 Brief”凭证。故 main 必须通过真实用户确认入口启动/修订；不能把 SOP 声明当第二个宿主审批门。

### 预览、视觉证据与重新打开

`expert-task-runtime.ts:732–764` 保存 artifact 的 targetPath 与 session 引用；任务交付物引用这些真实图片。`ExpertImagePreview.tsx`/`ArtifactPreview.tsx` 显示图片与大图；本地路径经 `useArtifactPreviewSource` → preload artifactPreviewResolve → `src/ipc/app-shell.ts:36` → `artifact-preview-source.ts` 返回有大小限制的 data URL。正常新生成路径不依赖 CDN URL 长期存活。远程/data/blob 预览是另一路直接显示；正文 URL fallback 不等于工具已生成的证据，不应以“显示了图”替代生成/保存核验。

`agent-run-kernel-adapter.ts:276` 按当前模型 profile 的 supportsVision 调用 buildMediaObservation；最多前三张、每本地图 6 MiB 视觉输入限制，加载失败或无视觉能力时明确“未看过”。观察作为 user 多模态数据加入后，artifact_ready finalizer 无工具整理交付说明。故能保存/预览的 6–24 MiB 图片不一定能送入视觉上下文，第 4 张也不会在此观察函数中逐张检查；不能宣称四张全经模型视觉验收。UI 真正重新打开本地文件仍需主线实测，源码路径存在不是该 QA 进程实际可预览的证明。

### 参考图编辑与版本

`expert-task-runtime.ts:513–540` 从上一版交付的 artifactRefs 构造 `artifact:<id>`、正文/路径和反馈进入 revision；`reviewDeliverable` 的 changes_requested 会开始新轮。模型仍须传 reference_images；参数 schema 没有强制存在此数组，所以“用户说修改”并不会在本 adapter 自动注入旧图，纯文生图仍是技术上可调用的形态。必须看实际工具 arguments 判断是否真正走图生图，不能凭新版本号或 Prompt 编辑措辞判定。

`agent-media-resources.ts:createMediaResourceResolver` 仅从当前 session 的已登记 image artifact 解析本地 ID/路径，找不到则在 provider 调用前失败；artifact:<id> / session#id 可用，绝对路径本身不是任意文件读取授权。HTTPS/data/raw base64 直接透传；这一路不复用输出 CDN 下载验证，也没有此处的严格图像解码。登记本地图复用 preview reader 的文件类型/大小检查，不能宣传为同输出一样的全解码验证。`artifact-preview-source` 自身不是 session ACL，保护本地编辑来源的是前置 resolver。

另一个确定性边界：生成 artifact ID 为 `image_<图片字节摘要>`，不含 runId；`collectResultArtifacts` 用上一轮已有 ID 去重。纯函数探针中，同 ID、不同新 run 保存路径的图片被过滤为 `[]`。因此 provider 缓存/重复返回完全相同字节时，真实成功回执可能仍不能形成新可验收 artifact；应保留旧图并报告无变化/证据状态，不能诱导不知情重付费。本轮仅定位，不更改去重或重试策略。

## 4. 主线最小实跑证据与结论上限

优先顺序：

1. 锁实际安装三件套版本、entry 与三 linked Skill 的 origin/解析路径/hash；三 Skill 的同 run L1 chars/hash/truncated。不要安装内置副本替换链接以“修缺文件”。
2. 用户确认 Brief 后，记录真实工具名/参数、provider 来源、返回形态、实际数量；保存后的文件 hash、artifact ID/path、同 task/session/run 工具与保存回执。失败不得以参数表冒充图片。
3. 实际缩略图/大图、重开工作台、文件仍可读取；区分 UI 看见与模型 vision observation 进入请求。
4. 用户明确一项修改并保留其他内容，沿同任务 review 修订；核对传出的 reference_images 对应旧 artifact 字节，实际新图是否改变目标、旧图与反馈是否保留。不能以工具成功证明编辑准确。
5. 对缺引用、坏图片/下载失败、部分数量不足或超时，优先看真实阻断与防重复付费状态；本轮不要求无界扩展或真实造故障。

已有相关测试文件包括 agent-image-tools、image-download、image-validation、image-native-packaging、agent-media-resources、artifact-preview-source，以及 renderer artifact-preview / expert-task-room。已读相关源码/测试示例，未重跑，不能引用历史 green 为当前 loaded QA 保证。特别是 media 测试用非图片 fixture bytes 验证传输，证明引用解析，不证明真实图像解码或服务图生图效果。

GitNexus：使用 exploring；query 无结果并报 FTS 降级，repo context 为 2026-09-06、scope-extraction-unverified，query 缓存时间不同。buildImageTools context 找到 buildRunToolSurface 及相关测试调用者，processes 为空；随后定向源码 fallback。未全树 dirty diff、未索引重建。索引 UNKNOWN/lower-bound 不是安全证明。

审查时 SHA256（不代表 QA loaded/linked 内容）：

```text
EXPERT.md 6afc8cdf3f12df78fa80822f980d5f7dc87604fe692f7f9ce77fbf8da7e69dae
legacy manifest.json 87fe880509f6e96188b7e1c595641e0c2c89948f0b0dd0013ebedee7fe4d7dc8
canonical 886c352d2f0adb1ae88b147e11480b02e2313da2b654397ab21780495677134d
th-art-intake/SKILL.md 1a1570543f943c01a7ecd0dec817acde1b8cc81eceb120ca4cbd4ed0907e944a
th-art-prompt-enrich/SKILL.md e5d42b0553d2c1f4021712def190a2cfb476f8f9711a63fa256ad21d60152630
th-art-pango-generate/SKILL.md 33f62749a46e996cc533e21c5f55f96dc3b3c4399464244cf5f2616ec1972913
agent-image-tools.ts f68d73aeb96474e1cc8ebd81f4bd76af96b92ce3ebd4696e8c7ff8c6d269f242
agent-media-resources.ts 7b80d031a094a05eee58dde0bc72817e52af7a03e1ec4f31d0b9eb12aa1f9ade
image-download.ts 10557774c1f53becfde80a5121f1b290ca941114dd49778c8a69b5ee01be2221
image-validation.ts 75aacc0dbf7270f4a48d5cc04c773829b27db9e251590b97f1f10720b4f7e355
expert-execution-profile.ts 6abf263e45dd934afcd12ff1ac334b2c30ad4451365f25cec0e044d4fce70bd0
```

## 追加：首次 createStart 的 generate_image 预检阻断

主线实际报告 task=`task-mtphk5gg-jinbr`，started=false、needs_input、capability_unavailable，detail=`联合工具面未提供必需工具：generate_image`。**没有进入模型，也没有发生图片生成**；不能把该任务计为模型生图或专业方法失败。以下为当前源码追踪，不冒称已经读取本次完整 connector API 回执或确认 QA loaded hash。

### 两条链路及错误含义

- createStart：`expert-task-runtime.ts:924–926` → preflightForTask → preflightExpertTools。正常包的 requiredTools=[generate_image]，required connector 依赖为空，但 optional、bound、permitted 的连接器仍作为可能的必需工具提供者被探测。
- `expert-task-tool-preflight.ts:66–81`：无条件 builtin 定义包括 calculate 等，**不包括无条件可用的 generate_image**。共享 IMAGE_PROVIDER_ADAPTER 只描述 provider ID 与定义，不因此声称服务实际存在。
- `connectors/index.ts:getConnectorStatus` 对 MCP 检查配置并调用 probeMcpHealth；后者通过 MCP host listTools 确认在线，仅返回工具数量，不返回实际投影/原名映射。publicConnectorView 不自动把 configured allowlist 填成 status.projectedAllowlist。故当前正常 MCP 状态路径还需调用 getConnectorTools。
- `getConnectorTools` → buildMcpAllowlistDto → previewMcpTools，再取实际 listTools 和 connector allowlist，形成 rawName/projectedName/selected 及 projectedAllowlist。健康检查成功或 toolsCount>0 不等于发现并选中 generate_image。
- `connectorProjection:25–30` 仅在 **provider 正是 pango-image-mcp，rawName 精确为 generate_image，selected=true，且其 projectedName 确在投影集合内** 时添加公开 adapter 别名 generate_image。之后 registry/governance 再检查权限；不根据名字前缀猜归属。
- 执行链 `agent-generate-tool-surface.ts:219–245` 才根据必需工具和获准 connector 投影 buildImageTools，注入盘古配置和引用 resolver；adapter 支持配置/环境/Cursor 发现，但预检不走这个 fallback 解析器。因此“本机其他配置中的 raw tools/call 可成功”不能单独证明当前正式任务联合工具面应通过，也不能用 fallback 绕过真实发现/ACL。

报错位置为 `preflightExpertTools` 最后的 unavailable 分支：registry.has(generate_image) 为 false 才使用“联合工具面未提供”；若已注册但权限阻挡，其文案是“必需工具未获得当前任务权限”。因此给出的 detail 支持**没有注册出公开别名**，但尚不能区分：provider 未配置/离线、未启用、没发现原名、未勾选、投影缺失，或 API/版本差异。providerIssues 会追加在缺工具 issue 后面；仅看 attention 首条会丢失具体 provider 失败原因。linked Skill 没有参与上述 alias 建立，当前无证据归因于它。

### 一个条件性兼容风险，不能冒充本次根因

connectorProjection 在 `status.projectedAllowlist` 是数组时立即返回（包括空数组），不调用 getConnectorTools，也不补 raw alias。若某个旧实现/包装层把非空 **命名空间工具名**放到这个字段，可能健康且已选中却仍缺 generate_image。当前仓库普通 MCP health 不产生该字段，故尚不能把此分支认定为本次实际原因；必须看 QA 返回的 status 结构。显式空投影有现有测试约束，不应无条件 fallback 或把配置 allowlist 当发现结果放行。

### 主线已有 health/API preview 最少需保留的字段

1. 当前任务 snapshot 的 connector bindings、allowedConnectorIds、requiredTools；QA loaded 模块身份与当前源码分开。
2. pango getConnectorStatus 的 ok、connector.id/enabled/agentVisible、status.state/ok/userReady、是否存在 projectedAllowlist；不要导出 token/env 凭据。
3. getConnectorTools 的 ok/code/message，以及目标项 rawName/projectedName/selected、projectedAllowlist。如果完全没有 generate_image 原名，应先按真实 provider 工具契约解释，不靠放宽名字匹配解决。
4. 完整 preflight issues，尤其通用缺失错误后面的 provider issue。Photoshop 不可用本身不应否决已完整提供 generate_image 的盘古工具面。

已有 `tests/expert-task-tool-preflight.test.js` 覆盖 createStart/execute 的 image adapter selected 原名通过、无投影拒绝、未选中拒绝，以及显式空投影不 fallback；这些是构造 DTO 测试，不等于本次实际 connector 发现通过。本轮未重跑或修改它们。

最小处置原则：先用上述实际字段定位断点。若服务原名/权限未提供目标，则如实配置/说明，不把 builtin 无条件塞进预检；若证实是同一可信发现结果在 status/DTO 两条路径丢失别名，应共享带 provider 身份和 selected 证据的投影规范化，并保留空投影、错误归属及权限拒绝测试。此时才讨论通用修复，不能加 image-producer ID 分支。本轮仅审查，无生产改动。

当前相关 SHA256：

```text
expert-task-tool-preflight.ts f89c3de9f89a5b21119d0f4d6be6f0c3f10c77912e45c6cf6b180806275e07b9
agent-provider-tool-contracts.ts ee1cf1da36589d792ac2401cea0d00118658a20ab68db2f4f44bef2c72d0ffe2
connectors/index.ts 1abc76d9d351e5a8332094a3d769b1f5de67f107b53df0364870e699ccc1ee2c
connector-capabilities.ts 747184d9fd1355449f1b796f822efff4dcb176b56a3720abeb025f0fb89edfc2
agent-generate-tool-surface.ts d5417e6ce090ea99c1a89b8a2a7a62d728a85228533c0efb53ce3cde9a43cf88
```
