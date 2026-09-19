# RQA19 research-routing 独立只读诊断

2026-09-06。**明确通用误路由已离线复现**：只分析提供材料的内容/创意任务，被通用词组合升级为必须取得search_web回执的实时研究任务。新增测试24项：**7通过、17失败，exit1**；既有research-routing测试仍**8/8通过，exit0**。未改src或原始材料、未调用模型/工具handler、未访问APPDATA/QA；本轮仅新增指定测试及本报告。

## 精确原因与调用链

1. `src/lib/research-routing.ts:21–26`先压缩空白并截取800字符，优先displayPrompt。`:40–41`仅用`FRESHNESS_RE && RESEARCH_RE`，未区分任务动作、材料内容、否定/范围限制；“当前”不一定要实时事实，“公告/发布”不一定是要求搜索。
2. 冻结RQA19通用后缀明写“不联网”，又有“允许但不要求平台**当前**已授权的纯计算工具”。该“当前”与正文公告/发布词跨句结合，足以触发分类。四份CS/CD输入的“不联网”都仍在800字符窗口内，故**本次主反例不是裁剪丢了禁令，而是根本未消费禁令/任务语义**。
3. `research-routing.ts:167–180`对active public/mixed且工具面存在search_web，固定建立`workflowId=realtime-public-research`、`requiredTools=['search_web']`、`tool_result/minChars40/forbidTruncated=false`、`tool_success`。与主线所述真实taskFrame形状一致，不来自专家manifest声明。
4. `expert-task-runtime.ts:572`把brief.goal/task.goal及验收意见作为displayPrompt；`agent-generate-prepare.ts:527/531/534`选择researchPrompt、协调旧frame并清空专家旧frame。**但随后**`agent-generate-tool-surface.ts:380–391/417–427`按该researchPrompt重新路由，合并进groundingTaskFrame并保存referenceState。专家旧frame清空并不能防止同轮重新注入。
5. `agent-generate-execute.ts:36/84`把surface frame送到ctxBundle；`agent-run-executor/phases-ground-persist.ts:121–148`合并referenceState、ctxBundle与input执行契约，再调用verifyClaims及validateExecutionCompletion。模型遵守禁联网而没有search_web回执时，即使专业正文可交付，新增义务仍会触发缺证据；改写正文不能补出回执。

工具面条件仍重要：`:380`的noTools路径不创建研究frame；`:269/313`构造并投影工具后才取records，只有search_web实际被列入才产生强制要求。本轮只用无handler的工具描述复现该条件，**未证明当前隔离安装权限为何让它可见，也未证明任何真实网络调用发生**。不能将源码包network=false直接推成“所有实际工具面一定无search_web”。

## 冻结输入复现，不混评测答案

从`rqa19-professional-cases.json`只取goal、逐项`[id]\ntext`、request和common_input_suffix，以空行连接；没有加入五断言/critical failures。将完整委托作为displayPrompt复现其存入brief.goal的路径；这是一份可重复离线装配，尚未取得实际四run的逐字displayPrompt，不能冒充已比对真实run输入hash。

| 输入 | 原长→normalize后长 | 首个freshness / research命中 | 不联网在normalize后位置（0起） | 当前分类 |
| --- | --- | --- | --- | --- |
| CS-N01 | 689→684 | 当前 / 公告 | 597 | public/web/active |
| CS-H02 | 659→654 | 这周 / 发布 | 567 | public/news/active |
| CD-N01 | 631→626 | 当前 / 公告 | 539 | public/web/active |
| CD-H02 | 645→640 | 当前 / 发布 | 553 | public/web/active |
| DA-N01（相邻离线反例） | 592→587 | 当前 / 调查 | 500 | public/web/active |
| DA-H02（相邻离线反例） | 780→774 | 更新 / 发布 | 687 | public/web/active |

六例的**短goal单独分类均inactive**，表明材料/通用后缀参与分类会改变结果；不据此建议永远忽略用户完整委托的后置约束。另一个新增反例把“不联网”放到800字符以后，也会误加义务：修复时不能仅在已经截短的researchPrompt上补否定词。

## 测试与修复边界

`tests/rqa19-research-routing.test.js`：四CS/CD各验证inactive、无新frame、清除旧generic frame（12红）；两个DA无web义务（2红）；直接禁联网、仅材料编辑、后置禁令三个通用反例（3红）。7绿为fixture装配、三个明确联网对照、工具不可见、非research已声明契约保留、短可见goal隔离内部SOP/时间。全部失败为实际结果与断言不符，不是TypeError或缺接口。

命令：

```text
node -r ./scripts/register-ts.js --test tests/rqa19-research-routing.test.js
node -r ./scripts/register-ts.js --test tests/research-routing.test.js
```

原8绿只覆盖正向时效请求、动态规划误报、短goal隔离、旧frame清理、工具可用性与上下文插入，没有覆盖材料型委托中的跨句词命中或否定范围。最小通用修复方向：用完整当轮委托约束与明确获取外部时效信息的请求判断研究意图，把材料词/内部时间与用户动作区分；来源工具可见不等于任务必须使用它。保留明确联网要求及其真实回执门禁，不按expertId或“存在providedMaterials”一律豁免，也不能用全篇出现“不联网”就拒绝（引用中的话可能只是材料）。独立显式执行契约与文本冲突需上层处理，不在本次测试中静默删除。

主线所述四run阻断及安装manifest无execution为外部协作证据，本轮未读它们尚未落盘的candidate/run日志；后续应绑定run核对实际displayPrompt、researchRoute与projected toolRecords。DA表只说明机制可复现，不代表其真实验收失败。provideInput/UI修复归主线，本报告不扩展其范围。

## 导航与冻结hash

使用gitnexus-debugging；query FTS降级，buildResearchRoute context给出tool-surface调用者但为lower-bound、无process，classifyResearchIntent impact为UNKNOWN/未解析调用者。已fallback直接搜引用并读当前函数，不把零边当安全证明；未编辑生产符号。

| 文件（相对D:/aispace/knowme） | SHA256 |
| --- | --- |
| src/lib/research-routing.ts | `707166ccdc0f7185e7f816598d384f0e5e7ee504fc4b2e42029b338d0f8dba5e` |
| src/lib/agent-generate-prepare.ts | `4f28b4ad9717c836b60539d742db90de3ed03160ab37000bcdf38dcb0dbd54f6` |
| src/lib/agent-generate-tool-surface.ts | `268aa9df73c6d983bd10299de9b6764b3bfd86c1a87e57126f466b83f0205f51` |
| src/lib/expert-task-runtime.ts | `48bf68be9ea5d6641cf3c7e476b5cecc3903fe3eae5e097c49c5bd5807bfb05e` |
| src/lib/agent-generate-execute.ts | `ef1a2f021fc5d395518f0a273a721acb76f934edff14e9600b34dc18590d0dde` |
| src/lib/agent-run-executor/phases-ground-persist.ts | `4e9c100ee2ce464800559e36479397a045c6b1dd3f01a3707da8feea8b653c11` |
| tests/rqa19-research-routing.test.js | `1f7a578cf5bd521dd62213c746a915a6b55d2caf1d3e371908f666d242e81a28` |
| openspec/changes/production-qualify-all-experts/evidence/rqa19-professional-cases.json | `cb8480da61af0485ff7ab0ab979b6ec779ffa0f65580a1a68671124d6350ac32` |

## 主线 bounded patch 独立复审（2026-09-06，保留上述历史）

**冻结24＋既有8已32/32通过；追加8项挑战后35通过、5失败，exit1。暂不能将修复判为边界收敛。** 没有改生产代码、已有断言或冻结输入。主线已通报两个修改符号selectResearchPrompt/classifyResearchIntent的CRITICAL/LOW impact；本次只读diff，没有再次编辑这些符号。新增测试均为无handler纯函数调用，不表示已执行真实检索。

当前diff确实仅扩大selectResearchPrompt/classifyResearchIntent输入窗口800→16000，并在分类前对删去部分引号的文本检查offline。它解决了本批原始误报和800字符以后的冻结反例，保留了已有明确联网对照、未投影工具不强制、非generic显式契约不删除。但“引号即材料”和“禁外网即无研究”不是可靠边界。

### 可复现缺口

| 级别/性质 | 精确触发输入 | 实际 → 期望；位置与影响 |
| --- | --- | --- |
| P1，旧缺口未关闭（2个红测） | `本轮约束：“不联网，只分析已给材料。”请整理本周公告发布计划。`；ASCII引号同样 | active/public并生成search_web义务 → inactive/无generic frame。`research-routing.ts:36`无条件删除本轮明确采用的约束，`:47–48`仍用原text中的时效/发布词激活，`:174–188`生成真实回执门禁。已有同类阻断路径仍成立，不是授权执行联网的证明。 |
| P2，本轮回归（1红） | `请检索本地知识库里本周项目进展，不联网。` | active=false/scope=none、sources=[]、chat不提升 → active/internal、保留search_knowledge来源且无web frame。`:37–38`在`:59`范围判定之前整体早退。删除“不联网”控制例正确；对比修改前源码，该完整输入也正确识别internal。这里确证的是研究路由/上下文退化，不声称整个Agent再无能力自行调用本地工具。 |
| P2，本轮回归（1红） | `材料原话：\n> 这台设备不联网。\n\n当前委托：请联网搜索该设备本周最新公开公告，并核对官网。` | inactive/无frame → active/public且保留search_web回执义务。`:21–22`先压平行界，`:36–37`不识别Markdown材料引用，设备属性被当成本轮禁令。中文双引号同内容控制例通过；修改前完整block quote输入也为active/public。 |
| P1，旧缺口未关闭（1红） | `请将“最新新闻”这个栏目标题改写为更朴素的四字标题。` | active/public/news且强制search_web → 普通改写无研究frame。`:47–48`仍从原text读取材料词，即使前面已生成instructions变量。肯定对照`请联网搜索“最新新闻”栏目本周的公开更新，并核对官网。`正确要求回执。不能把“只要含引号都不是研究”作为修复。 |

测试定位：`tests/rqa19-research-routing.test.js:120`起全部为新增挑战；`:127`当前约束两种引号，`:140`内部研究成对对照，`:160`材料引用格式成对对照，`:168`纯标题改写，`:175`明确联网查栏目。5红均为真实结果与期望不符，无缺接口/TypeError。

调用点再次确认：`agent-generate-prepare.ts:527/531`选择prompt与协调旧frame；`agent-generate-tool-surface.ts:388–391/418–425`重新产生并合并frame；`agent-generate-execute.ts:84`传ctxBundle；`phases-ground-persist.ts:138`检查完成契约。P1仍以工具面实际有search_web为前提；显式noTools路径独立，不据此指控权限绕过。

### 最小修正方向与界限

区分任务动作、来源材料和约束归属；本轮明确采用的引用约束应保留，来源引文不应取得指令地位。禁外网约束应限制外部研究，不能消灭明确本地检索。仅从被改写材料出现“最新新闻”不能生成强制联网义务；有明确外部获取请求时则保留真实回执要求。以上要求不按专家ID豁免、不以“存在材料”一律放行、不删除独立声明契约。字符串启发式只能有限覆盖，不能把增加引用格式/否定关键词清单称为语义正确性证明；若需要可靠归属，后续考虑上游结构化任务/材料边界。本轮未扩展接口设计或实施。

16000仍是有界窗口，不是完整输入保证；本轮仅证明冻结的后800字符约束用例通过，没有证明16000以后约束仍保留。未新增越界题或扩大修复范围。

### 执行与hash

执行命令（追加前exit0：32pass；追加后exit1：35pass/5fail；均1suite，0skip）：

```text
node -r ./scripts/register-ts.js --test --test-reporter=tap tests/rqa19-research-routing.test.js tests/research-routing.test.js
```

另离线将`git show HEAD:src/lib/research-routing.ts`输出放入Node vm（1s timeout）调用同一classifyResearchIntent，再与当前require结果比较上表四输入，确认“回归/既有缺口”分类；未checkout或写回历史源码。当前源码hash在测试及比较后相同。

| 本次边界 | SHA256 |
| --- | --- |
| 当前src/lib/research-routing.ts（供主线核对） | `f8261498eea30dcaa777c0776e967df96a89787e3b2c4eefd18084859572fc6a` |
| HEAD原始research-routing源码 | `707166ccdc0f7185e7f816598d384f0e5e7ee504fc4b2e42029b338d0f8dba5e` |
| tests/rqa19-research-routing.test.js追加后 | `d422ba5990ae5df48d4b16e7e5655a7e8946091516fb825ab2d319066e734457` |
| 原24测试前缀（截至追加标记前，保留末尾一个换行；与原文件hash相同） | `1f7a578cf5bd521dd62213c746a915a6b55d2caf1d3e371908f666d242e81a28` |
| tests/research-routing.test.js，未改 | `23ecb45e12c316ef7d1fb9bf162fcb25ff39083725d5f6ee66cb61e4019e1680` |

按gitnexus-debugging复查：query依旧FTS降级、无process；context现可找到classifyResearchIntent调用者（包括buildResearchRoute/promoteIntentTier/reconcileResearchTaskFrame和conversation-grounding），但标记lower-bound。故fallback读取当前diff、精确调用点及离线成对复现；未把索引范围当安全证明，未联网修复索引。仅追加本报告和独占测试，不改其他报告、src、QA或APPDATA，不跑全check、不commit。

## 最终固定40项复核（2026-09-06）

**40通过、0失败、0跳过，1suite，exit0。上述四类缺口在已冻结反例范围内关闭。** 使用上一节相同命令，无新增/修改测试、无生产代码修改。当前diff仍限selectResearchPrompt/classifyResearchIntent：前者保留换行到分类阶段；后者先移除材料引用/block quote再匹配词，保留显式采用的引号约束，offline配合明确localLookup时保留internal。已检查肯定联网、内部检索、无工具面不强加web回执及非generic显式契约不删除的固定对照全部通过。不据此宣称任意自然语言或超过16000字符范围均正确。

- 测试前后源码SHA256一致：`5130998f4d39577b2a53cc13cd342652b52e2d682cc6c9b7c9f41b75fd5df141`。
- 独占测试完整SHA256仍为`d422ba5990ae5df48d4b16e7e5655a7e8946091516fb825ab2d319066e734457`；原24项前缀仍为`1f7a578cf5bd521dd62213c746a915a6b55d2caf1d3e371908f666d242e81a28`。
- 既有8项测试SHA256仍为`23ecb45e12c316ef7d1fb9bf162fcb25ff39083725d5f6ee66cb61e4019e1680`。

证据版本分离：主线报告六题真实新run均REVIEW，但发生在本次最后边界修正之前，不能记作本hash的真实端到端复验；本轮确认的是当前源码固定40项离线回归（含冻结六题装配），实际运行模块的六题分类由主线核对。主线全check87570通过亦不在这里升级为本hash已全检。本轮未访问QA/API或重复真实运行。

GitNexus query仍FTS降级、context为lower-bound且无process，因此沿用当前diff/函数及固定测试的fallback证据；没有新增待修反例或继续措辞探索。本次复核到此冻结。
