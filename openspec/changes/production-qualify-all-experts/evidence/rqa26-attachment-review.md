# RQA26 附件引用与 expert 更新边界复核

> 后续授权补充：新增真实 surface 派发集成 4 项并完成接线变异验证，相关 38 项全绿；详见末尾。下文初次只读审查及缺测说明作为历史保留。

2026-09-06；只读源码/定向测试。未改任何源码、测试、observer 或 QA profile；未安装、未调用模型/API。Pasteur 所有的 dispatch 分类逻辑不在本报告变更范围。

## 结论

对正常受支持的 data URL 附件，当前模型标签与工具 resolver 使用相同的字节 SHA256 和同一 prepared 附件列表；没有发现新协议授予任意本地路径读取的 P1。主线 oldR01 的“模型见图但无工具引用 ID、provider generate 为零”属于主线提供的实际历史，本次未重新采集该 run，不将当前源码绿测说成旧任务已修复或已通过专业评估。

`capabilityUpdate({id:'image-producer'})` 按当前源码只更新该 expert，不递归安装/覆盖 th-art-intake、th-art-prompt-enrich、th-art-pango-generate 的 linked 来源或外部目录。它会启用该 expert，并更新其安装记录；不是完全无写入操作。安装成功也不等于 linked 依赖实际 L1 可用。

## 附件绑定和消息装配

- `image-attachment-resources.ts:8–28`：只接受 image kind、受限长度的标准 base64 data URL，检查 decode/re-encode 一致和 MAX_IMAGE_BYTES，完整字节 SHA256 构成 `attachment:image_<64hex>`。名字不参与身份，同名异图不混用；字节变化就换 ID。该 ID 是内容标识，不是安全令牌、文件访问许可或解码有效性证明。
- `ai-assistant-context.ts:172–187`：先过滤 image、有 dataUrl，再取前三项；每个有效资源的 JSON reference/name 标签紧邻对应 image_url，注明数据不是指令。标签不放 system，文件名通过 JSON.stringify 转义，不直接拼为指令段。
- `agent-generate-prepare.ts:808` 将 payload.attachments 放入 contextDraft；`agent-context-finalize.ts:97–110` 将同一 draft.imageAttachments 交 buildChatMessages，随后真实 fitConversation。`agent-generate-tool-surface.ts:237–241` 给 resolver 的 getAttachments 同样取 prepared.contextDraft.imageAttachments，才 fallback payload.attachments。空 prepared 数组也是权威值，不偷偷从 payload 捞回模型未见附件。
- `agent-media-resources.ts:15–20` 对 attachment 前缀作当前列表精确匹配，失败立即拒绝，不降级到路径/其他源；原 artifact、https、data URL 分支仍独立。知道别的任务的 hash 并不足以从本列表读出其字节；同字节确实存在于本列表时共享 ID 是预期内容寻址，不是跨任务授权。
- `expert-task-runtime.ts:590–598` 先选择任务材料末三张，再作为本轮 payload 传入；通用 builder/resolver 各自取这个列表的前三张。因此专家场景是同一组三张，不是 builder 首三张对 resolver 末三张错配。
- 当前 `llm-runtime.ts:293 起` 将本轮 user 消息视为不可拆分输入；预算足够则保留 multipart 原对象，预算不够 fail closed，而不是只保留图却剪掉其中的引用标签。继续轮的正确 currentInput 锚点仍重要，不能把这点推广为任意调用者、任意历史图都会重建引用。

### 明确的边界与剩余缺测

1. **关键集成缺口**：现有测试已覆盖 builder→resolver、brief 重开、真实 finalize+fit，但没有穿过实际 prepare→agent-generate-tool-surface 的 getAttachments 注入→buildImageTools reference 派发。建议一项全离线 fixture 验证 provider 收到的 reference bytes/hash 与模型所见标签对应，并让 prepared 列表与 payload 列表故意不同/为空以验证优先级。不能仅因两个独立函数各自可用就推断实际 tool adapter 一定拿对列表。
2. **低预算与历史边界**：新增 finalize 测试预算 8000，尚未覆盖恰好容纳/超预算（应不发请求）的三图场景，以及同一次执行的工具继续轮仍保留图/ID 配对。跨轮仅留名字或旧提示文本不能自动重新授权已不在附件列表的字节；这是有意边界，需面向用户说明重新附图/选择已登记 artifact。
3. **无效图并非新引用许可**：resource helper 校验编码/大小，不执行像素解码；正常 base64 包装非图字节也可能生成内容 ID，不能称为有效图像回执。同时 buildChatMessages 对无法形成 resource 的 image/dataUrl 仍保留原 image_url（延续原输入面），此时不会有可解析引用。main 新测试证明 resolver 拒绝坏资源，未证明消息构造会拒绝它们。若此类非标准/无效附件能到达真实入口，仍可能发生“送出了 image_url 但没有工具 ID”；应在入口明确拒绝或给出不可引用提示，而非制造假 ID。本轮没有证据表明真实浏览器产生的有效附件触及此分支，不列为已证实正常路径 P1。
4. 最多三项与逐次同步 base64 decode/hash 是有界实现，但大附件会消耗主线程 CPU/内存；未测性能或 UI 响应性。未把完整 hash 当作 prompt injection 防护，也未改变既有 direct https/data URL 的政策边界。

## capabilityUpdate 不覆盖 linked Skill：实际调用链

`capability-hub/ipc.ts:91` → `capability-hub/lifecycle.ts:627–638 updateCapability` → `capability-import.ts:829–852 installCurated` → `finalizeInstall:559 起` → `capability-store.ts:425–502 installFromStaging`。

1. lifecycle 只以 payload.id 查 catalog/source，并调用一次 installCurated(id)，enabled 固定 true，保留 riskConfirmed 门禁。
2. installCurated 只 stageCopy 当前 expert bundle。当前 image-producer 目录只有 EXPERT.md、manifest.json、capability.manifest.json；并无嵌套三 Skill 包。
3. validateInstallDependencies（capability-import.ts:309–347）遍历现有安装记录进行依赖类型/状态/环检查，无安装回调、无外部 Skill 源写入。对 expert 缺依赖/错 kind 可降为 warning，故安装成功不能代替实际 L1 检查。
4. installFromStaging 按 **kind+本次 id** 计算目录，修改 `store.entries[normalized.entry.id]`、复制该 staging 并哈希；不存在按 dependencies 递归安装的循环。三个 linked Skill 的独立记录和外部源不作为 copy 目标。

限界：未读当前 QA store/APPDATA，未实际调用更新 API；结论基于上述磁盘实现和当前 expert bundle。主线若 QA 已加载旧模块，须自行确认调用路径版本。全安装 store 会被保存、公共 staging 会先清理，因此不要把“不覆盖 linked Skill”理解为可与其他安装并发或完全不影响宿主状态。直接对某个 Skill id 调 capabilityUpdate 则属于另一操作，不在此结论内。

## 独立执行结果

```text
node -r ./scripts/register-ts.js --test tests/image-attachment-reference.test.js tests/agent-media-resources.test.js
8 tests / 8 pass / 0 fail / 0 skip / exit 0

node -r ./scripts/register-ts.js --test tests/ai-assistant-context.test.js tests/agent-context-finalize.test.js
22 tests / 22 pass / 0 fail / 0 skip / exit 0
```

合计 30 项。读取开始时 attachment 文件为三项；主线并行新增两项（畸形/超限/替换/第四张拒绝，以及实际 finalize+fit 配对），本次运行实际包含五项 attachment 测试，已全文读新增断言。没有把主线早先 28 绿算成本代理执行，也未重新构造历史 RED。

GitNexus exploring 技能已读；query 因 FTS 降级无结果，updateCapability context 确认 IPC→installCurated，但为 lower-bound。已沿源码补足；未修改符号，无需修改前 impact。未跑 fullcheck。

| 复核文件 | SHA256 |
| --- | --- |
| image-attachment-resources.ts | 5EE64BA6F5D9F723E3C2AD5A43EA9AD4608B763F6595E7E104DD63398EB77FE0 |
| ai-assistant-context.ts | 9D2C5028E4E0893904814A9B740C5EC07326ABE1C2005B1AA5A76A1D77D8C905 |
| agent-media-resources.ts | 77EB64549F2CCA31E63766ADFEBBA7ED98F4B3BE4B4CB36C9207BCD9DAFEBA48 |
| agent-generate-tool-surface.ts | BCB63D9D6FFA65B1DEE5257635D77E6DFFC3936B17FF46C6EDC6B2248D7C8582 |
| tests/image-attachment-reference.test.js | 9D28BA5AB77803E8B46719E5A9B3AB5B75A1FECD3CD0ACCD0E37EBBD7A0E6ED2 |
| capability-hub/lifecycle.ts | E65F7B757D83401FB365465AD80A195CCA74B48460D2814915FFFE8FEA2FEB87 |
| capability-import.ts | 20B3C6B9AFFFD08B3D813772FF37561C6F6C6533D73ECDB4BEF0ACC595CAFD82 |
| capability-store.ts | 962B5348956C5AC4862C9B1F63EC50F86275A2EBFAC94DF4F7D1A653A5D50C87 |

## 授权补充：真实 surface 附件派发集成

新增且仅新增测试文件 `tests/image-attachment-surface-integration.test.js`，SHA256 **25E2AC9B7FBA93D5F4B91FD682E7FAF51AF0A1FDD0054545F3A25515A8EFD45F**。未改任何共享 fixture、其他测试或生产符号。读取 gitnexus-exploring，buildRunToolSurface context 确认入口调用链但为 lower-bound；本次只新增独立测试，无既有函数编辑。

fixture 采用既有 agent-calculation-tools/能力授权测试的生产依赖注入模式，在本文件独立构造环境。用 Module 编译执行**原样生产 buildRunToolSurface**，只替换 agent-generate-libs 的环境桶，不替换 resolver/finalizer。真实 getSessionCapabilityBindings、resolveToolSurfaceForRun、V1 registry、capability guard、参数校验、toolExecutor、buildImageTools、图片解码/临时保存均运行。buildImageTools 的窄 transport wrapper 只注入 fetchImpl，不设置/替换 resolveMediaReference；后者必须由生产入口提供。

无需真实模型，mock MCP provider 捕获实际 tools/call body，返回本地生成的 5×7 PNG。所有保存只在 mkdtemp 隔离目录，完成后清理；不触及 profile。四项实际行为：

1. prepared 图 A、payload 同名异字节图 B：真实 finalize 产出的引用紧邻图 A；实际 toolExecutor 派发 A，provider reference_images 与 A 的完整 data URL、decoded bytes 和 SHA256 都相等且与 B 不同。B 引用被拒绝，provider 次数不增加。
2. prepared 明确空数组、payload 有图：不回退；引用派发失败且 provider 0 次。
3. **仅兼容分支**无 contextDraft、payload 有图：真实入口 resolver fallback 成功派发 payload 图。此项不宣称无 draft 时模型已收到配对标签，只验证既有 dispatch fallback。
4. 两个不同 task/session/run 独立 surface：第二任务不能派发第一任务图的 hash、共同文件名 same.png 或任意本地路径；provider 始终 0 次，随后派发第二任务自身引用成功。正对照排除了“工具未注册/一律权限拒绝”的假通过。

这关闭了初次报告中 **buildRunToolSurface 注入→真实 image handler→provider 参数** 的接线缺口。prepareAgentGenerate 上游仍用显式 prepared fixture，不是完整主进程启动测试；安装、真实 L1、模型理解、付费生成和 UI 不在覆盖内。低预算继续轮边界未扩大测试；普通历史文本不会自动赋予附件权限保持原定边界。

### 精确运行记录

```text
node -r ./scripts/register-ts.js --test tests/image-attachment-surface-integration.test.js
4 tests / 4 pass / 0 fail / 0 skip / exit 0

node -r ./scripts/register-ts.js --test tests/image-attachment-surface-integration.test.js tests/image-attachment-reference.test.js tests/agent-media-resources.test.js tests/agent-capability-authorization-integration.test.js tests/agent-context-finalize.test.js tests/ai-assistant-context.test.js
38 tests / 38 pass / 0 fail / 0 skip / exit 0
```

非事后重构 RED：测试编写时主线附件修复已存在，所以首次直接绿。另在独立进程**仅内存读取层变异** production 入口的唯一 getAttachments 表达式为 `() => payload.attachments || []`，不写源码/测试文件。冻结四项实际 **1 pass / 3 fail / exit 1**：prepared 优先、空 prepared 和 task 正对照失败，只有无 draft fallback 通过。原文件重新运行 38 绿。此变异证明测试会捕获所针对的错误接线，未把它描述为真实历史旧源码 RED。

测试时生产入口 hash 仍为 BCB63D9D6FFA65B1DEE5257635D77E6DFFC3936B17FF46C6EDC6B2248D7C8582；image-tools 当前 hash 为 3C855DCF9FD502B619E887C540FD1188B95489DFF15FE6A0445D31BD3D19DEF0（Pasteur/主线拥有，本代理未改）。负例检查 media_reference_unavailable 和 provider 调用数；没有扩大为完整未知操作分类认证。

## observer 加固的有界复审

当前 helper hash **03B32B6C6C2CD8CD8D43F0B0B8E8DC98651B198E12E946C9D58F32FD7D863535**，未改。全文读到：取消 response.clone/json 消费；record 最多 64 条、每请求 12MiB；增加 token/password/credential key、nested JSON、内联 URL 与 error 文本 scrub；注释承认自然语言敏感性，不再承诺绝无秘密。

纯离线 VM + fake electron/http/https/fetch 验证原 helper（未装入真实 QA）：模拟 response.clone 会抛错的响应对象，66 次 mock fetch **clone 调用 0、返回对象始终相同、records=64、omittedRequests=2**。旧 generic token、文本内 apiKey JSON、句子中 query URL 三类 synthetic marker 不再留存。此前同步 clone 影响 transport 成败的具体反例在此版本关闭。

不扩展为日志框架审计：自然语言仍敏感；短裸 base64 的 >10000 阈值仍在，不能称任意图字节都只留 hash；记录上限不是低内存证明（64×12MiB 仍可较大），HTTP chunks 与 Request/编码观测盲区、restore 单 owner 限制仍应按受控 QA 使用。主线“旧导出扫描凭据 0/query URL 0”是扫描结果，不证明任意文本无敏感内容，本代理未把其转述为安全保证。
