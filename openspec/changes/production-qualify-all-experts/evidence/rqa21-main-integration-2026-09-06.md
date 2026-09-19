# RQA21 — 通用占位引用修复与真实专业复核

日期：2026-09-06。总体目标仍 ACTIVE；无新增生产合格专家。本轮没有修改任何专家 Skill，也不是新的 Skill A/B。

## 结果

- 修复通用来源解析把未注册的 [____]、[---]、[...] 等模板空位误作引用；注册的纯标点 ID 仍有精确身份，未知含字母数字引用仍拒绝。
- 独立复审发现并关闭两处新增 P1：强调格式漏检字段/未知引用；__R1__ 错绑 R1 借用证据。候选、材料和引用扫描现在共享实际来源 registry，注册原样 ID 优先，不把注册等同于内容支持。
- 独立冻结测试 37+24+22，加原 RQA18 132 条，合计215/215通过。原37条先18过/19失败；最初脚注 oracle 纠正发生在最终冻结前，已披露。新增24/22条首次执行已是修正代码，没有虚称历史红测。
- 最终完整 npm run check（95959）exit0：backend 3270总/3219通过/0失败/51既有跳过；renderer 85文件597通过；lint/typecheck通过。行数软警告仍在。详见 rqa21-final-check-summary.json。

## 变更与风险边界

仅主线本轮源码：agent-source-citations.ts、agent-claim-source-check.ts、agent-grounding-ledger.ts。其他工作树修改属于共享/并行工作，未覆盖、提交或清理。

所有修改符号先执行 GitNexus impact；markdownCitationProse、explicitSourceIds、labelledClaims、checkProvidedFieldClaims为HIGH，normalizeField/verifyClaims另有已记录影响，修改前均已告知。直接依赖覆盖字段提取、来源检查及runGroundAndPersist/run路径。query的FTS降级与process资源缺失由源码/调用方及确定性测试补证，不把空查询当安全。

最终detect_changes(all)：320文件、699符号、172 affected，CRITICAL。此为整个共享脏工作树，绝非本轮三个文件的完整安全认证；没有commit。最终三个源码hash与独立审查一致：

| 文件 | SHA256 |
| --- | --- |
| agent-source-citations.ts | 72f909d6d8e075bd8d43dfcb68fccbec98d2b5087e39723d785b6e1db8ff3879 |
| agent-claim-source-check.ts | b19b2f9da8bf6405fab8761e0ee1f3c47748763fd92676a5bfa1645f8fef9072 |
| agent-grounding-ledger.ts | 47cfa41709027adcf1652de22b145995e24ccdfda2312d397c4bafa3d24697f1 |

字段核对仍是有限的标记字段/片段匹配，不是语义或算术认证。HTML字面量空拼接等既有限制保留在独立报告，不扩大宣称“所有Markdown语法安全”。

## 实际任务重试与UI

自有隔离Electron profile：D:/UserCaches/Temp/knowme-expert-qualification-e3808573825e42908aef0a0f2d0f20de；仅关闭并重启自有QA实例加载初版补丁，未动日常APPDATA或用户9222。新实际主进程34544。检查67任务没有执行中任务后才重启。

任务 task-mtpb1w1s-2bozl，RQA20-new-R20-CD-H02。真实UI点击“重新执行”一次，needs_input→running→review；run expert_task-mtpb1w1s-2bozl_mtpdvcp5。观察器仅同步记录verifyClaims入参和原返回值，未替换判定，已恢复。

真实新正文1465原始字符，SHA b972ca9a9a2f4e5c9f69e268159f8a7a6f8656798d0c7bed68ff253b1bf3727d，包含两个票号 [____]。原1260字符候选SHA 0278d0b578a2db795144468cf2ca37ec13b2f5d8d155c8c9679df585920fa12c，不与新正文混淆。

时间/版本限定：模型重试发生在初版引用补丁f241d44b，之后独立复审引发上述两次格式修正。最终72f909d6源码在新Node进程中重放原候选及新正文均通过；新正文附加[MISSING_SOURCE]正确拒绝。没有冒称最后源码又跑了一次模型或当前QA已加载最后源码。

实际刷新后通过工作台→专家协作重新打开同任务，完整新正文及 [____]保留，唯一主输入框和验收入口可见。点击“退回修改”后textarea仍1个且聚焦，任务仍review。未接受成果、未发送修改要求、未跑修改生成闭环。截图：
- rqa21-citation-retry-review.png
- rqa21-citation-reopen-composer.png

视觉限制：该轮为文字交付，不验证图片/视频预览。表格单元格内<br>在当前UI显示为字面量，尚未修复；输入JSON作为本轮合成题目标可见，不代表日常自然语言目标都呈JSON。旧失败摘要仍在session历史，不伪称已清理所有历史状态。

## 专业复核：能返回 ≠ 专家合格

沿用skill-creator的原文/冻结断言/独立评分/官方查看器流程；原RQA20十二条原文、旧评分及benchmark不改。本次同任务重试6/7，不是新旧方法提升证据。

通过：两种实质概念、固定两联结构、各联独立必需信息、准确单次权益、具体布局、授权边界。失败E5：纸样验证没有安排工作人员独立用存根读出场次/票号；前面使用场景不能补成实际测试步骤。

全文另有：三层网格与左右撕开“各持一层”缺少几何对应；方案A效率下降未经验证却说成确定结论；mixed1046，超过700—1000预算46。没有把未来打印/拍照当实际调用，也没有把灰色字武断判成第三油墨。当前run零工具调用符合题目，未使用calculate不是扣分项。

独立报告：rqa21-citation-retry-grading.md/json。官方单次查看器：
../skill-evals/rqa21-citation-retry-workspace/review.html
本次只有一次runtime retry，不计算虚假的成对benchmark或补零token指标。查看器通过python -X utf8生成；默认Windows GBK首次失败已修正，仅运行参数变化。已请求在Codex打开（queued）。

## 尚未关闭的核心质量问题

rqa21-analysis-repair-review.md已核实RQA20数据分析：初稿40%/−10pp在修复轮变成42%/−8pp而过gate。有限“结论”字段规则混淆内部推导与外部事实；FINALIZE不携带定向诊断/候选和已核验数值约束。此轮未修复，不把引用修复当作算术/语义质量提升。后续需区分事实、推导、行动证据，定向修复并独立复算，不能简单豁免所有“结论”或锁死未经验证的初稿数字。

此前check29773有6项失败，96777有3项；最终95959已绿。期间共享model-loop新增空surface访问已变为可选链；connector-runtime测试已改为先加载schema再执行并核对生命周期。它们不是主线本轮引用源码修改的功劳，历史失败及诊断保留，不改测试掩盖失败。本次检查通过只绑定当时共享状态。

后续继续专业方法的有辨别力评估、数据推导修复保护、所有专家正常/异常/重试/修改/重开、媒体与安装升级验收。未完成24专家全集，不标记goal complete。

