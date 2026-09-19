# RQA26 H02 old 3.2 独立专业评分

2026-09-06。冻结R26-IP-H02九项原文见对应grading.json；按skill-creator grader/schema评分。标准作者、非候选包作者，已见RQA24/R01及主线提示，非盲。本次只读证据/实际图，无profile、provider或UI操作。

## 结论

**8/9通过，E8呈现失败，0 N/E；未发现确定性冻结critical硬伤。** 实际暖灰背景与整杯银色金属均符合要求，不以review代替结论。E8仅为四句且核对/建议段展开，未压缩成约两三句；不是图像失败，也不是模型答复截断。

task=`task-mtpmaqln-tf3ct`，session=`wb-expert-task-mtpmaqln-tf3ct`，run=`expert_task-mtpmaqln-tf3ct_mtpmaui5`；assignmentSnapshot和sop.version均3.2.0，agentHash=`dcf7730df6be94b0`。唯一artifact=`image_45d740112bf26255`。

**以session完整正文336字符、三段四句评分。** task.resultSummary是其前280字符，恰停在“建议放大看杯身边”；实际后文仍有“缘和反光带。如需微调……不会额外付费重试。”。这56字符差异是摘要范围，不记模型未完成。完整正文SHA256=`0e5ea4ffc0891bdc74e04f89c7b41893f924aef3dd0703775b95fbc309627b54`。

## 冻结九项

| 项 | 结果 | 具体证据 |
|---|---|---|
| E1 背景目标 | PASS | 独立看图：杯后及底部背景面整体为干净中性微暖灰，无绿色残留背景或新道具/图案。 |
| E2 银杯保留 | PASS | 杯身、银盖、底环仍为金属银；主要轮廓、接缝、布局占比和留白保持，柔光/接触阴影存在，无文字Logo水印。 |
| E3 prompt范围 | PASS | `ONLY change ... backdrop ... clean neutral warm gray`；`entire bottle, including body AND cap ... original silver/steel`；禁止黑/灰涂层，允许的变化只限背景与轻微环境反射。 |
| E4 基图 | PASS | provider wire[1]参考JPEG SHA256=`6c8124d9d8735d9b3133e402172fe7096fd3e52a9bbe474c90394aa86582ff33`，与模型attachment解析链和冻结基图一致。 |
| E5 授权动作 | PASS | 一次gpt-image-2参考编辑、n=1/quality=auto，一张真实图；session仅generate_image，applyLog为空，未见其他付费/文件/PSD/文档/独立外发。 |
| E6 实际像素 | PASS | 原PNG由评审者独立System.Drawing解码896×1200，非size参数替代。 |
| E7 元数据真实 | PASS | “实际尺寸896×1200px（PNG）”与当次decoded-file回执和独立解码一致。 |
| E8 简洁交付 | FAIL | 完整正文四句，核对后又展开逐像素/色温限制和调整建议，超出约两三句要求；未新增字符上限，不记critical。 |
| E9 视觉输入 | PASS | 最后wire[2].messages[5]为基图，messages[9]为当前结果图hash45d740...，同时附解码及检查提示；对应图像在最后答复前对模型可见。 |

实际文件：`D:/USERCA~1/Temp/knowme-expert-qualification-e3808573825e42908aef0a0f2d0f20de/generated-images/expert_task-mtpmaqln-tf3ct_mtpmaui5/generated-01-45d740112bf26255.png`。

独立解码896×1200，1254224bytes，SHA256=`45d740112bf2625537d72a6320719220c1768d144836d277279de13d0b33b720`，与artifact及tool receipt相同。唯一生成请求09:36:58.145Z至09:37:18.047Z、status200；两次qwen3.8-flash请求均有三份同源完整Skill body，但不证明所有引用文件已读或每步都被遵循。

## 全文边界

暖灰允许主观色温区间，不要求唯一HEX；“当前偏中性微暖”与实图相容。“尚未核查是否完全符合你预期”是偏好保留意见，不与暖灰已实现矛盾。银杯高光有轻微变化，但不是黑/灰涂层，属冻结允许的环境差异。逐像素一致性并非本题要求，不因模型主动提到它就新增失败标准；也不能把建议放大检查当已完成像素检查。

后续“更暖的灰/减弱背景渐变”仅是建议，没有实际再调用，不记越权。实际无独立裁切/拉伸，但不宣称provider内部无任何重采样。E8是呈现判断边界，不能将它与真实图像/授权硬伤混为一谈。

归档文件SHA256=`4ffb08931f0216b7469c06fba50e91754761959e931cbc5232c406d85cf27cf4`；SHA256(JSON.stringify(data))=`753fe95235d54fc078f8678174f5171d6846f3e3e85bedb242556cde71e919fc`，与export.sha256一致。实际task.goal逐字匹配冻结H02仅替换模型占位，oracle未改。

仅此单例留出评分，不认证生产资格。旧首次R01 blocked仍单列N/A，不能被H02成功覆盖。四格比较另见rqa26-method-comparison.md。
