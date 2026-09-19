# RQA24 图片验证、修改谱系与预览覆盖审查

日期：2026-09-06。独立只读代码/测试审查；未运行测试、模型、浏览器或 Electron，未接触 QA PID9072 / profile。仅新增本报告。下列“已覆盖”表示现有测试的断言范围，不表示本轮执行通过，更不表示画面专业验收通过。

导航：已完整读 AGENTS.md、GitNexus debugging/exploring 技能。GitNexus query 返回 FTS 降级、无相关 process；context(persistImageBlocks) 提供有限调用关系。采用限定文件的直接源码/测试阅读 fallback；未知图谱影响不作为安全证明。无源码符号编辑，无 impact 修改审批事项。

## 结论与现有证据

正常生成链路具有真实解码、保存及回执断言；恢复和参考图输入不能因此自动视为经过同一验证。UI 的唯一输入框、验收按钮位于对话而非图片内、重开 review 操作已有明确测试，不应重复报成“完全缺失”。仍缺修改闭环、重复来源及异步本地大图的组合边界。

| 范围 | 现有精确证据 | 证明到哪里 |
|---|---|---|
| 图片字节 | `tests/image-validation.test.js:8,20,34,45,65,83,93,104` | sharp 真实 PNG/JPEG/GIF/WebP/AVIF、错误 MIME、HTML/截断/像素损坏、大小/尺寸/帧/总像素、队列及 abort 后槽位保持。APNG/SVG 拒绝，不是“所有 PNG/动图支持”。 |
| 保存/回执 | `tests/agent-image-tools.test.js:13,66,118,148,172,191,209,220` | inline/CDN 有效字节落盘；混合有效无效只为已保存图发回执；无效图、损坏缓存和磁盘失败不能造回执。MCP/网络是 fixture，非外部生成效果验证。 |
| 下载/发行 | `tests/image-download.test.js:9` 起；`tests/image-native-packaging.test.js:27` 起 | DNS pin/逐跳 SSRF、IP literal、流式体积、deadline/abort；ASAR 中 Electron Node 解码。后者不是完整发行启动资格。 |
| 单缩略图及操作位置 | `src/renderer/features/artifact/artifact-preview.spec.tsx:10`；`src/renderer/features/expert/expert-task-room.spec.tsx:309,392,412` | 即使 contract 包含 accept/revise，图片内不渲染接受；无 artifact 不造预览；两个不同图正常导航。 |
| review 重开/主输入修改 | 同 room spec `:73,121,632,991,1086,1109` | answer/image/video/audio 冷重挂 v2 操作恢复；非 review 不显示过期验收；唯一 composer、聚焦、失败保留文本、附件透传、多成果选择、运行中 queue 一次调用。 |
| contain | `src/renderer/features/expert/expert-layout-contract.spec.ts:10`；`scripts/image-preview-smoke.py:9` 起 | 前者仅 CSS 文本。后者确有 Chromium 几何/解码/portal 检查：三视口 × 方/竖/横图；本轮未运行，不能称只有 CSS 测试。 |

## 六个有界缺口与建议 oracle

### 1. 恢复旁路仍按扩展名认图——源码可确认的缺口，优先确认

`src/lib/expert-task-legacy-migrations.ts:17-40` 在最近一次 generate_image=ok 的 run 目录，按扩展名排序取首文件；不读字节、不解码。`:65-107` 可写入 image artifact、v2/review。blocked/verificationPassed=false 已被 `:59-60` 拦下，不能忽略这个保护。

更关键的是现有 `tests/expert-task-runtime.test.js:394-430` 本身把字符串 `new-real-image` 写到 `generated-01-new.png`（`:402`），配成功 evidence 后断言 review/v2。这不是“真实图片”fixture，也没有验证恢复对象与原保存回执的字节身份。

触发边界：历史成功 run 的文件随后损坏/被 HTML 替换，或目录首个 `.png` 无效而后一个有效。期望：不能仅凭旧 tool success 将坏字节恢复为可验收图；不制造新成功回执，不丢失原失败/修改意见。应先补隔离恢复红测，再由 main 决定通用验证方式。本轮未执行复现，不声称已发现当前 QA 中的坏文件。

### 2. 参考图解析只证明登记/大小，未证明能解码

`src/lib/agent-media-resources.ts:11-31` 将当前会话已登记路径交给 preview reader；`src/lib/artifact-preview-source.ts:42-50` 按扩展名 MIME + stat 大小读为 data URL，没有字节解码。`tests/agent-media-resources.test.js:15,19,37-39` 用 `fixture-image-bytes` 作为 PNG，明确期望原样转发 provider。

触发：已登记 reference.png 的正文为 HTML/截断图；另有 stat 后文件增长的读取边界。期望测试需区分“可访问的已登记引用”和“可解码且在预算内的参考图”。当前输出解码不等于输入已验证。HTTPS/data/base64 在 resolver 开头直接透传，是现行适配契约；本审查未证明供方如何抓取它们，不能把输出下载器的 SSRF/预算保证移植到参考 URL 上。

### 3. 修改来源与新成果未形成闭环；相同字节的身份尤其未覆盖

已有 runtime `:520-539` 将上一版 artifact 引用/正文放入修改 prompt；`:774-785` 记录 version/previousVersionId/executionRef。文档修改测试 `tests/expert-task-runtime.test.js:560-708` 验证正文/意见/附件完整，但不是图片编辑；media 测试则直接手写 reference_images，绕过主输入和模型参数选择。

建议组合用例：两份图 A/B，主 composer 明确选择 B 修改 → 真实 runtime 请求含 B 的资源引用 → 受控模型工具参数引用 B → resolver 输出 B 的真实字节 → 保存 C → v2/previousVersionId/本轮 executionRef 对齐；失败或取消不把 A/旧 run 冒作新成果。不需要真实模型，但不能仅检查 prompt 写了“参考图”。

同字节边界：`src/lib/agent-image-tools.ts:208-228` 的 ID 为内容 digest，文件路径含 run；`src/lib/agent-run.ts:251-256` 按 ID 替换，runtime `:747-749` 也按 ID 复用。两次生成返回相同 bytes 时，会话身份可能合并，上一版/本版引用无法仅靠 ID 区分。应验证新回执路径、旧路径及版本关系，不仅 version=2；本轮没有执行端到端反例，记录为具体待测风险，而不是宣称必然丢图。

### 4. “一张图”尚未覆盖同一资源从多个来源重复出现

room `:309` 的单图 fixture 没有同时含相同图的 assistant Markdown；`:412` 是两个不同引用。RQA07 `:73` 的 v1/v2 是文字消息，仅挂 v2 图，已证明重开操作恢复，不证明历史两版图去重/区分。

`ExpertTaskRoom.tsx:1064-1069` 直接 map artifactRefs；对话由 `ExpertCollabDialogue.tsx:39` 交给 ContentView，两个呈现入口应组合验证。用例：同一 artifactRef 重复、正文 Markdown 与成果引用指向同图、artifactRef 与 artifactRefs 同时存在、同内容但不同版本。oracle 应是“同一交付实例只一张缩略图；两个有意版本不被误去重”，而非全任务强制一张。未证明现有 ContentView 一定重复渲染。

### 5. contain 有真实几何脚本，但实际本地图/异步切换未覆盖

`scripts/image-preview-smoke.py` 访问固定 5184 测试页；fixture `src/renderer/test/image-preview-fixture.tsx:8` 使用自包含 SVG（布局素材，不是 generate_image 接受 SVG 的证明）。`package.json:22,41-42,47` 的 check/e2e 不直接运行此 Python 脚本。不能用 check green 推断本次 geometry 已通过。

最小额外边界：通过 preload 异步解析本地已保存 PNG/GIF，载入中切换下一图/关闭/重开，检查图与标题/版本始终一致；当前选择载入失败不能留下前一图冒充当前图。再在窄视口检查 dialog/图像不越界。`ExpertImagePreview.tsx` 的 ResolvedDialogImage 仅对解析失败显示空态，没有对应 img onError 测试；通用 ArtifactPreview 的失败测试不覆盖这个独立 modal 组件。

### 6. 图片修改的失败/排队组合仍由文字型 fixture 代表

room `:632-680` 已可靠等待 composer/store/send-ready 后断言 queue 一次，不应再以“仅加 timeout”诊断该旧竞态。`:1086-1127` 覆盖提交失败保留草稿、多个交付物选目标，但不包含真实 v1 图片、参考附件及随后 v2/重开的同一生命周期。

建议一个有界组合：v1 图片 review → 唯一输入带新参考附件提交修改 → API 失败保留文字+附件+选中目标 → 再提交成功只发送一次 → revising 时 queue 补充 → 恢复 v2 后唯一 composer/一组验收按钮，按钮不在图内，意见与版本关联保留。现有测试只覆盖其中分段，不证明排队补充最终以正确图片为底图。

## 当前包与评估限制

读取时 image-producer EXPERT.md/manifest.json 为 **3.3.0**，capability.manifest.json 为 **3.2.0**，catalog.json 条目 `:331-335` 为 **3.1.0**；是读取时的源包观察，可能处于主线增量，不能当已安装 QA 版本。E 的 SOP 7/8 已要求上一版 reference_images 和区分工具成功/视觉核验；C 要求 generate_image tool_result + image artifact。`tests/expert-all-agents-matrix.test.js` 使用 fixture runAgentGenerate/远端图片路径，能检查执行契约，不证明专家真的选对底图、画面对齐或 installed=S​​RC。

已知资源边界不冒称补齐：`image-validation.ts:88-90` 明示 sharp timeout 不覆盖 metadata/OpenInput；现有队列测试证明 abort 后仍占槽直到解析返回，不能称 CPU 已被硬取消。没有新增硬总超时、发行或模型验证结论。

## 读取快照 SHA-256

路径相对 `D:/aispace/knowme`；对应上述审查，不覆盖之后主线修改。

```text
6afc8cdf3f12df78fa80822f980d5f7dc87604fe692f7f9ce77fbf8da7e69dae  src/catalog/experts/image-producer/EXPERT.md
87fe880509f6e96188b7e1c595641e0c2c89948f0b0dd0013ebedee7fe4d7dc8  src/catalog/experts/image-producer/manifest.json
886c352d2f0adb1ae88b147e11480b02e2313da2b654397ab21780495677134d  src/catalog/experts/image-producer/capability.manifest.json
da4de25b3b9c503fd2589e076fb36b6d8dcdaf48bb038f1e396e21c14b2dae61  src/catalog/catalog.json
f68d73aeb96474e1cc8ebd81f4bd76af96b92ce3ebd4696e8c7ff8c6d269f242  src/lib/agent-image-tools.ts
75aacc0dbf7270f4a48d5cc04c773829b27db9e251590b97f1f10720b4f7e355  src/lib/image-validation.ts
7b80d031a094a05eee58dde0bc72817e52af7a03e1ec4f31d0b9eb12aa1f9ade  src/lib/agent-media-resources.ts
6bc31c1f14446dccc92a48eb81d0a669cb5a2706059d2b29327142b1d0da8ea4  src/lib/artifact-preview-source.ts
944389219531a7ff11212bf4b744c8cb9d77a33298e7f8ae6706e8d48ff5443d  src/lib/expert-task-legacy-migrations.ts
505049371302d1e99105bda6481dfc44b828e7668c8aa104b70027256c35e3d1  src/lib/expert-task-runtime.ts
c2fe47eec10c80387fb62a2fc274f3dc828e5e14c1db597bc55226695a60206a  src/lib/agent-run.ts
8e6ccf7d358920281ec62a4674a0ff56432b4a92b50f5871aebda79bf68b97f8  tests/image-validation.test.js
4e4d57378a7a31ab9631be62b421a65f843b18ca24d79b89e5a28439c1606b49  tests/agent-image-tools.test.js
b31a7bc90cac8f4bb16a8dca8ca45b7e92580cdf111025a50651e54c5dbb8b95  tests/agent-media-resources.test.js
cd33f11cd7db92672e0f8630581c21d57c47347a8ea02b00c58e1996a5cd79ef  tests/expert-task-runtime.test.js
54300e0da79744114407b32fec1850ef25616998d292cf987660b78b238f1415  src/renderer/features/expert/ExpertTaskRoom.tsx
25f779a86f526caf92266d8fcf8b7bacda8d474adbdd174f186ebcf083d01d48  src/renderer/features/expert/ExpertImagePreview.tsx
1fefa9b2bae8823387dba3cd7338b4b8df481eed114a15e5988618f4ad183d4f  src/renderer/features/expert/expert-task-room.spec.tsx
428ce434b764446401af8562c17169bb01f6a11921ac0f162554a52eedfbbb08  src/renderer/features/expert/expert-layout-contract.spec.ts
76446ff87aa37d8b10bbc9defc59d4cdf9707f6dae3f09f7d002ed1c85062a28  src/renderer/features/artifact/artifact-preview.spec.tsx
adbdd6aa3c65aee0f5e66f60fa07b6f68785093231506b61ca60287f84837f0b  scripts/image-preview-smoke.py
```

## 补充纠正：MCP health 身份与基线 preflight 必须分开

依据主线本轮实际安全 envelope / IPC 观察（本审查者未请求端点或读取 secret）：

- 未带运行时凭据的旧 `connectorHealth('pango-image-mcp')` 路径收到 **HTTP 200**；JSON 顶层为 `code,msg`，业务码 **10001100**，消息 **“缺少或非法Authorization Bearer token”**。这不是成功的 MCP tools/list 结果，也不能据此判定带凭据的连接不可用。
- 主线确认旧 connectorHealth IPC 未带运行时凭据；带 runtime secret 的 **`connectorsStatus('pango-image-mcp')` 实测 ONLINE、93 tools**。两者认证上下文不同，不能把前者的失败归成后者的服务故障。该实际 envelope 为 HTTP 200，因此“未检查 res.ok”虽是已识别的传输层边界，**不是本例 HTTP 状态失败的解释**。
- 当前 `src/lib/mcp-host.ts:307-311` 将这类业务错误 envelope 读取为 `body.result === undefined`；`src/lib/mcp-tool-pagination.ts:19` 随后返回 `mcp_pagination_error: MCP tools/list returned invalid tools`。这解释了未认证 health 路径的报错转换，但**尚未确证真实任务基线 preflight 走了同一无凭据路径**。
- 基线在模型前失败仍是待单独归因事项。主线正在核对 `connectorsTools` 的 selected 工具与预览前 **64** 项边界；“预览只显示 64”不等于“实际只发现/授权/提供 64”。需绑定失败任务实际采用的连接状态、凭据注入路径、工具完整集合与选中/投影集合，再判断 `generate_image` 等必需工具在哪一层缺失。此处不把截断假设写成已证根因。

此前离线 fixture 仅证明裸 tools / data 包装也能触发同一错误，不能替代本次实际业务错误 envelope。当前结论更新为：**旧无凭据 health 的认证失败已解释；带凭据运行时连接已被主线验证在线；基线 preflight 的独立根因尚待证。** 保持 transport 冻结，未修改源码或测试，未采取认证降级、工具放宽或外部重试。
