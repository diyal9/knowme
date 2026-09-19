# FC冻结六份评分与绑定修复（2026-09-06）

## 结论与样本边界

3种独立冻结countercase（FC01/02/03）×2配置=6份输出，不是6个独立反例。另有1份FC01实际UI revision变体，仅附评，不混入六份评分，不扩算为独立冻结案例。
六份均未满足全部冻结契约，不能总资格放行；即使单次通过也不是专家生产认证。历史baseline不是同时重跑，版本及方法装配不同，不能独立归因于Skill。

| 案例 | baseline | candidate | 专业hardfail及合格边界 |
|---|---:|---:|---|
| FC01 | 3/5 | 3/5 | 两份hardfail。主表能区分邀请/激活/活跃、转载和98%缺证据，但独立修正文扩大来源范围、状态时点及问卷/全部数据范围，不能直接发布。 |
| FC02 | 3/5 | 3/5 | 两份未发现事实性hardfail。版本、资格、美元优惠券条件正确；缺B第2条定位及独立修正文2026-05-12基准日，属冻结交付契约未满足。candidate原3/5复核不变。 |
| FC03 | 2/5 | 3/5 | 两份hardfail。baseline虚构数据整理/未来公布，并把5月1日待定状态推向当前；candidate虚构正在评估，并将缺CEO身份信息作确定否定；“正式上线以官方公告为准”可作建议，不单独作为虚假事实硬伤。原型/效果缺证据/因果有合格部分，仍不可发布。 |

FC03第2条不能只检查原话出现。baseline的“引语归属错误+无法确认”没有拆明身份未知和文本内容不符，因此未通过精确归属核查；这里不夸大其含混措辞为明确断言“此人不是CEO”。candidate则单独将“客户CEO说”标为错误并说“归属与内容均不符”，确有举证边界错误。缺CEO信息不证明非CEO。

## 绑定修复审计

主线导出按数组位置绑定错误：candidate FC01/FC03互换，baseline FC02/FC03互换。此为测试材料错误，不是模型答非所问。按主代理在用户评估任务范围内授权并提供的task ID重新绑定；未编辑模型正文、冻结输入/expectations或原始evidence JSON。

审计文件 binding-repair-audit-2026-09-06.json 保存旧→新引用、原始SHA-256及4份错误transcript完整快照。六份均核验：
- receipt.id、artifact.meta.taskId/runId、transcript task ID及configuration一致；
- transcript Input逐字对应冻结prompt；Answer对应独立answer及receipt artifact body；
- 12份answer/receipt哈希均与修复前正确来源完全一致；
- 3份eval_metadata哈希不变；人工复核案例输入语义对应。
全部通过。此前FC01 baseline和FC02 candidate绑定正确，重核后均仍3/5。

## 长度与回执边界

使用去Markdown结构后的CJK逐字+连续alnum词块heuristic，另报Unicode标点数。不把raw Markdown长度当中文超字数，不虚填token/耗时。

| 配置 | CJK+alnum | 加标点 | 上限 |
|---|---:|---:|---:|
| FC01/baseline | 538 | 670 | 600 |
| FC01/candidate | 520 | 629 | 600 |
| FC02/baseline | 186 | 228 | 350 |
| FC02/candidate | 239 | 282 | 350 |
| FC03/baseline | 258 | 319 | 300 |
| FC03/candidate | 288 | 362 | 300 |

FC01/FC03两个口径跨阈值，故本轮失败不依赖长度；FC02两个口径均低于350。
所有提交回执 tools/toolsUsed/applyLog为空，未见外部动作；这是提交证据边界，不把平台“输出验证通过”当专业认证。无metrics/timing/user_notes文件，评分未伪造这些执行信息。

## 单独附评：UI factRevision（不计入冻结评分）

原始来源：evidence/professional-batch2-live.json 的 factRevision；成果ID deliverable_expert_task-mtormlqz-57xyt_mtos4clg_output-1。
E新正文独立采访两位受邀用户，能够修正“全部转载”，但没有测量活跃人数或满意率，不能把独立采访等同于原数值主张得到验证。
修正文“项目于2026年8月1日进入内测”把公告日期当进入内测的事件起点，证据未给；这不是证明起点必错，而是不能确认起点。
“各来源均未测量活跃人数或满意率”又扩大了原文可证明范围。
长度：CJK361、alnum52，合计413；含标点485，raw Markdown626。即使只计CJK也超过350，此处确可判超长。
该revision不改变冻结六份分数，也不能解除整体不放行结论。

## Viewer与文件清单

请main用已修复六份材料和各grading.json统一重新生成fact-review.html；现有viewer在重生成前可能仍显示旧绑定/旧分数。本轮未改viewer生成器。

本轮评分/绑定文件（相对iteration-2）：
- FC01/candidate/transcript.md
- FC01/candidate/outputs/answer.md
- FC01/candidate/outputs/receipts.json
- FC02/baseline/transcript.md
- FC02/baseline/outputs/answer.md
- FC02/baseline/outputs/receipts.json
- FC03/baseline/transcript.md
- FC03/baseline/outputs/answer.md
- FC03/baseline/outputs/receipts.json
- FC03/candidate/transcript.md
- FC03/candidate/outputs/answer.md
- FC03/candidate/outputs/receipts.json
- FC01/baseline/grading.json
- FC01/candidate/grading.json
- FC02/baseline/grading.json
- FC02/candidate/grading.json
- FC03/baseline/grading.json
- FC03/candidate/grading.json
- binding-repair-audit-2026-09-06.json
- professional-grading-review-2026-09-06.md

另新增独立只读诊断证据：evidence/rqa04-cached-pango-2026-09-06.md。
本轮不改src、测试源码、APPDATA/QA环境、不调用真实API、不跑fullcheck、不commit。skill-creator/grader要求促使评分覆盖断言外修正文错误，并区分形式契约与专业hardfail。
