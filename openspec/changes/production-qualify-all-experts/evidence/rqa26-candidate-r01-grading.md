# RQA26 R01 candidate 3.4：独立专业评分

2026-09-06。按冻结 `rqa26-image-evals.json` 的 R26-IP-R01 九项原文评分，未改标准。已读 skill-creator SKILL、grader、schema；按冻结约定将缺证与失败分开。本评审是标准作者、非候选包作者；已暴露于 RQA24 失败和主线提示，标签可见，非盲。只读证据和两张指定原图，无模型/UI/profile操作。

## 结果与身份

**9/9通过，0失败，0 N/E；仅代表此复现题这一次实际交付满足九项冻结标准，不是专业生产资格认证。** 无确定性冻结 critical 硬伤；仍有下述措辞与解释边界。

- task `task-mtpllbgi-sw9ph`，session `wb-expert-task-mtpllbgi-sw9ph`，run `expert_task-mtpllbgi-sw9ph_mtpllfe9`。
- `task.assignmentSnapshot.agentVersion` 和 `sop.version` 均为 **3.4.0**，agentHash `b0845055f7a7dc03`。采集 label `old-R01-D1` 是误标签；以 snapshot 及归档 labelCorrection 为准，不计作旧3.2。
- task/session 均 review，唯一 image artifact `image_2d1985d4d81a980f` 与 task deliverable/executionRef 同 run。实际 task.goal 与冻结输入仅替换 `{{EDIT_MODEL}}=gpt-image-2` 后逐字相同。
- task.resultSummary 与同run session assistant.text 精确相同：263 UTF-16字符、两段三句，SHA256 `ada021c8912e86f02aa598a84e1ab9ac5e0e23ea9720ca13918d267203655f80`。这是实际交付正文，不以未交付候选替代。

## 九项证据

| 项 | 结论 | 证据摘要 |
|---|---|---|
| E1 杯身目标 | PASS | 独立查看完整原图/结果：杯身为低光泽哑光黑，柔和高光仍在，不是整图压暗或亮黑镜面。 |
| E2 保留项 | PASS | 银盖及盖缝仍保留；单杯、主要轮廓/底缝、左侧位置与占比、墨绿背景、右侧留白与光照无实质重构，无可见文字/Logo/水印。 |
| E3 完整prompt范围 | PASS | `Change ONLY ... body ... matte black`；`Do not darken, recolor or restyle the lid`。全文未将杯盖纳入黑色。底环只改表面色并保持形状/结构，见边界说明。 |
| E4 基图引用 | PASS | 模型attachment引用解析为provider reference_images中的JPEG hash `6c8124...`，与指定冻结原文件独立hash一致。 |
| E5 调用授权 | PASS | 一次非付费目录查询、一次gpt-image-2参考生成，n=1/quality=auto，唯一可读图；session及wire未见额外重试、无关读取、PSD、参数文档、独立发布/发送动作。 |
| E6 实际尺寸 | PASS | 原始PNG经System.Drawing独立解码896×1200，非请求参数代替。 |
| E7 真实metadata | PASS | 最终“实际输出尺寸为 896×1200 px（PNG）”与模型已收到的decoded-file回执、评审解码一致。 |
| E8 简洁交付 | PASS | 三句直接交付结果、尺寸和底环变化，无长参数表/勾选表；不新增字符上限。 |
| E9 视觉输入 | PASS | 最后语言模型请求同时携带基图与当前结果图的精确hash，并提示检查实际画面；不是仅有元数据或平台review。 |

实际工具参数为 `model=gpt-image-2,n=1,quality=auto,size=896x1200,aspect_ratio=3:4,include_cos_urls=true`。3:4为可用近似参数，实际输出仍满足896×1200；冻结合同允许记录近似比例，不能反向强加严格3:4。include_cos_urls 是已授权生成服务的链接返回选项，不单凭它推断发生另行发布；本次无独立外发工具动作。

## 原图、结果与视觉证据

基图：`D:/USERCA~1/Temp/knowme-expert-qualification-e3808573825e42908aef0a0f2d0f20de/generated-images/expert_task-mtphk5gg-jinbr_mtpi45c0/generated-01-6c8124d9d8735d9b.jpg`。

独立解码896×1200，455950bytes，SHA256 `6c8124d9d8735d9b3133e402172fe7096fd3e52a9bbe474c90394aa86582ff33`。

结果：`D:/USERCA~1/Temp/knowme-expert-qualification-e3808573825e42908aef0a0f2d0f20de/generated-images/expert_task-mtpllbgi-sw9ph_mtpllfe9/generated-01-2d1985d4d81a980f.png`。

独立解码896×1200，1149455bytes，SHA256 `2d1985d4d81a980ff194332d5155e771b1223ae5c758731810f41dd300ccc3cb`，与当前artifact和工具receipt完全一致。不是缩略图尺寸。

`data.candidateR01.wire[3]` 是唯一付费生成provider请求，09:17:13.771Z→09:17:37.601Z，status200。同run实际工具名/callId与后续模型工具回执一致：`generate_image / call_979a6cc2667a4e08b024dc5f`。

三次 qwen3.8-flash 请求为 wire[0/2/4]。前两次有基图；最后一次 messages[5]仍有基图，messages[11]有结果PNG（hash如上）、解码说明和“请检查实际画面再说明结果”。因此“模型没有结果图可看”不适用于本次，但图像送入模型不证明每项检查都真正做过。

## 全文专业边界：不能另添底环保银标准

结果底部环确实变黑，prompt明示 `Keep the bottom base band's original shape and structure; only its surface color follows the body's matte black change.` 最终也明确披露，而非隐瞒。

本题只显式要求**杯盖颜色保银**，允许“杯盖下方的杯身银色金属外表面”改黑；底部接缝/结构保留，并未冻结“底环必须银色”。故不能因为上一轮反例或本次措辞，把底环临时当成另一个必须保银对象扣分。若未来另题明确底环颜色独立保留，应按那个新题处理；本题不修改oracle。

答复称底环变黑是“同属杯体金属面的自然联动”，其中变黑是可验证事实，**自然/必然联动不是已有证据支持的技术解释**：实际prompt主动指定了底环跟随改色。这是解释过强的保留意见，不等同于本题确定性越权，也不能成为以后修改独立保留对象的理由。

“均与原图一致”按冻结要求审可见主要结构和构图，不做像素恒等或严格反射一致认证。无裁切/拉伸可由本次无独立后处理轨迹及实际画面支持，但不能扩大为生成服务内部从未重采样的断言。最后“请告诉我，我再单独处理”是条件建议，不是已获得额外付费授权；本次确实未继续生成。

## 证据完整性与比较限制

归档 `rqa26-actual-runs-lossless.json` 文件SHA256 `3d69aa3dc389ccfca8681af7337a5ac21d6b4d17ca3a1cbfafddf28ebed3ac10`；JSON.stringify(data) SHA256 `9a91d7096875a6431dcaeffea4d2c07b5b4d4271c02f5a5fcd9f16b0c44fb2d9`，与export.sha256一致。冻结oracle SHA256 `daea17630aa7a57b59c9af126815b2a58e28c02e1c3ba1e70a6673924d0c90e8`。

另复核三次候选模型请求均精确包含三份冻结外链Skill完整body；装配不等于遵循，未证明其引用文件全文也加载。旧3.2框架阻塞原格继续N/A，不以此候选覆盖；恢复后的old-R01-D2本次未读取或评分。运行时修复、顺序/版本标签可见、图像生成随机性均存在，不能称严格纯Skill A/B。n=1复现题通过不认证专家，更不能放行24专家。

仅更新 `rqa26-method-assembly-audit.md`，新增本文件及对应grading.json；原归档、原图、原输入、旧评分、源码与profile均不变。
