# RQA26：四次实际交付的有限比较

2026-09-06。比较actual-installed旧整包3.2.0与候选整包3.4.0；不是盲测或纯Skill A/B。评分者是冻结两题/标准作者、非候选包作者，已看RQA24和主线反馈。四份grading均保留原id/text/category，以完整session最终正文、真实provider参数、基图hash、独立解码/看图及同run模型视觉输入评分；没有新增断言或调用模型。

## 结果：未证明核心专业能力改善

| 实际交付 | task | 冻结分数 | 完整正文 | 已确认critical |
|---|---|---:|---|---|
| old3.2 R01-D2 | task-mtpluo03-l436a | 8/9；仅E8失败 | 253字符，5句 | 无 |
| candidate3.4 R01 | task-mtpllbgi-sw9ph | 9/9 | 263字符，3句 | 无 |
| old3.2 H02 | task-mtpmaqln-tf3ct | 8/9；仅E8失败 | 336字符，4句 | 无 |
| candidate3.4 H02 | task-mtpmgiwr-ceqif | 9/9 | 252字符，3句 | 无 |

字符为原session正文UTF-16长度，不是新设字数阈值。E8按冻结约两三句的简洁交付要求判断；旧两题分别展开成五句/四句，其余内容不判长表或假交付。这个轻微呈现分差必须单列：**R01旧文反而比候选少10字符**，不能凭句数宣称候选更高效或专业更好；“约”的呈现判断本身也有评审边界。

按类别：visual_target、visual_invariants、prompt_scope、reference_provenance、execution_authorization、actual_dimensions、metadata_truthfulness、vision_process均为每格1/1，即四次合计32/32；concise_delivery为旧0/2、候选2/2。形式合计旧16/18、候选18/18（四格34/36），**不定义生产资格阈值，也不把呈现分差包装成核心专业能力或因果提升**。每项均可评，无N/E；首次框架blocked不进入该分母。

四张图均实际896×1200PNG，基图均为同一896×1200JPEG、SHA256 `6c8124d9d8735d9b3133e402172fe7096fd3e52a9bbe474c90394aa86582ff33`。R01均为哑光黑杯身+银盖；H02均为暖灰背景+整只银色金属杯。没有发现冻结范围下确定性的产品越界、错误基图、虚构生成或额外付费重试。

## 必须保留的原blocked与真实顺序

实际先后（UTC，按首个语言模型请求）：

1. **08:56:30.790 old3.2 R01首次**：task `task-mtpkut6w-6cluf`，run `expert_task-mtpkut6w-6cluf_mtpkuxml`。两次语言模型请求，生成工具被未登记参考图阻塞，无付费图片请求、无图，保留framework-blocked/N/A，不记0/9。
2. **09:17:05.588 candidate R01**：付费请求09:17:13.771；task `task-mtpllbgi-sw9ph`。冷启自动升级后实际snapshot=3.4.0、agentHash=`b0845055f7a7dc03`。observer仍写old-R01-D1是标签错误，归档labelCorrection明确纠正，不能作为旧3.2成果。
3. **09:24:21.282 old3.2 R01-D2**：恢复冻结旧包后新的task/run，实际snapshot3.2.0、agentHash=`dcf7730df6be94b0`。这个额外诊断重试不能擦掉第1次失败，也不能伪称原计划未发生阻塞。
4. **09:36:51.403 old3.2 H02**：实际snapshot3.2.0。
5. **09:41:21.332 candidate3.4 H02**：实际snapshot3.4.0；主线报告正常capabilityUpdate安装。本评审只看归档snapshot，未访问profile或复做安装。

因此本阶段是**5个实际任务尝试，4次付费参考生成/4张可评图，另1个框架blocked N/A**，不是原计划顺序的无偏四格。四个可评run都是gpt-image-2/n=1/quality=auto/size896x1200、同基图；助手请求model均qwen3.8-flash。candidate R01多一次非付费catalog查询（3次语言模型请求），其他三格仅一次generate_image（各2次语言模型请求）。所有已捕获图像生成恰一次，无provider重试。

## 全文与范围细节

- R01底环两张都黑。冻结原题只把杯盖颜色明确列为银色保留项，底部环没有单独保银标准，且杯身允许改黑；不追加“底环黑即越界”。旧文将此提为待确认，候选称“自然联动”。变化可见，但候选prompt主动要求底环随杯身改色，“自然联动”并无技术必然性证明。两种表述都不能替代用户未来对独立保留对象的明确约束。
- H02的微暖灰不要求唯一HEX，金属反射/高光轻微变化允许；不要求像素恒等。旧文承认用户色温偏好/逐像素细节未确认，不据此判实际编辑失败。候选的阴影强弱调整建议未执行；若后续执行将需要用户新确认，不能自动继承本次一次付费授权。
- old H02的task.resultSummary仅280字符，而session完整正文336字符，摘要停在“杯身边”后仍有56字符真实正文；不是模型length/未完成，不把摘要截断混入专业评分。其他三题task摘要与完整session答复相同。
- 四次末轮模型请求都含冻结基图和对应返回图、decoded-file真实回执；E9有直接视觉输入证据，不再是RQA24的观察器缺口。它证明可见，不证明模型完成穷尽检查。candidate两次的最后输入另有“交付契约已由运行时确认满足…简洁交付”收尾指令，旧两次以返回图证据结束，进一步限制纯SOP归因。

## 无损证据与方法装配

四个可评成果与原blocked的无损归档均验证SHA256(JSON.stringify(data))=export.sha256。对被冻结外链三Skill body，不trim、不清空格，在真实模型messages中逐字exactIncludes：blocked 2请求×3=6/6；candidate R01 3×3=9/9；old R01-D2 2×3=6/6；old H02 2×3=6/6；candidate H02 2×3=6/6。

原plain PTY导出的空格差异不代表方法缺失，无损归档来自内存原对象，而不是删空格修旧文件。完整SKILL.md可见不证明其引用的persona/templates/registry/enrich-rules/pango-aigc等额外文件全文已读，更不证明方法每步被遵循。详见rqa26-method-assembly-audit.md的顶部及末尾更新。

| 证据文件 | SHA256(JSON.stringify(data)) |
|---|---|
| rqa26-actual-runs-lossless.json（blocked及candidate R01） | 9a91d7096875a6431dcaeffea4d2c07b5b4d4271c02f5a5fcd9f16b0c44fb2d9 |
| rqa26-old-r01-d2-lossless.json | 46358e961e9bad6131dd946137d8af5907136eb2e634cc38aea4b41098dfb107 |
| rqa26-old-h02-lossless.json | 753fe95235d54fc078f8678174f5171d6846f3e3e85bedb242556cde71e919fc |
| rqa26-candidate-h02-lossless.json | 48d1a66132cf20d1967d3e10edbe2a84ed302292cd63eea4661e24707192d7ff |

## 解释限制与交接

非随机运行、顺序偏离、候选/旧标签可见、同一简单产品图、每题每配置n=1，且题目明确列出了大量保留约束。四图都通过核心标准可能反映任务清晰及通用模型本身已可完成，不能据此证明候选方法产生增益，也不能反证方法无用。没有方差/失败率估计，不能认证图像专家稳定资格或总放行24专家。

主线另报告候选H02缩略图、完整contain、退回仅聚焦、刷新经工作台重开一个输入均通过；这属于**主线UI验收**，不是本评审独立复现。未做付费revision/接受，不能把review写成用户已最终接受。

只写指定评分/审查文档；未改输入/断言、原图/原始归档、包/源代码/profile，未调用模型/provider、未跑fullcheck。完整逐断言证据与claims分别保存在rqa26-{old,candidate}-{r01,h02}-grading.json/.md。原blockedN/A历史始终保留。
