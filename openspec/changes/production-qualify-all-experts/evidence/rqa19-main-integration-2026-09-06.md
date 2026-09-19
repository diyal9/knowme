# RQA19：通用执行阻塞与专家专业能力分开验收

2026-09-06。阶段进展，不是24专家目标完成。新增真实基线为内容策划、创意策划、数据分析三位专家各一正常题、一困难题；没有新增专家获得生产资格。本轮不修改专家包或Skill，不以运行时修复冒充专业方法升级。

## 已修复的通用问题

1. `src/renderer/features/expert/ExpertTaskRoom.tsx`的provideInput原先把返回task当作成功，即使ok=false也清空正文；附件未转成后端接收的materials。现在仅ok=true且taskId对应才消费本次提交，失败保留正文/附件并提示；在途新草稿、同名新附件版本和切换房间不被旧响应消费。支持仅附件提交和同任务单个在途请求。reroute快捷动作不消费主输入框草稿。未改变后台权限、执行门槛或排队规则。
2. `src/lib/research-routing.ts`原先将“当前”与“公告/发布”等跨句组合当实时研究，忽略明确不联网，工具面有search_web便制造必需回执。现在保留有界完整委托及行界，区分固定范围内的来源引文、明确采用的约束与编辑对象；禁外网不取消明确本地知识库检索。仅修正generic研究路由，不删除独立声明的执行契约，不按专家ID整体豁免，也不放松工具回执与真实成果门禁。

路由仍是16000字符内的有限启发式，不是通用自然语言理解或授权边界。后续结构化任务意图/材料/约束契约仍有价值，不能声称本补丁彻底解决任意表述。

## 测试与实际客户端

- provideInput独立冻结7项在旧源2绿5红；补丁后7项＋新增7项边界＋既有专家房65项，共79绿。使用真实组件和store、mock preload API；不冒充真实附件落盘验收。见两份provide-input报告。
- 研究路由冻结24项旧源7绿17红；原8项始终绿。首补丁32绿后独立追加8项发现5红，按固定反例修正，最终40/40绿，未修改已有断言。详见research-routing-review报告，保留红测历史。
- 最终`npm run check`会话72180 exit0：backend总2926，2875通过，51既有跳过，0失败；renderer82文件574通过；lint/typecheck通过。ExpertTaskRoom.tsx及既有spec存在1200行软预算警告，未隐瞒或借此拆改共享历史代码。早期87570绿是中间版本，不替代最终检查。
- 实际隔离Electron的DA-H02处于needs_input/retry；在唯一主输入框输入“RQA19真实拒绝回归：这份草稿应当保留”并点击发送，出现“当前不缺任务信息，请直接重新执行”提示，正文完整保留。截图`rqa19-live-rejected-draft.png`已主线目视核查。没有为了测试把后台拒绝改成成功，也没有误启动模型。
- 六题真实retry后刷新并从工作台重开DA-N01，完整正文、待验收动作及唯一主输入框都存在。截图`rqa19-live-review-reopened.png`已目视核查；长正文仍需滚动到按钮，不据此证明所有尺寸/媒体或完整生命周期合格。

## 真实任务与版本分离

冻结案例`rqa19-professional-cases.json` SHA256 `cb8480da61af0485ff7ab0ab979b6ec779ffa0f65580a1a68671124d6350ac32`。仅goal、request、材料和共同约束进入任务，不发送五项标准或critical答案。全为合成材料，允许当前授权的纯计算，不要求外部工具。直接调用已确认任务API测试执行，不冒充UI澄清/确认流程测试。

| 案例 | 实际任务ID | 已安装基线 | 同任务路由修复后重试 |
|---|---|---|---|
| CS-N01 | task-mtp8aibr-w1rk8 | needs_input | review |
| CS-H02 | task-mtp8aj6w-5z3xb | needs_input | review |
| CD-N01 | task-mtp8cvb0-siq2z | needs_input | review |
| CD-H02 | task-mtp8cw5t-yuns6 | needs_input | review |
| DA-N01 | task-mtp8dxw9-dpdlg | needs_input | review |
| DA-H02 | task-mtp8dyem-r587w | needs_input | review |

原始文件分别为`rqa19-baseline-live-2026-09-06.json`与`rqa19-post-routing-live-2026-09-06.json`。相同已安装2.0.0包、输入、材料和qwen3.8-flash，重试保留原任务历史；不是全新独立A/B，更不是Skill升级因果实验。基线12次校验候选对应6任务，不写成12任务；重试6次候选各绑定新的run。只读有界observer记录verifyClaims原参数/返回，不改变返回或门禁，导出后恢复原函数。

基线六题都缺search_web等generic证据，其中DA-N01还有其它结论违规；实际用户只有fallback，专业交付N/A。DA-H02出现create_artifact成功记录，不能写六题零工具/零动作。重试数据题使用了工具，具体以保存回执为准；全篇专业真实性不能由verification.passed推导。该门禁metadata明确scope为execution_receipts_and_labelled_fields_not_semantic_truth。

重试实际工具链进一步核对：DA-N01尝试list_dir(path='.')被拒绝，随后两次create_artifact写入算式文本；DA-H02一次create_artifact写入人工核算文本。它们不是计算引擎执行证明，create_artifact回执不能证明算式计算正确。列目录尝试与仅使用已给材料约束不一致，虽然没有成功读取目录，也必须记作专家工具选择/约束遵守缺口。前三类工具调用均保存在post JSON的verifierCaptures.args.toolLedger.calls，不能用最终review状态掩盖。

六次真实重试发生在最后引文/本地检索边界修正前。最后补丁后仅重启自有QA、调用真实主进程模块核对同六份实际输入，全部inactive；后台六个review状态仍持久保留。`rqa19-final-runtime-probe-2026-09-06.json`保存精确源码hash、隔离userData和结果。这不是最后hash重新六次模型执行，不混淆证据版本。

## 专业能力与装配的真实缺口

按同一冻结标准独立复核最后基线候选：CS 4/5、2/5；CD 4/5、2/5；DA 3/5、4/5。实际fallback交付全部N/A。局部分数不能掩盖全文硬伤：擅自规定候补/先到先得，把最多带三包与新人领一包合成“三包换一包”，事件行数/分母错误，以及等于阈值却被写成高于的计算错误。完整证据见`rqa19-baseline-professional-review.md`。评审者是案例作者、非盲，不是保留集认证。

同run上下文审计还证实：六轮skillRefs=[]、无skill.explicit-content，也没有load_skill调用；CS/CD分别有L0摘要228/413字符，DA无Skill块；实际SOP装配92/105/88字符。installed、session bindings与日志对应，但“依赖ready”不等于完整方法已加载。不能说所有Skill上下文都丢失，也不能仅凭此归因每项专业错误。见`rqa19-baseline-context-audit-2026-09-06.md`。

主线已逐份读取重试后的六份完整候选，随后核对独立30断言全文评分。可直接确认：CS-H02报名正文擅自增加“老师用30分钟”和候补机制；CS-N01把访问未提交直接归因“不知道怎么动”；DA-N01先断言重复上报，后又要求核对是否真实重复操作，自身依据不一致。文本及工具问题足以不予完整专业放行。按与基线一致的Han字+连续英数块（去行首列表序号）计算，六份正文依次843、1025、986、850、968、778，前五份超过500–800预算。预算与专业断言分开记录，不为取得漂亮分数删正文。

独立post报告`rqa19-post-professional-review.md`已完成并由主线全文读取：CS为3/5、1/5；CD为4/5、5/5；DA为4/5、0/5。DA-H02的合取项包含正文漏报10行及72/90/102总数，因此0/5绝不代表均值全错；其主要均值正确，但可比性推论和未知值核验仍有问题。CD-H02五项通过也不覆盖所有分镜时间歧义、文字计数与动态实测，且超字数。量规局限、全文额外问题、真实工具违规尝试与正文呈现完整性均单列；不以总分代替解释，不以单次5/5发生产资格。

源码包另有data-analyst E/C未绑定而legacy列出方法、visual-brief版本声明分裂等问题，详见`rqa19-three-expert-package-review.md`。这些尚未在本轮改包；避免把源码方法当成已安装、已装配、已遵循。

## 后续必须继续，而非勾选完成

1. 本批重试专业评分已完成，继续按“结果可用”“方法正确”“异常可恢复”区分问题，并改进下一批量规使呈现漏项与严重计算/推理错误分别可见；不修改本次冻结评分或只看关键词、格式、单题高分。
2. 按缺口补齐三专家的核心专业方法及通用route/requiredSkills声明，同步包版本；辅助润色/生图交接只在对应阶段使用，不把专家特性硬编码到KnowMe。
3. 验证安装升级、同run L1装配及真实使用，再进行同条件旧/新对照和未暴露新题，检验错误是否减少，而非仅测Skill字数。
4. 继续全集24专家的正常、缺资料、错误、重试、修订、重开，以及真实媒体、跨专家材料引用与飞书授权边界。生图端到端和所有专家专业资格仍未完成。

## 变更范围与安全

影响分析已在修改前执行：provideInput LOW（3个直接调用者、4个关联符号），ExpertTaskRoom动态组件调用UNKNOWN并手读TaskRoomHost；selectResearchPrompt LOW，classifyResearchIntent CRITICAL（6直接调用者、13关联），主线已告知风险后按通用边界修改。未改调用签名，定向/全量覆盖相关装配调用。GitNexus索引过旧、FTS降级，结果不作完整安全证明。

最终detect_changes(all)：310文件、585符号、160受影响流程、CRITICAL，包含大量既有/并行共享脏改动，不代表本轮新增或全部审完。当前主线生产改动仅上述两文件相关逻辑，未覆盖既有变更、未commit/reset，未修改用户日常APPDATA。只重启自有9223隔离QA，未运行npm start/kill/renderer:build。

最终源码SHA256：research-routing `5130998f4d39577b2a53cc13cd342652b52e2d682cc6c9b7c9f41b75fd5df141`；ExpertTaskRoom `64514f96dfaae0ea6d154d83203bd9052c4240948e4be52ca21e85aadb80668c`。目标保持ACTIVE，无新增专家生产资格。
