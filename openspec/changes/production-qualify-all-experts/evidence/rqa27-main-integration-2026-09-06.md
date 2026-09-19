# RQA27 六专家新基线与反馈失效审计

日期：2026-09-06。总体目标仍 ACTIVE，新增生产合格专家 **0**。本轮是隔离环境真实基线、专业评审与缺陷定位，不是产品修复发布或正式 QA 放行。

## 本轮结果

冻结六题之前没有升级包或改变输入。六次真实 createStart；另对 KC 做一次独立诊断 retry，对 VD 通过实际主输入框提交一次明确反馈。原始六题归档保持不变。运行状态、专业内容、方法装配、交互分别判断。

| 专家 | 首轮运行 | 独立专业结果 | 后续证据 |
|---|---|---|---|
| 知识策展 KC | needs_input，责任人字段拦截 | N/A，原候选未保留 | D01 日期误匹配有完整候选/核验输入；不可替换原N01 |
| 长文编辑 LE | review，全文交付 | 7/7，但B1=1：无据补出“未安排对应测试” | 没有反馈轮，不合格 |
| 演示文稿 PW | review，全文交付 | 4/7，B1/B2/B3均1：工程周变日历两周、排他比较无据、部分非结论式标题 | 没有反馈轮，不合格 |
| 产品经理 PM | needs_input，日期字段拦截 | N/A，原候选未保留 | 不推测日期原句，不把平台阻断当专业造假 |
| 研究分析 RA | failed，无正式正文 | N/A | repair请求可见把“交付给产品负责人”误抽为负责人事实；末次不完整答复的响应原因尚未取证 |
| 视觉设计 VD | review，全文交付 | 7/7，B3=1：初次需确认但后续自动重生成边界未闭合 | F01真实v2仅3/6，B4=0，核心修改未落实 |

原基线三份可评18/21，另外21条N/A不入分母。这不是专家合格率。F01单列，不能用版本号、review或gate通过抵消反馈失败。新旧VD正文均43行，主要仅标题增加v2与引号格式变化；尺寸、重采样、自动重试规则仍在。没有实际越权生成或付费记录，问题是已交付文本违背合法反馈。

独立评分：[professional-grading](D:/aispace/knowme/openspec/changes/production-qualify-all-experts/evidence/rqa27-professional-grading.md)。
安装及实际装配审计：[package-assembly-review](D:/aispace/knowme/openspec/changes/production-qualify-all-experts/evidence/rqa27-package-assembly-review.md)。

## 三类已经分开的原因

### 方法包与实际使用不一致

六个 installed canonical 与 source 的执行/权限字段不同，五个 installed EXPERT 缺源码新增SOP，版本号却相同。不能把源码方法当作已安装基线。没有改用户日常安装，也没有在基线中途升级。

实际完整请求核对：LE/PW/PM/RA/VD未装配完整Skill L1正文；KC缺首请求，记U而非推断无正文。VD本身有完整专家SOP，不等于其Skill正文已加载。安装依赖required不等于execution.requiredSkills接线；不应把所有可用Skill不分任务强制塞入上下文。

纯分析输入禁止工具，但已安装permissions={}使请求仍能展示write_file等工具；本批没有实际调用回执。暴露不等于已经绕过执行审批，也不能写成权限已硬禁。后续候选需要版本化同步包、精确方法路由与明确权限，仍须实测专业效果。

### 通用证据核验的覆盖与语法问题

KC-D01实际候选“生效日期：2026-09-01”对应用户goal里C的“2026-09-01起生效”，但核验器收到的providedMaterials只有user-confirmation，没有该goal。task/run绑定和hash有效，不是旧run混入。

只读复现进一步证明：即便把原始goal完整加入内存来源，字段检测仍判unresolved；来源自然句与答复标签值不是同一语法。这说明仅加goal不是充分修复。不能把unresolved等同“用户没有提供”或“模型编造”，也不能因为日期字符串出现就随意借给另一文档。

RA的真实repair输入另显示话语角色错误：“一句话交付给产品负责人：”被当负责人任命。原KC-N01责任人候选依然没有，不借RA/D01推断其内容。

重现命令（没有改存储任务、gate或材料）：
```powershell
node -r ./scripts/register-ts.js openspec/changes/production-qualify-all-experts/evidence/rqa27-grounding-replay.cjs
```
exit0证明可重复定位两层缺陷，**不是修复测试通过**。原输入和内存补goal两者均blocked。

### 反馈已到模型，最终交付仍未落实

VD-F01的完整反馈确在同run当前请求中，完整4765字旧版也在修订prompt内；不能归因于“用户没发出去”或原文只被历史摘要截断。实际v2没有落实核心更正。第二请求为长度恢复，初次响应正文未捕获，故尚不能断言是首次模型忽略，还是恢复阶段复用了旧内容。

下一步应将反馈约束、初稿/恢复稿、最终交付的对照纳入同run取证，再修复实际失效环节。不能只在页面显示“修改意见已发送”或把旧文改版本号。

## 实际界面核对

1280×820真实Electron页面：完整VD正文在主对话、任务编号存在、一个主输入框、一个验收入口。退回修改只聚焦原框，不新增输入；实际主框发送F01后生成v2。刷新后经工作台重新打开，用户反馈、新版正文、唯一输入和验收入口保留。旧版正文/previousVersionId在持久化归档可追溯，未验证独立历史版本查看器。

初次点击被自动安全审核拒绝。只读查明ExpertTaskRoom.tsx:713–717仅设置本地编辑目标并focus、无API后，以同一UI动作重新审核获准；实际反馈发送也经审核允许。没有绕过拒绝或通过API暗中代发。

仍有体验缺口：纯对话方案末尾出现没有预览内容的通用“任务成果”文档卡，命名和冗余展示未解决；本轮只核对1280×820，没有1600×1000或发行包验收。未点击接受成果，没有本轮真实出图、裁切或付费。

[UI事实](D:/aispace/knowme/openspec/changes/production-qualify-all-experts/evidence/rqa27-ui-lifecycle.json) · [重开截图](D:/aispace/knowme/openspec/changes/production-qualify-all-experts/evidence/rqa27-vd-f01-reopened.png)。

## 证据与修改范围

- 6题及42断言先冻结；独立审查未发现阻止执行的矛盾。近似中文长度的口径保留，不能事后按Markdown raw长度设门槛。
- actual归档取自隔离task/session API，正文无损；请求与核验观察以gzip/base64转运，避免PTY换行污染JSON。请求观察不含响应正文，max_tokens被通用脱敏器隐藏，不能据此推断实际cap。
- 请求观察漏了KC首请求；已明确范围，不把FINALIZE当整run。两个临时透明观察器均已restore，QA PID40792。核验包装返回原结果，不改变gate。
- 本轮仅新增证据、只读重现脚本和未签字的acceptance checklist；未改src、测试或专家包，未提交。此前16个RQA26源码/测试hash再次核对一致；不是对全部传递模块的证明。
- GitNexus verifyClaims impact：LOW，1直接调用、2关联流程；仅用于观察路径定位，没有改该符号。整树detect_changes仍323文件/705符号/172affected，CRITICAL为共享既有大范围，不能归为本轮改动或声称已全审。git diff --check exit0，两个既有CRLF提示。
- 没有重跑本轮full check。RQA26的check51355是上一轮工程证据，不冒充本轮正式QA；本轮只读复现和实际模型/界面检查不能取代硬门禁。
- 按team-producer技能补齐acceptance.md并保持全部未签字；team-tester的正式门禁未满足，不宣称正式QA通过。

## 当前全体覆盖与下一步

隔离profile共84任务、20种专家ID有记录（原14+本轮6），不是20位合格。仍无记录的4位：office-partner、external-capability-importer、artbundle-expert、ui-expert；它们的安装/能力边界和正常异常流程仍须验证。此前14位的未决专业缺陷也不因新覆盖消失。

优先续作：
1. 基于本轮原候选修复当前用户材料覆盖、来源/断言语义角色边界；保留错文档同日期、真实责任人/收件标题、跨run旧材料、失败工具和执行凭据的反例。不要堆专家ID例外或直接关闭核验。
2. 追踪VD修订初次响应与长度恢复的约束保持，修复后原反馈重验、再用新反馈题验证。旧v2失败不覆盖。
3. 版本化同步包与适配职责的方法、显式L1接线、任务级权限；同条件旧新+保留题检查专业改善，不仅加长Skill。
4. 完成剩余4位及全体专业留出题、异常恢复、反馈、重开、媒体/知识库/飞书适用路由、发行环境验收。

总体目标不变，未完成，也不存在必须停止所有安全工作的外部阻塞。

