# RQA18 marked 解析器与字段语境复核

2026-09-06。只读生产；仅新增独立回归文件及本报告。旧测试/报告保留。没有 API、实际 QA、Electron 启动或 fullcheck。GitNexus debugging query 为 FTS 降级空结果，checkProvidedFieldClaims context 未找到，按当前源码复核，不据索引结果推断零影响。

## 结论

**原手工扫描器反例已转绿，但当前版本尚不能关闭引用边界问题。** 独立原样执行32+30项共 **62/62 green，exit 0**；新增22项实际 **12 pass / 10 fail，exit 1**。均使用 `node -r ./scripts/register-ts.js --test`，没有改断言来转绿。

### P1：HTML 正文成为全局引用门禁豁免

`src/lib/agent-source-citations.ts:19` 把全部 `html` token 与代码、链接一起跳过。marked 将 div/p/table/details 的整块正文装入 HTML token，而不只是标签；因此可见普通正文里的来源 ID 消失。

只读真实 verifier probe：材料仅有 R1/R2，`<div>材料[R1][MISSING]</div>`、p 及 table 版本均实际 `ids=[] / passed=true / violations=[]`。同内容用 span 时正常阻断，证明是容器解析路径差异，不是有效来源。新增4个 HTML 正文反例均红；span 控制绿。

建议处理 HTML 中的正文语境，而非删除整个 token；保留 comments、属性、pre/code 字面量与链接语法的区分。不可直接把 raw HTML 全部作为正文扫描，避免把属性值或代码样例误判为来源。本次未做真实 UI 渲染，不将这些 probe 称为 UI 漏验实跑。

### P2：全文解析正确，字段局部重解析仍丢失语境

`src/lib/agent-claim-source-check.ts:64` 对 `claim.text` 单独调用 `explicitSourceIds`。全文末尾/开头的 reference definition 不在片段内，合法 `[guide][LINK]` 重新变成两个来源引用。

实际例：`[guide][LINK] 负责人：李明 [R1]。` 后接合法 `[LINK]: https://example.invalid` 定义。全文识别仅 R1，但字段返回 `support=unresolved / sourceIds=[] / passed=false`，即使材料 R1 明确 owner 为李明。5个定义位置/前后链接/shortcut 控制均红。

另1红：`[guide](https://example.invalid/R2) 负责人：李明。`。扫描器正确排除链接，随后 `explicitlyNamed`（约65行）仍从原始 URL 抽到 R2，将 owner 错限于 R2，不能使用本来支持它的 R1。链接地址中的短 ID 不能自动成为材料归属。

建议全文解析一次或携带等效的可信解析语境，按原文位置映射每个字段的局部引用和具名来源；不能把全文所有 ID 填给每个字段，否则另一句的 R1 可洗白本句明确归于 R2 的错误。也不能将链接/代码片段中的裸 ID 当材料归属。保持字段原值与独立来源支持，不用删除整段文本让字段消失。

## 已保留的硬边界

`src/lib/agent-grounding-ledger.ts:331` 起工具、证据、完成条件独立检查；约423行全文 citation identity 检查仍不受 candidatePresentation 豁免。工具 alias 约412行仅从 expectedSource/actualSource 同键精确相等值建立，source_mismatch 仍单独阻断。本轮未修改这些决策。

新增绿控制确认：真实局部 R2 不得借其他句的 R1，伪 owner 仍阻断，合法链接不覆盖另一个 MISSING，HTML 包装不提供发送回执、不能满足 requiredTools/evidence，来源 ID 大小写仍精确匹配（区别于 Markdown reference label 的大小写规则）。既有62项继续约束围栏长度/字符、跨行反引号、定义投毒与局部语法排除。

不把以上控制解释为任意自然语言归属或分析结论已能正确裁决；host-anchored reviewer 仍为后续独立语义层。

## 依赖加载与待主线验证

`src/lib/agent-source-citations.ts:8-13` 只通过固定 installed marked package 路径读取 UMD，并在 VM 内执行该依赖；候选文本仅传入 lexer，没有把用户文本拼为 VM 代码。当前 Node 实际同步 require 和62项已成功，不能替代 Electron 31 的 Node/V8 或 asar 打包验证。VM 是兼容加载机制，不应声称是通用安全沙箱。

主线实际 QA Electron require 检查应记录进程 Electron/Node 版本、resolved marked/package.json 与 UMD 路径，加载真实引用模块/ledger，验证简单混合引用及合法代码；打包后还需确认依赖内部 UMD 文件可读。当前未执行这些检查，也未要求重新调用真实模型。保持固定依赖路径，不能改成用户控制的文件或 URL。

## 冻结证据

新增文件：`tests/rqa18-citation-context-regressions.test.js`。22项红测针对下列生产版本，运行后再次核对 hash 一致；后续主线并行版本不自动继承此结论。

| 对象 | SHA256 |
|---|---|
| 新22项测试 | `18214C231DF3B95CC172CE1CCF69E21BB70DCBCC91F079B58857AAEBF39A4391` |
| 原32项测试，未变 | `9C72C3781E165A37280F124C083F859D21C824D892B2A2D3DE1E266100975A12` |
| 原30项测试，未变 | `E7A52F3A982FBCF8455651A991498502C3B07F1FCC6DB2B23281A9568F64E15B` |
| agent-source-citations.ts | `76EA840643456A700DB513C1028D37A20B9E7E0A8503893A0F698C74D9C4F611` |
| agent-claim-source-check.ts | `AEE9EC4384C72B6A7FA0F4A127A9AAC9DD815BB244EEE50BD361E4C7C698FC46` |
| agent-grounding-ledger.ts | `0892FD90596ABE577DF15BAA962503AB493C447A481702F976C2A594A1E18E1D` |

本报告是当前冻结版本的最终复核结论：旧62项绿、剩余10项红；修复后须原样复跑，不能将“采用真实 Markdown parser”本身视为边界已完整关闭。
