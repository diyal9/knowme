# RQA26 old-R01：同 run 方法装配只读审查

日期：2026-09-06。审查对象为实际安装 image-producer 3.2.0；不是尚未安装的候选 3.4.0。仅检查方法输入，不做视觉/专业评分，不调用模型或 QA，不修改源码、配置、冻结评测或旧评分。

## 无损归档补核：当前结论（2026-09-06）

新增 `rqa26-actual-runs-lossless.json` 后，**blocked 同 run 的三份完整 body 在两次原始请求中 exactIncludes 均为 true，无需去空白或改写正文**。此前插空格属于普通文本 PTY 导出的损失，不是 Skill 装配缺失或正文改写。下方首次审查保留为历史记录，其中“无法定位空格来源”已被此次无损证据及主线导出链说明取代。

本次直接 JSON.parse 新文件，计算 SHA256(JSON.stringify(data))=`9a91d7096875a6431dcaeffea4d2c07b5b4d4271c02f5a5fcd9f16b0c44fb2d9`，与 `export.sha256` 精确一致；归档文件自身 SHA256=`3d69aa3dc389ccfca8681af7337a5ac21d6b4d17ca3a1cbfafddf28ebed3ac10`。主线说明该归档从 PTY Node 内存原 app.evaluate 对象 gzip/base64 重新导出，**不是对旧文件去空格后修复**；本审查独立验证解码后数据哈希及内容对应，不声称亲自观察过重新导出操作。

从 `rqa26-before-sources.json.records` 用源解析正则取 body，不 trim、不归一化；从 `data.blocked.wire[1/3].body.messages` 取字符串内容/多模态 text 段。六次 includes 均 true。冻结六条 source text 的 SHA256 全部仍与记录一致。

| 外链 Skill | 完整源文件 SHA256 | 原 body 字符 / SHA256 | 首次 / 第二次 exactIncludes |
|---|---|---|---|
| th-art-intake | ab37f2d5d54c08634039fd927d3d4dfc8a65d8dcd6be0547b3b76f0b08c0121d | 1693 / 0b2668532cee2b87901760fadeab8edd06c44ef08d3eaed438aeb93eeb2675ba | true / true |
| th-art-prompt-enrich | b39cf0288c45e273b46f21368aba49287e8120b0b5785533a665b751477869f4 | 2249 / 5151b43d8bec0702884373b463778f324b9fb50244391c9ec4b56a6ebc4cc0d7 | true / true |
| th-art-pango-generate | 21a7833baecbca1e68ef1bee90ec342d0b041e17420e91c149028e3f2b326197 | 2932 / 9ca92a03eb71969360b32ba831c82aff3bea203e3e6181d033a250a6715f01c0 | true / true |

补充且分开绑定：`data.candidateR01.task.assignmentSnapshot.agentVersion=3.4.0`，task=`task-mtpllbgi-sw9ph`，run=`expert_task-mtpllbgi-sw9ph_mtpllfe9`。采集 label `old-R01-D1` 已由 `configuration=candidate-3.4.0`、`labelCorrection` 及 snapshot 更正，不算旧3.2。它的三次语言模型请求 `wire[0/2/4]` 也均包含三份同源完整 body（9次 exactIncludes 全 true）。其实际交付评分另见 `rqa26-candidate-r01-grading.json/.md`，不能改变此前 old-R01 框架阻塞 N/A。

仍然不可证：引用文件的全文递归装配、模型实际理解/遵循每步、未捕获的其他运行。完整正文进入请求不等于专业合格。此更新未读取恢复后的 QA profile/安装目录，未改变原始两个导出文件或评测标准。

## 首次审查结论（保留历史证据边界，以上述补核为准）

**三份外链 SKILL.md 的完整正文均可在两次模型请求的导出 messages 中找到；不是只加载 L0，也没有发现正文被预算裁剪。** 不能用原 body 的 `includes=false` 判缺失。严格比对结果是：去掉比较区间首尾空白后，每份实际正文都能由原正文仅插入少量 U+0020 空格得到，原有字符、换行、Markdown、参数和章节全部保留。

但这不是字节完全一致证明。两次请求的插空格位置不同；当前读取的解析/装配/裁剪源码没有这样的任意插空格逻辑。证据中没有导出器实现及原始 HTTP 字节的独立校验值，**无法确定插空格发生在历史运行链还是采集/导出链**。不将这一未定位差异虚构成 safeJSON 的既定行为，也不宣称模型实际理解或执行了全部方法。

## 绑定与原始证据

- task：`task-mtpkut6w-6cluf`；session：`wb-expert-task-mtpkut6w-6cluf`；本次主线指定 run：`expert_task-mtpkut6w-6cluf_mtpkuxml`。导出 task 状态为 `needs_input`，session.run 的状态字段仍为 `active`；不能据后者推定交付成功。
- `rqa26-old-r01-framework-blocked.json`：SHA256 `e867e85eec3bf650244eb8ba9963ea0526c4c717ad02025c2624d75368148d3f`。
- `rqa26-before-sources.json`：SHA256 `0ca0fe3c5ba89f24888959b5a41449f4fd0a9ac945e15ea1e6b77bb003ad8b3e`。六条冻结记录的 `text` 重新计算 SHA256 均等于各自记录的 `sha256`。
- 两次模型记录为 `wire[1]` / `wire[3]`，`label=old-R01`、`transport=node:https`、`body.model=qwen3.8-flash`，开始时间分别为 `08:56:30.790Z` / `08:56:33.644Z`。取各自 `body.messages[5].content[0].text`，而不是 JSON.stringify 后的整包字符串。
- 同消息的图片引用为 JPEG、455950 bytes、SHA256 `6c8124d9d8735d9b3133e402172fe7096fd3e52a9bbe474c90394aa86582ff33`。图片存在于模型消息，不等于已登记为可供生成工具引用的会话附件。
- 外链来源为 `D:/aiworkspace/th-art/.cursor/skills/{th-art-intake,th-art-prompt-enrich,th-art-pango-generate}/SKILL.md`；本轮读取冻结记录，不重新读取外部目录或当前安装目录来替代历史证据。安装 E/C/L 冻结文本均为 3.2.0，canonical 的 `generated-image.requiredSkills` 明确列出这三项。

## 可复算对比

按 `skill-runtime.ts` 的 frontmatter 正则取 body；实际文本按 `# 技能 <id>\n` 定位，终点为下一技能分隔符或受限上下文结束标记。对两边只做 `.trim()`，再执行顺序双指针比对：相等字符同时前进；仅实际字符为普通空格时允许实际指针单独前进；其他不等立即失败。所有六个比较均完全消费原正文，无删除、替换或未消费尾部。这里不是简单抹掉所有空白后宣称无损。

| Skill | 原 body 字符（未 trim / trim） | 首次实际 trim 字符 / 插空格 | 第二次实际 trim 字符 / 插空格 |
|---|---:|---:|---:|
| th-art-intake | 1693 / 1691 | 1695 / 4 | 1697 / 6 |
| th-art-prompt-enrich | 2249 / 2247 | 2251 / 4 | 2251 / 4 |
| th-art-pango-generate | 2932 / 2930 | 2937 / 7 | 2936 / 6 |

原 trim body SHA256（顺序同表）：

1. `34b786e7b7ea479ed4dd9aaa364d2cfb5aa07e64274eb87ff851778d3f090ecc`
2. `fc06045bbe875be64d281da997851f63e640a3d298a53b6c2fd9fee4ae7e642d`
3. `6f21686bdde23075257f1d057fc83bb050c3477523f49f7f339069a79afece95`

首次正文 SHA256（同序）：`79b475ac68570a4f2fc722ba425504b4eaa140b8666d93115e4ab7349d204338`、`7a943970a46bce782f3af5bb255e27809f4ab1ec64e0250793f42633eb659111`、`5a291f3493c466a0138c38dcb6d06eddaa3c9c39f2b8565b353308ea9d9feda3`。

具体差异例：首次 intake `立绘精度→立绘 精度`、`跳过工厂→跳过工 厂`；enrich `规范检索→规范检 索`；generate `稳定后续帧→稳 定后续帧`。第二次 intake 出现 `## 必读→## 必 读`。这些是导出文本中的真实差异，不能归于展示层自动折行；但其产生位置仍未知。不能外推任意空格对代码、路径或 Markdown 都无害。

**没有可列出的缺落正文。** 尾部核查还包括 intake 的“禁止/输出语言”、enrich 的“失败处理/输出语言”、generate 的全部“失败处理/禁止”，尤其“模型不支持图生图：改文生图或换 model”和“执行 G3 QA（交给 th-art-qa-inspector）”都存在。方法引用的 persona/templates/registry/enrich-rules/pango-aigc 等文件只有链接；本证据不能证明链接目标正文也已加载，不能把“SKILL.md 完整”扩张成整个依赖方法库完整。

## 当前权威源码路径与预算边界

只读核对以下当前源码；未保存该运行进程的全部 loaded-module 哈希，因此它们解释当前实现，不冒充运行当时逐模块快照。

1. `src/lib/expert-task-runtime.ts:610` 将交付定义 `outputSpec.requiredSkills` 传为 `skillRefs`；`src/lib/agent-generate-prepare.ts:143` 归并为 slashRefs，`:484` 调用装配；`src/lib/capability-hub/session-context.ts:61` 转入 `assembleCapabilityContext`。
2. `src/lib/skill-runtime.ts:150` 解析 frontmatter，body 直接取正则第二组；`:350` 读取 SKILL.md；`:588` 的 loadSkillL1 校验授权/启用/边界后返回 body。默认单份预算为 **12000 字符**（`:27`），超预算失败，不静默截正文。不能套用此前其他版本的 2400 数值。
3. `src/lib/agent-context-assembly.ts:43` 的 buildSkillL1Block 只加技能标题和分隔符；合并字符上限 **8000**，超限抛错。本组三份按当前拼接规则为 **6960 字符**，没有越限。`:134` 的 `skill.explicit-content` 是单独 skill block，maxTokens=8000；与字符上限不是同一单位。显式加载路径在 `:230` 附近，同时也可另投影 L0；本次两者都见于消息。
4. `src/lib/context-engine/types.ts:90` 对内容只 trim；`src/lib/context-engine/assembler.ts:87` 的 fitBlocks 交给预算函数，`:142` 的 restrictedContextEnvelope 原样放入正文。Skill 实际在“受限协作上下文 / skill / user”内，**不是** task_fact/memory 那种 JSON 数据信封。外层 JSON 编码会转义换行/引号，但解析回字符串后仍有上述插空格，故转义不是本次差异的充分解释。
5. `src/lib/llm-runtime.ts:158` 的 fitTextWithEstimator 在预算足够时返回原文；不足时保留首尾并裁剪。该逻辑不能解释这里仅插入空格的差异。实际六个完整顺序对比比“未出现 truncated 标记”更强，足以排除已捕获 SKILL 正文的内容缺落。

源码读取时 SHA256：

| 文件（src/lib/ 下） | SHA256 |
|---|---|
| skill-runtime.ts | 5b1dbf2a1dfaf989080ed1137036a9719949dd2b469dc5e48f24b8a479750823 |
| agent-context-assembly.ts | 0ec09e0da814c542c6bc9717bfdc512f77b53fcf018d21613525ac14d979b620 |
| capability-hub/session-context.ts | e052513c9f805ffc9fc147999f5f378799c28ffbfe816b20cf05e6802770e9e7 |
| agent-generate-prepare.ts | 6f4755e799b2ae4ca59b1812128ce340efb8cd4df642f7f14debdfc9e9b8f9aa |
| expert-task-runtime.ts | 505049371302d1e99105bda6481dfc44b828e7668c8aa104b70027256c35e3d1 |
| context-engine/assembler.ts | 785420e28634083c2b10d4059aad72f5f7bd0d5571e62708309301d78ab3f804 |
| context-engine/types.ts | 8a2b3dada440262089628b7c8c7d6828b943657a8aeb09b49cd6a8a73ffb6f68 |
| llm-runtime.ts | f7620abf0caa17865e2bd98ded8cf421096c537af2b80237bb6fdc7781a82eda |

GitNexus debugging skill 用于导航：query 提示 FTS extension 未加载，精确 context 找到 assembleCapabilityContext，但返回 epistemic=lower-bound、作用域提取完整性未记录。按当前文件补核调用路径，没有修改符号，也没有重建索引或执行 impact/提交。本报告不将不完整索引当作全调用链证明。

## 首次审查的不可证事项及本格处理（历史范围）

- 导出没有提供可独立核对的 `skillRefs`/`skill.explicit-content` contextAudit 字段；此处以模型请求正文直接证明三方法内容可见。diagnostics 中 `loaded=3`、`loadedNames=[discover_tools,generate_image,list_paint_models]` 是**工具**统计，不能冒充 Skill 数。
- 不证明模型服从方法、引用文件已读、模型完成视觉检查、或3.4候选已跑。也不能从本次外链正文可见倒推 RQA24/此前所有运行的装配。
- 已记录两次非付费模型目录查询，其中一次标记 discovery；session steps 有 list_paint_models done 和 generate_image error（“参考图片未登记在当前会话中”），无真实产物。导出 wire 没有付费图片生成请求，符合主线报告的框架阻塞；不要把“0付费图片请求”说成“0语言模型请求”。
- **old-R01 保留 framework-blocked / N/A，不评0/9，不计专业评分分母。** 后续修复复验应另编号；不覆盖该 n=1 原格。本次唯一写入本报告，未评图、未修改评分或冻结输入。

## 最终无损复核补充：两候选及原blocked（以上历史限制不覆盖新增证据）

本节明确取代历史报告的“空格来源未知”和“不能证明3.4候选已跑”两项限制；原plain JSON仍完整保留，没有去空格重造正文。主线从原Node内存中的app.evaluate对象gzip/base64导出，评审对解压归档的JSON.stringify(data)重新计算SHA256并逐项比较源body。

- `rqa26-actual-runs-lossless.json` 的 data SHA256=`9a91d7096875a6431dcaeffea4d2c07b5b4d4271c02f5a5fcd9f16b0c44fb2d9`，与export.sha256一致；`data.blocked.wire[1/3]` 两次真实模型输入，对三个冻结body不trim、不去空白的exactIncludes全部true（6/6）。正文原长度1693/2249/2932；正文及完整源SHA见顶部补核表。先前插空格差异是有损plain导出，不是当前无损对象里存在的装配差异。
- candidate R01：task `task-mtpllbgi-sw9ph`，run `expert_task-mtpllbgi-sw9ph_mtpllfe9`，真实snapshot3.4.0。`data.candidateR01.wire[0/2/4]` 三次模型输入 × 三份冻结body exactIncludes全部true（9/9）。保留labelCorrection：observer `old-R01-D1`不是实际版本。
- candidate H02：`rqa26-candidate-h02-lossless.json`，task `task-mtpmgiwr-ceqif`，run `expert_task-mtpmgiwr-ceqif_mtpmgmts`，真实snapshot3.4.0。data SHA256=`48d1a66132cf20d1967d3e10edbe2a84ed302292cd63eea4661e24707192d7ff`，与export.sha256一致；wire[0/2]两次模型输入 × 三份相同冻结body exactIncludes全部true（6/6）。不是从catalog登记数或工具loaded数量推断。

两候选的末次模型消息均实际携带对应输出图和原始基图的image-bytes/hash摘要；这仅证明对应视觉输入可见，专业检查另见各grading。两次候选并不补写或替换old首次blocked，后者仍N/A。

**剩余边界不变：** SKILL.md完整可见不等于其链接的persona/templates/registry/enrich-rules/pango-aigc等额外文件已读，也不等于模型遵循全部SOP。未证明其他历史运行、服务内部逐像素处理、长期稳定性或纯Skill因果。主线报告的候选H02缩略图/contain/退回聚焦/刷新重开验收是主线UI证据，不是本次评审独立操作；没有付费revision或接受验收，不据此宣称已通过用户最终验收。
