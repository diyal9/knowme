# RQA26 image-producer 包回归与复核

日期：2026-09-06。初始结构 RED 保留如下；**3.4.0 候选复核及 7/7 GREEN、observer 风险见末尾补充**。

## 实际版本 RED

```text
node -r ./scripts/register-ts.js --test tests/image-producer-package-consistency.test.js
7 tests / 6 pass / 1 fail / 0 skip / exit 1
```

唯一失败：四处版本须一致为 3.4.0。实际 EXPERT.md=3.3.0、manifest.json=3.3.0、capability.manifest.json=3.2.0、catalog entry=3.1.0。真实 loadExpert 也读出 canonical 3.2.0；未依据 UI 或安装目录推测。

初版仅版本测试实际 0 pass / 1 fail，hash `F846DDE3A00052125A47811CDC459A73290E2EBC824F6C223B82C0325AF024E9`。随后新增结构断言，未改变版本断言；最终七项 standalone runner exit 1，冻结 hash 为 `DC6757A52772C0F21BDBD468B3629D96C18D49FE37D64A978F335ECFF12090E4`。初次 shell 命令随后执行哈希打印，其 wrapper exit 0 不作为 test 成功证据。

六项通过分别覆盖：真实 expert/canonical validators；三项 required skill 与两个 optional connector 一致；原始及实际加载权限；默认、确认交付、修改反馈三种真实 resolveOutputSpec 路径。

输出契约锁定 generated-image/生成图片/image/required，三项原有 requiredSkills，generate_image、其成功 tool_result、image artifact、minArtifacts=1、tool_success/artifact_present；声明及选择后均检查。权限保持 tools=[list_paint_models,generate_image]、connectors=[pango-image-mcp,photoshop-mcp]、network=true、write=true、externalWrite=false。没有要求增加 Skill 数量或新的权限。

## 后续候选方法审阅约束（尚未判 pass）

以实际加载 SOP/方法为范围审阅语义和相互冲突，不用长段全文字符串或 SOP 条数作为质量断言：

1. 修改定位到对象与属性的变更集，另列保留/不可变项，不能将局部要求扩散到整幅图。
2. 区分编辑基图与风格参考；引用上一版时仍明确角色、修改目标及保留项。
3. 检查完整最终 prompt 是否残留旧特征或与变更集冲突，不只追加一句新要求。
4. 解码 metadata 是文件事实，视觉内容是另一个核查轴，请求参数不能充当实际结果；不能声称未观察到的画面已验收。
5. 不越权使用 Photoshop、不自动进行额外付费重试；外链/linked 同 ID 依赖不因本地包更新被覆盖，也不从文件缺席猜安装失败。

这些要求来自候选正文阅读前的用户契约。主线说明约十条 SOP 不是测试计数门槛；三项既有 th-art Skill 足够承载依赖声明，本回归不要求新增 Skill。候选正文落地后再补适合自动化的局部概念检查，并人工核查否定、例外和冲突；关键词命中本身不证明模型行为正确。

## 源锚点与范围

七项 RED 执行前后以下包 hash 相同：

| 文件 | SHA256 |
| --- | --- |
| src/catalog/experts/image-producer/EXPERT.md | 6AFC8CDF3F12DF78FA80822F980D5F7DC87604FE692F7F9CE77FBF8DA7E69DAE |
| src/catalog/experts/image-producer/manifest.json | 87FE880509F6E96188B7E1C595641E0C2C89948F0B0DD0013EBEDEE7FE4D7DC8 |
| src/catalog/experts/image-producer/capability.manifest.json | 886C352D2F0ADB1AE88B147E11480B02E2313DA2B654397AB21780495677134D |
| src/catalog/catalog.json | DA4DE25B3B9C503FD2589E076FB36B6D8DCDAF48BB038F1E396E21C14B2DAE61 |

已读 AGENTS、gitnexus-exploring、skill-creator 全文；GitNexus query 无匹配且 FTS 降级，resolveOutputSpec context 为 lower-bound，使用实际源码与现有 RQA20 测试模式补足。未修改任何已有函数/helper；只新增指定测试文件和本报告。未发现已有专门 image-producer-package-consistency 测试；未改通用或他人测试。

未改包、catalog、运行时、已安装 linked Skill 或 QA profile；未运行真实模型/API/fullcheck。本测试是本地源包结构回归，不是安装后同-run L1 证据、专业性评分或视觉资格证明。

## 候选 3.4.0：冻结测试 GREEN 与方法审阅

同一命令、同一冻结测试 hash `DC6757A52772C0F21BDBD468B3629D96C18D49FE37D64A978F335ECFF12090E4` 实际复跑：**7 tests / 7 pass / 0 fail / 0 skip / exit 0**。没有为通过修改测试。

全文阅读 EXPERT.md，复核 canonical/legacy 及真实 loadExpert；四处版本已一致 3.4.0，原图像输出契约与权限未扩张。loadExpert 返回 SOP 1372 chars，含下面讨论的正文；这只是本地实际加载结果，不是模型同-run收到的证据。

SOP 7–10 的语义符合本轮候选方向：

- 第 7 条将对象/属性变更与保留集拆开，明确保留形状不授权改颜色，也不授权改变相邻对象；编辑基图和风格参考分角色，缺基图/不支持编辑不得默默转纯文生图。
- 第 8 条要求检查完整 Prompt、参数以及 style/palette/negative/技术增强片段，删除越界增强；排除旧特征同样限定对象范围，涉及保留项的必要联动请求用户决定。用户数量/模型/方法/付费限制优先于 Skill 默认探索策略。
- 第 9 条区分请求期望、decoded-file 尺寸格式回执、实际视觉观察；核对变更/保留两组条件且不强求像素恒等，无视觉输入不声称画面检查，工具成功/待验收不代表图像合格。
- 第 10 条要求简洁真实交付，尺寸不同明示差异、缺证据说明未知、保留版本，不擅自裁切/拉伸/后处理/额外付费重生成。

未发现这些新增条款之间的实质冲突。已有第 5 条/systemPrompt 的 Photoshop“可用”措辞不能单独理解为后处理授权；应与第 10 条的本次授权限制一起读取。仍需实际输出验证模型是否如此执行，不能由静态检查断言已守住这一边界。

**外链边界**：三项原 Skill 依赖保持原 ID，未增加 Skill。候选只声明依赖，不表示应覆盖 linked 安装来源；EXPERT 本文没有建立安装器级别的“不得覆盖外链”机制。本轮未读外链内容、未安装、未验证同 ID 源选择，不将静态依赖一致冒充 linked 安装不覆盖的实证。未对方法做脆弱整段文本断言，也未把关键词命中计作专业性 pass。

候选锚点：

| 文件 | SHA256 |
| --- | --- |
| EXPERT.md | B0845055F7A7DC032F99BBF0A6B5D6E26F321794E975E8EA952317768270E9BA |
| manifest.json | 4B6B97E027704C112483440CEBFF596ADECB5C48CBFA6EE41E14508C01A0A95C |
| capability.manifest.json | BC591332B38BDCCAEE477EEEB5E0EB90E8C0D0BB9FA540BC602BB7F74E816FA8 |
| src/catalog/catalog.json | AACED20645B8D938B0739EF1BC26BBAAF0F14A306EEFAE26EE902AC47598B75D |

## observer 只读审阅：不能认定无泄密或零扰动

文件 `evidence/rqa26-observer.cjs`，SHA256 `674F1658D69037F8885ED0AA6A8DBD97F5AB8929E8DE70005797D4A891C63986`。已完整读取，未修改，也未在真实 QA 进程安装。按 gitnexus-debugging 查询无结果（FTS 降级），因此直接源码审查；此新 evidence helper 不作索引已覆盖声明。

### 凭据/图像留存缺口（采证导出前应处理）

第 5–14 行 scrub 只检查部分对象 key、完整 data URL、大于 10000 字符的裸 base64、以及以 http 开头的完整字符串 URL。**不记录 headers 不等于日志无凭据**：合成 marker 探针实际证实普通 `token`/`password` key、MCP `content[].text` 中 JSON 的 apiKey，以及句子内签名 URL 的 token 均原样保留。对照组直接 apiKey key 与完整 URL 的 query 被去除。第 66 行还直接记录错误 message，未 scrub，可能带 URL/凭据信息。

图像也并非总是“仅 hash”：实际探针的短 `content` image `{type:'image',mimeType:'image/png',data:<短base64>}` 留下原 data。应依结构化 image 字段识别字节，而非靠 >10000 阈值。当前无真实 secret 泄露证据，以上是可复现的采证脱敏不完整，不能把开头“never records ... credentials”当作已证安全承诺。

最小建议：界定允许留存的请求/响应字段；按 image 类型处理裸 base64，不按大小猜测；对文本/嵌套 JSON/错误信息采用明确的敏感数据留存策略。需要全文 Prompt 审计时承认其敏感性，受控保管并在导出前核查，不能仅靠扩充 key regex 保证任意文本绝无秘密。

### 请求参数基本透传，但有行为/资源扰动

- http/https 第 34、43–48 行仍把原 args、chunk、rest 传入 original/request.write/end；fetch 第 54–58 行传入原 input/init，没有修改 header/body 来改变模型任务。本次离线 stub 探针确认 input/init 对象相同。未证明所有 transport overload 都完整可观测：字符串编码和 Uint8Array 等可能使采证内容不完整，而不是证明实际发送被篡改。
- **第 62 行同步 clone 异常未隔离**：在纯离线 VM 内以 fake electron/http/https/fetch 运行原 helper，成功 transport 返回 status=200，但模拟 response.clone 抛错；wrapper 实际转为 reject（原 input/init 仍相同）。这是可控异常路径反例，正常未消费的原生 Response 通常可以 clone，不声称真实 QA 已遇到此失败。建议将整个观察分支隔离为不改变 transport 成败的失败记录。
- clone().json() 额外消费响应分支，fetch 请求/响应解析与 state.records 无整体容量上限；http 的 12MiB 限制不覆盖 fetch/响应。大图 JSON clone/base64 解码/hash 会额外占用内存和 CPU，可能影响时序。建议限定行数/总字节/响应大小，并对超限明确标 unavailable，不把它称为零成本被动旁路。
- restore 直接回写安装时函数，若其他 observer 后装可覆盖对方；使用期间应保持单一 owner/短生命周期。label 不是 task/run 的密码学绑定，记录没有自身 taskId/runId；后续 same-run 审计仍须与真实任务日志对应，不能凭 label 自证。

探针仅使用 synthetic marker 与 stub transport，不含真实凭据、不发起任何网络请求、不访问 profile。上述风险不要求修改专家方法或生产 runtime；主线可在独立 observer 范围加固。本文没有执行观察器实装、QA retry 或 fullcheck。
