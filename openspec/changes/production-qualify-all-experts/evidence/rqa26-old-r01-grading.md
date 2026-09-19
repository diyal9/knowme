# RQA26 old 3.2 R01-D2 专业评分与有限比较

2026-09-06；按冻结 R26-IP-R01 九项，不改oracle。评分者为标准作者、非候选包作者，已见候选和主线反馈，非盲；使用skill-creator grader/schema。本次仅读取归档/实际图片，未访问profile或调用provider。

## 结论

**8/9通过，1项呈现失败，0 N/E；无确定性冻结critical硬伤。** E1–E7、E9均通过。E8失败仅因最终五个完整句子超出冻结的约两三句要求；没有长参数表，全文仅253字符，不能把这个分差说成专业方法改善。

实际图保留银盖、杯身为哑光黑，完整单杯、主要轮廓和接缝、左侧布局、墨绿背景/右侧留白/柔和光照均无实质重构，无文字Logo水印。底部环也变黑，但与候选采用相同边界：冻结题没有单独规定底环保银，不能事后加标准。

## 绑定、完整性与实际执行

- task `task-mtpluo03-l436a`，session `wb-expert-task-mtpluo03-l436a`，run `expert_task-mtpluo03-l436a_mtplurqe`；task与session均review。
- assignmentSnapshot.agentVersion及sop.version=3.2.0，agentHash=`dcf7730df6be94b0`，与冻结旧EXPERT全文hash前16位一致。版本以snapshot为准。
- `rqa26-old-r01-d2-lossless.json` 文件SHA256=`55a10ce583608aee633d2eb59c5f00fe9e76ec873421c4b0852044c483232c7d`；SHA256(JSON.stringify(data))=`46358e961e9bad6131dd946137d8af5907136eb2e634cc38aea4b41098dfb107`，精确匹配export.sha256。
- task.goal与冻结R01 prompt仅替换gpt-image-2后逐字相同。task.resultSummary与同run session assistant全文相同，253 UTF-16字符、三段五句；SHA256=`b3ce530809abfb33f84698c62b9e657e02fe9833a60ce35c29092017ebdf3745`。
- wire[1]为唯一provider generate_image：09:24:27.275Z至09:24:51.059Z，status200，model=gpt-image-2、n=1、quality=auto、size=896x1200、aspect_ratio=3:4；一次调用、一个可读artifact，session无其他工具，applyLog为空。已指定模型，不额外查询catalog不算漏步骤。
- 真实reference_images为JPEG/455950bytes/hash `6c8124d9d8735d9b3133e402172fe7096fd3e52a9bbe474c90394aa86582ff33`，模型attachment引用与provider解析结果匹配原基图。没有纯文生图替代、额外付费、无关目录/文件读取、PSD、提示词文档或独立外发动作。include_cos_urls回传选项不等于独立发布操作。

## 分项证据

| 断言 | 结果 | 证据 |
|---|---|---|
| E1 visual_target | PASS | 结果低光泽黑色带细颗粒和柔和高光，非整图变暗/镜面亮黑。 |
| E2 visual_invariants | PASS | 银盖外观、盖缝、轮廓、数量/布局/背景/留白/光照保持，无实质重构。 |
| E3 prompt_scope | PASS | 完整prompt只改cap下方杯身；明确 `do NOT darken or blacken the cap`，保留base rim and seam structure，未扩张到整瓶含盖黑色。 |
| E4 reference_provenance | PASS | wire真实参考hash匹配冻结基图，不是候选输出。 |
| E5 execution_authorization | PASS | 一次授权后一次参考生成、一张图，无其他工具动作。 |
| E6 actual_dimensions | PASS | 评审者System.Drawing独立解码原PNG=896×1200，hash匹配artifact。 |
| E7 metadata_truthfulness | PASS | “实际输出896×1200px，与基图一致，无取整差异”与当次decoded-file回执和独立解码一致。 |
| E8 concise_delivery | FAIL | 完成、尺寸、画面核对、底环/纹理限制、一次调用说明，共五句；仅句数/交付格式偏离，不新增字符上限或称长篇。 |
| E9 vision_process | PASS | 最后wire[2].messages[5]有基图，messages[9]有本次PNG和真实metadata/检查提示；并非仅依据review。 |

原始图：`D:/USERCA~1/Temp/knowme-expert-qualification-e3808573825e42908aef0a0f2d0f20de/generated-images/expert_task-mtpluo03-l436a_mtplurqe/generated-01-97c12d88d077bf22.png`。独立解码896×1200，1197559bytes，SHA256=`97c12d88d077bf22b10df3ca6e559720c367ffe2bc32b44bb23e4076b1bf018c`，与artifact/工具receipt一致。

两次语言模型请求均精确包含三份冻结外链Skill完整body；同run方法可见不等于引用库完整或模型遵循每步。视觉输入证明模型可看对应图片，不证明模型做过穷尽检查。

## 全文claims与边界

正文准确披露底环从银色变黑、拉丝纹理减弱，没有隐瞒变化。它将底环写为“不在你明确的改色范围内”，这是模型提出的保守边界疑问，不能替代冻结用户要求；不因此给视觉/授权新增失败。标题“尚未核查”后又写已观察的改变，混合了观察事实与待确认范围，可更清楚；不是已证伪造检查。

哑光化后拉丝弱化符合本题允许的合理纹理变化，不要求像素恒等。prompt中的 `approximately 896x1200`弱于精确请求，但独立size参数与实际解码均正确；不凭该措辞判实际尺寸失败。

## 与candidate R01比较：不宣称改善

| 项 | old3.2 R01-D2 | candidate3.4 R01 |
|---|---|---|
| 冻结分项 | 8/9；只E8失败 | 9/9 |
| 视觉/范围/引用/授权/尺寸/metadata/视觉输入八项 | 全通过 | 全通过 |
| 最终正文 | 253字符，五句 | 263字符，三句 |
| 真实生成 | 一次gpt-image-2参考编辑 | 一次gpt-image-2参考编辑 |
| 非付费工具 | 无 | 一次list_paint_models |
| 语言模型请求 | 2次 | 3次 |
| 底环 | 黑，正文提示待确认 | 黑，正文称“自然联动”（该解释未被证明） |

句数分差不能证明候选更简洁：旧文事实上少10字符。两张图都满足核心专业约束，未观察到R01上的核心能力提升；也不能由n=1断言稳定等效或方法无价值。旧末次模型输入以实际结果图结束，候选还有额外交付收尾指令，运行路径不是只有SOP一处变量。顺序可见、候选先运行再恢复旧包、服务随机性及运行时变化均限制因果归因，不是纯Skill A/B或资格认证。

最初 old-R01 框架阻塞继续单列 **N/A**，不由D2成功覆盖，不记0/9。本次只新增本报告及对应grading.json，候选评分、原始证据与冻结标准不变。
