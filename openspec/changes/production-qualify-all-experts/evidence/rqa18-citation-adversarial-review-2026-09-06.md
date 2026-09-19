# RQA18 引用扫描器对抗复核（冻结红测）

2026-09-06。仅新增独立测试与本报告；生产、原测试、历史报告未修改。无 API、QA、fullcheck。按 gitnexus-debugging 查询：FTS 降级无结果，`explicitSourceIds` context 未入索引，转当前源码核查；不据此声称零调用者。

## 真实运行与冻结证据

最初32项测试确实在主线 citation 补丁前执行：**17 pass / 15 fail / exit 1**，不是重建旧源推测。记录见 `rqa18-claim-boundaries-review-2026-09-06.md`。

本次新增 `tests/rqa18-source-citations-adversarial.test.js`，执行：

`node -r ./scripts/register-ts.js --test tests/rqa18-source-citations-adversarial.test.js`

实际 **30 tests / 19 pass / 11 fail / 0 skipped / exit 1**。输出尾部 runner 附加的零测试汇总不替代前面的30项实际结果。

| 对象 | 本次运行前 SHA256 |
|---|---|
| 新30项测试 | `E7A52F3A982FBCF8455651A991498502C3B07F1FCC6DB2B23281A9568F64E15B` |
| 原32项测试（未变） | `9C72C3781E165A37280F124C083F859D21C824D892B2A2D3DE1E266100975A12` |
| agent-source-citations.ts | `7A857123E9CA5FD82A70E60A44F72D4CFD13CB71478027D2DB04C4552DAA392D` |
| agent-grounding-ledger.ts | `0892FD90596ABE577DF15BAA962503AB493C447A481702F976C2A594A1E18E1D` |
| agent-claim-source-check.ts | `AEE9EC4384C72B6A7FA0F4A127A9AAC9DD815BB244EEE50BD361E4C7C698FC46` |

另一次只读内存 probe 后，scanner 及两个测试 hash 再核对一致。未锁定并行主线文件；结论只绑定上述已读版本。

## 确认的问题

1. **全局引用门禁可被代码中的假定义绕过。** `agent-source-citations.ts` 首轮定义收集不识别代码作用域，后续 `definitions.has()` 就忽略对应引用。5项红覆盖反引号/波浪围栏、短关闭符、错误围栏字符，以及跨行行内代码里的假定义。

   独立真实 `verifyClaims` probe：仅有材料 R1，正文为 `[R1][MISSING]`，空行后放三反引号围栏，其中写 `[MISSING]: https://example.invalid`。实际返回 **passed=true，violations=[]**。因此不只是 helper 数组错误，确实绕过 ledger 全局检查。网址未访问。

2. **2项漏检。** `[MISSING]` 前有两个反斜杠时，它们相互转义，不应转义左括号；当前仅看紧邻字符。`[MISSING](https://example.invalid` 没有闭合，不是真正 Markdown 链接；当前仅凭后接左括号排除。

3. **4项误拦截。** 合法跨行行内代码、四空格缩进代码、围栏中带尾随文字的非关闭行，以及合法含空格标签的引用式链接。当前按行处理、围栏关闭只查开头、标签字符集过窄，分别破坏语法边界。

19项正控制包括真正关闭围栏后继续扫描、局部 Markdown 排除、单反斜杠字面量、不同长度未配对反引号、合法代码/链接，以及伪 owner/发送完成仍被原事实与操作门禁拦截。含空格引用式图片当前通过不证明图片解析健全，可能只是 `!` 前缀被整体忽略；该测试只锁定合法输入不可误拦截。

## 最小通用建议与剩余边界

先建立一致的 Markdown 作用域/有效链接跨度，再提取其余正文中的平台来源 ID；定义收集与引用扫描必须共享作用域，不能先从代码样本收集全局定义。代码应按准确围栏关闭、反引号 run 配对处理；链接应确认实际闭合和有效 reference definition；转义应考虑反斜杠奇偶。可优先复用宿主已有解析器，避免扩大零散负向正则。不得跳过含代码或含链接的整篇答案。

真正存在的 reference definition 会使 `[label][ref]` 成为 Markdown 链接，这与没有定义的 `[R1][MISSING]` 不同。合法链接排除只说明它不是平台 citation，绝不提供事实支持或操作回执。若产品要求即使渲染成链接也强制解释为平台引用，需要另行统一语法契约，不能默默混用两种定义。

本30项不是 Markdown 完整一致性证明，未穷尽嵌套列表/引用块、HTML 或所有链接目标语法。分析裁决仍待宿主绑定 reviewer 接口，本轮不加入任何直接 verifier 的广义分析豁免。主线修复后应原样复跑两个冻结文件及既有来源/操作契约测试，不能仅使 scanner 单测绿。
