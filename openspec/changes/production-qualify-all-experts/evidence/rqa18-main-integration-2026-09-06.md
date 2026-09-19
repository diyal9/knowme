# RQA18：通用引用边界与专业语义复核实验

## 结论

本轮推进了生产引用核验及研究用语义复核，不代表专家模块或24专家资格完成。没有新增专家获生产资格，没有接受原SA任务成果，也未把研究reviewer接入产品放行。

平台必须区分来源身份、材料支持、分析推导和真实操作回执；专家包负责专业方法。增加Skill数量或返回长答复都不能证明专家能力。当前真实SA候选仍有专业硬伤，且泛化分析结论误分类尚未获得可上线的解决方案。

## 生产变更

- `agent-source-citations.ts`：复用已安装marked解析Markdown，识别正文中的平台来源ID；代码字面量、链接、图片、链接定义不是引用。防止代码中的伪定义使真实引用消失；HTML可见正文继续核查。
- `agent-claim-source-check.ts`：字段提取保留全文链接定义语境，链接URL中的ID不作为字段归属；显式混合有效/无效来源不得借有效来源洗白。字段值中的代码拼写保留，反引号不能让伪负责人消失。
- `agent-grounding-ledger.ts`、`agent-grounding-labels.ts`：全文未知引用有独立拒绝原因与安全用户文案。来源ID对应成功只证明身份，不证明结论正确，更不是执行回执。
- 未放宽requiredTools、requiredEvidence、完成声明、来源匹配或成果真实性门禁；未为生图或架构Agent添加特殊通行规则。
- executor后处理测试原用裸`[post]`充当标记，与平台引用语法冲突。本轮将夹具标记写为Markdown代码字面量；原`includes('[post]')`、提交与阶段断言保留，无运行时白名单。

有限字段匹配仍不是自然语言蕴含判定；HTML提取也不构成任意HTML语义安全证明。发行包asar中依赖内部UMD可读性尚未验证。

## 红绿测试与工程检查

独立测试原样保留：32项边界测试初始17过/15失败；30项对抗测试初始19过/11失败；22项全文语境测试初始12过/10失败。后续修复转绿，历史红测报告不覆盖或伪装为最终版本报告。

研究packet协议独立85项初始72过/13失败，修复packet内容绑定、重复JSON成员、稀疏数组后85绿，追加10项后95绿。严格解析只证明结构/绑定有效，不认证语义。

初次主线组合292项通过后，独立新增代码字段32项实际23过/9失败：HTML pre/code字段丢失、内联标签插入空格或字段漏识别。修改HTML解析保留内联字符、块级边界和跨token字面量状态，并将includeCode传到HTML路径后，原样32项转绿，主线合并324项通过。历史红测另见`rqa18-code-field-final-review-2026-09-06.md`，不覆盖历史结论。

随后新增局部HTML范围16项实际15过/1失败：关闭code标签位于下一段容器时，跳过容器会漏掉关闭标签及其后真实引用。改为仅抑制叶节点、仍遍历容器后，主线合并340项全绿；独立原样复跑冻结132项（32+30+22+32+16）全绿、0跳过、文件hash未变。

最终完整`npm run check` session23445 exit0：backend 2894项（2843过、51既有跳过、0失败）、lint、renderer 80文件560项、renderer typecheck通过。该次检查晚于最后生产修正，取代之前session5301/15403通过的中间快照。更早session67790因上述`[post]`夹具1项失败，不能将其记作通过。最终工程通过不等于专业资格通过。

## 当前源码的隔离Electron验证

仅关闭并重启本轮自有QA Electron，未重启日常应用或编辑用户APPDATA。冷启动使用Electron31.7.7 / Node20.18.0，userData为`D:/USERCA~1/Temp/knowme-expert-qualification-e3808573825e42908aef0a0f2d0f20de`，CDP9223。

依赖路径为`D:/aispace/knowme/node_modules/marked/package.json`和`lib/marked.umd.js`。在冷启动主进程加载真实ledger及材料快照，以固定R1材料运行六项受控探针：真实owner通过；伪owner拒绝；混合R1/MISSING拒绝；合法全文reference link加真实owner通过；HTML正文MISSING拒绝；反引号伪owner拒绝。

HTML字段修正后再次冷启动同一自有QA，补六项真实模块探针：内联标签姓名/日期均保持原值并通过；pre/code伪owner、冒号内联标签伪owner均保留字段并拒绝；HTML行内code内ID忽略，code外混合R1/MISSING仍拒绝。最后跨段落修正后，仅在自有QA清除citation/claim-source/ledger三模块缓存并重载，实际探针正确保留并拒绝MISSING，未发模型请求。最终helper SHA256为`4E98FED766296028329CD88321B08E47420E81C48351A605DFED27C9A29DE2C2`；不把这次指定模块重载称为最后版本的整应用冷启动。

这是实际Electron中的真实核验模块检查，不是新的专家任务、模型交付或生图UI验收。QA冷启动回到伙伴首页，不能据此声称原任务重开UI已复验。

## 12次真实语义复核实验

研究脚本`scripts/qa-claim-review.js`不被产品导入。主机绑定完整候选、runId、材料和精确声明位置，要求reviewer按固定JSON协议返回类别、支持度、原文锚点与理由。host保留原packet；hash不是签名，不接受模型自行替换packet作为原任务依据。

通过隔离QA真实Qwen3.8Flash完成12次无工具调用、单次采样、不重试：10个冻结合成案例17个选定声明，加两份既有真实SA候选各2个选定声明，共21项。全部stop且结构可解析，31个锚点均精确命中材料；这不是21项判断全部正确。实际输入未包含冻结预期。SA全文作为上下文提供，但仅审指定声明，未测自主发现全部错误。

另行逐项核对发现：

- 能识别部分无据批准、并发幂等保证及全称推断错误。
- 有把证据缺失说成直接矛盾的理由错误。
- 一项理由明确反驳全称判断，但支持标签仍写uncertain。
- 一项数学正确但引用缺失，输出将数学支持与引用完整性混为一项。
- SA回复部分宽泛结论可支持，但理由仍混淆队列排空时间和单事件延迟；其余专业错误不在选定范围内。

所以不能将supported直接接入自动放行，不能重新认证两份SA全文，也不能声称专家方法已改善。审查者与部分案例/方法作者重叠、非盲、无重复采样；具体披露见独立报告。范围内后续实验已有用户目标授权，但须新冻结版本及独立证据。

实际调用使用当时helper版本，之后只加强host解析守卫；最终helper离线重解析12份原始响应全部有效且与原保存结果一致，无额外模型调用。

## 证据和影响边界

- 原始调用：`rqa18-semantic-review-live-2026-09-06.json`，SHA256 `F7B859D444ACD80C824D9061D66BA0366C84A813D50127D2CFF16A19B7C5A4F8`。
- 冻结案例：`rqa18-semantic-review-cases.json`，SHA256 `2B512BADD1366FF210D0B5A3DC7A940134017E6C2F86E4BF04F0EC8880BE8D79`。
- 独立报告：`rqa18-claim-boundaries-review-2026-09-06.md`、`rqa18-citation-adversarial-review-2026-09-06.md`、`rqa18-parser-context-review-2026-09-06.md`、`rqa18-review-packet-review-2026-09-06.md`、`rqa18-semantic-shadow-review-2026-09-06.md`。

GitNexus影响分析先于符号修改：verifyClaims、refusal、用户label已有图关系为LOW；新helper/labelledClaims索引未找到，按UNKNOWN并补当前源码调用检查，不解释为零影响。query的FTS未加载，不能代替当前源码复核。最终detect_changes整共享脏树309文件/584符号/160受影响、CRITICAL，含大量既有并行修改，不是本轮范围全审完；没有提交或清理共享修改。

下一步：将内容推导与引用身份分轴评估，验证未预选的混合声明与未知案例；继续真实专家正常/异常任务、专业方法改进和对照验收。全部24专家、媒体与生命周期体验、安装升级/发行验证仍未完成，目标保持ACTIVE。
