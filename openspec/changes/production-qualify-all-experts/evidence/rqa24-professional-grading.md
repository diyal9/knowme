# RQA24 生图 / 参考编辑独立专业评审

## 结论与范围

实测的是**已安装image-producer 3.2.0**（snapshot hash `dcf7730df6be94b0`），不是源码3.3.0。真实图片已交付，v2确实使用v1参考图，但**把明确要求保留的银色杯盖也改黑，定向编辑不合格**。两版均未返回指定1080×1440；这与画面主体质量分开记录。

本评审者是冻结标准作者，看过主线反馈提示，非盲；独立打开两版原图、完整预览及v2重开缩略图，并核对实际provider wire。没有模型/UI/QA调用或源码修改。冻结标准JSON SHA256为 `604bdc5e22ca06eae2c5ef9047b3ddb51678e56c9c00abae70e883fb13626b9b`，未修改。

| 版本 | 通过 | 失败 | N/E（不计分母） | 原图实测 | 答复长度 |
|---|---:|---:|---:|---|---|
| v1 | 7 | 2 | 1 | 896×1200 | 832 UTF-16字符 |
| v2 | 7 | 3 | 1 | 1088×1440 | 289 UTF-16字符、3句 |

不同版本适用项不同，不能用同一总分或通过率做版本能力比较。初始模型前needs_input预检失败的视觉项全部N/E，不列入以上分母，更不当专家图像质量错误。

## 冻结逐项结论

| 冻结项 | v1 | v2 | 关键依据 |
|---|---|---|---|
| S1 已确认后生成 | PASS | 不适用 | 原始Brief明确一次生成授权，无重复询问；v2另有明确编辑反馈授权 |
| S2 实图与执行绑定 | PASS | PASS | 各一次generate_image、各一张可读真实原图 |
| S3 模型发现/授权范围 | PASS | PASS | v1查询模型后生成；v2沿用已知支持编辑的模型依据；无PS/外发/额外付费重试 |
| V1 单只银杯形体 | PASS | 不适用 | v1杯体、盖、底完整连贯，银色金属可辨 |
| V2 墨绿/左杯/右留白 | PASS | 不适用 | v1布局正确，右侧连续留白充分 |
| V3 实际尺寸比例 | FAIL | FAIL | 均非1080×1440、非严格3:4；请求回显不能充当返回尺寸 |
| V4 无字/Logo/水印 | PASS | PASS | 两版原图完整查看，未见可见文字标识；不计UI文字 |
| R1 v1真实参考绑定 | 不适用 | PASS | wire参考完整SHA256等于v1原JPEG，previousVersionId亦对应v1 |
| R2 编辑prompt约束 | 不适用 | FAIL | 首句仅通用编辑标签；后文主动把改色扩大到lid |
| R3 杯身哑光黑 | 不适用 | PASS | 实际低反射黑色细纹理，不是只把银杯整体压暗 |
| R4 其余设计保留 | 不适用 | FAIL | 用户“只改杯身、保留杯盖”，实图银盖变黑盖 |
| P1 独立缩略图/版本 | N/E | PASS | v1未有充分独立缩略图证据；v2新增滚动截图可辨正确黑杯、无破图串图 |
| P2 contain全预览 | PASS | PASS | 第1/2版弹窗各显示原图四边、全杯、留白，无拉伸 |
| T1 简洁及视觉复核诚实度 | FAIL | N/E | v1长参数/自查表确定违反简洁性；v2三句满足，但两版模型视觉输入均缺证 |

各项原文、具体引文和category统计见同名JSON；没有新加评分条目。R2首句格式问题是冻结的SOP条款，不是视觉硬伤本身。R2与R4反映同一改盖问题的指令/结果两层，不能包装成两次独立失误。

## 决定性反例：引用正确，但改错部位

用户反馈明确：“**只把保温杯的银色金属杯身改为哑光黑。保留同一杯型、杯盖**……”

实际wire首句为“Reference-based product photo edit.”，其后写：

> Same applies to the lid so the whole bottle reads as one matte black product

这不是单纯保留lid design，而是主动要求杯盖一起变黑。原始v1银盖与v2黑盖对照吻合该错误指令。最终答复也说“杯身与杯盖均已改为哑光黑”，这句作为画面描述是对的，**却没有满足用户限定的编辑范围**。不靠像素一致要求、不把主观杯型偏好追加为标准。

v2主体黑色哑光成立，杯型/左侧位置/绿背景/留白总体保持，柔和光影与细微纹理变化可接受。没有把近似构图误差另立失败，也不把“镜头略近”当作已证实的物理摄像机动作。保持比例/目标尺寸问题已归V3。

## 尺寸、表述与视觉输入证据

原图解码：
- v1：896/1200=0.7466667（56:75），并非严格0.75；
- v2：1088/1440=0.7555556（34:45），亦非严格0.75。

两版工具回显均含请求1080x1440/3:4，v2 wire也证实请求确实如此，但实际像素未满足。两版正文均表示无法确认最终像素，不能记成谎报“精确1080×1440”；也不能说已经向用户披露了实际896×1200或1088×1440。这里是输出格式与尺寸交付缺口，不是否定杯子/背景视觉质量。

v1“逐项核对画面（基于实际图像，非Prompt复述）”的描述大体符合独立所见，然而原Agent是否收到视觉输入仍未知。v2同样未知：globalfetch观察器没有覆盖其模型transport，未捕获不等于没有输入。**模型视觉核查子项两版均N/E，不记0，不指控假看图。** v1 T1因另有确定的832字符长表不通过；v2简洁性三句通过，整体T1仍因视觉核查缺证而不可评。独立评审者看过图片不能替代Agent当时看图的证据。

## UI与版本来源链

- task：`task-mtphk5gg-jinbr`；session：`wb-expert-task-mtphk5gg-jinbr`。
- v1 run：`expert_task-mtphk5gg-jinbr_mtpi45c0`；artifact：`image_6c8124d9d8735d9b`；生成call：`call_93b722b32a3046a196a02f22`。
- v2 run：`expert_task-mtphk5gg-jinbr_mtpidoxs`；artifact：`image_b35a1e161e1cbf3d`；生成call：`call_b4146598c50946c991c76fe2`；deliverable.version=2，previousVersionId正确指向v1。
- v2 wire中的data参考SHA256：`6c8124d9d8735d9b3133e402172fe7096fd3e52a9bbe474c90394aa86582ff33`，与v1原JPEG完整hash相同。原PNG hash：`b35a1e161e1cbf3d2c666c9abeaaba726156ba1d408135ddbedD2848f9b30129`（不区分大小写）。
- 按runId过滤记录：v1为list_paint_models一次+generate_image一次；v2仅generate_image一次。session累计steps保留v1旧调用，不据此误报v2重复生成。
- 两版assistant hash分别匹配该run verificationDiagnostics.candidateHash；工具artifact路径、版本引用与独立打开原图一致。verified/review均只是平台状态，不是专业认证。
- rqa24-v1-preview.png、rqa24-v2-preview.png可见各自完整大图，fit=contain。最初rqa24-v2-reopen.png只显示旧答复顶部，不能单凭它认定v2没显示；新增rqa24-v2-reopen-image.png确见本次反馈下独立黑杯缩略图，另有reopen DOM确认一张1088×1440图、一个输入框。
- 约180×120容器内竖图约91×120，偏小但可辨。本轮只记可用性观察，不按未冻结最小尺寸判失败。未操作UI或制作/修改截图。
- 导出记observerRestored=true；恢复事实仅引用主线导出，不虚称本评审检查过运行中的观察器。

这是安装3.2.0的一次实际生成和一次编辑，结果模型分别为gemini-3-pro-image和gpt-image-2；不是Skill A/B，不证明源码3.3.0已装配，更不能据两个成功工具调用放行专家生产资格。空图、失效链接、编辑不支持等未发生异常没有被当作已通过测试。

仅新增rqa24-professional-grading.json及本报告，冻结标准、图片、原始证据、源码均未修改。

