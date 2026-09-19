# RQA18 代码字段保留复核：仍有 HTML 残余

2026-09-06。只新增本报告与 `tests/rqa18-code-field-preservation.test.js`；不修改生产、旧测试、原始模型数据。未跑 fullcheck/API/QA/Electron。主线292绿和fullcheck15403不冒充本次新增测试的覆盖。

## 实际结果与冻结

- 新32项：**23 pass / 9 fail / exit 1**，无跳过。文件 SHA256 `A44C97D0B85E6C8982476BE2DEB807528982883F4E584B39B571F5430C655C13`，运行后再核对未变。
- 既有定向回归：**178/178 pass / exit 0**。包括原RQA18三个引用文件，以及 RQA12 claim-source-review、tool-source-body，RQA13 review-assessment-boundary，RQA17 diagnostics及types。没有通过删改旧断言转绿。
- runner 均为 `node -r ./scripts/register-ts.js --test <指定文件>`。尾部零项包装汇总不代替实际测试数。
- 源码绑定：citation helper `3D7DD96C0600AAEEA58918D2A5AF71F8B2F0E6B21873625D3948CE67E8186A33`；claim-source-check `914B727AED3B651F59D7E86E8F2723C04E9497B69BB060576540EE107507FA69`。这是本次核查版本，不自动覆盖后续并行改动。

## 已确认修复有效

Markdown 行内代码值、整字段行内代码、反引号和波浪围栏中的已知/伪造 owner、date 全部按预期核验；每条都要求 fieldChecks 保留恰好一个字段及正确值，不仅检查 passed。源材料的代码格式也能支持同值普通字段。代码内 `[MISSING]` 仍不被提升为引用，已知代码字段仍不能满足缺失 requiredTools。

这保留了原直接文本字段扫描的保守约束，不把整块代码当通用假设/建议豁免，也不宣称当前已具备语义裁决能力。

## 未关闭的问题

| 类别 | 实际结果及影响 |
|---|---|
| P1：HTML pre/code 抹掉整个字段（4红） | `<pre><code>负责人：赵强。</code></pre>` 实际 `passed=true / fieldChecks=[]`；日期同类。已知值也没有字段诊断。`includeCode:true` 没有传到 HTML pre/code 排除路径，不能称代码字段保留完整。 |
| HTML 内联标签插入字符时空格错误（3红） | `李<span>明</span>` 被变为 `李 明`；日期变为 `2026- 09 -10`，已知值误拦截。伪造姓名仍阻断，但记录成错误的含空格值，故精确字段断言红，不能把该项夸报为错误放行。 |
| HTML 标签插在字段名与冒号之间（2红） | `负责人<span>：</span>赵强。` 实际 `passed=true / fieldChecks=[]`。标签替换空格导致固定标签正则不匹配；已知 owner 同样消失。 |

对照采用**内存受控替换**：读取当前模块，只把 labelledClaims 的 `markdownCitationProse(...includeCode:true)` 恢复为原直接 `String(text || '')` 切分，其他逻辑保持当前，未写盘。pre/code 伪造 owner 在该对照中存在并 unresolved，当前却消失，确认是新增 projection 弱化。标签/冒号分隔在对照中本来也漏识别，值内标签在对照中本来也不匹配；这两类是当前 HTML 规范化尚未解决的缺口，不能称全部是此次引入。此实验不是恢复并运行完整历史源版本，不声称有历史整仓hash证明。

## 最小建议与收尾状态

区分 citation projection 与字段 projection 的 HTML code 策略；后者保留文字内容用于字段检查。内联标签不能无条件插入空格，块级结构则需要保留边界，不能简单全局删空白而合并不同字段。继续保留注释/属性非正文、引用默认忽略代码以及独立工具/操作门禁。由主线修改生产，本代理不修源。

**当前不能报告最终全部定向绿：178项既有回归绿，新32项仍9红。** 测试已冻结，主线修复后可直接原样复跑。

语义报告措辞另核对：`rqa18-semantic-shadow-review-2026-09-06.md` 第93行现已写明既有用户目标授权范围内后续实验、并非另行申请权限；没有剩余“另行授权”阻塞措辞，因此不再覆盖 Arendt 已修内容。此处只核对措辞，未重新评分语义实验。

## 后续 HTML adjacency / hidden stack 补丁复跑（保留上节红测历史）

主线后续 helper SHA256 `D4837A36F780EEC0703386706D7E92242984312B093DA2CFEAAEF985F9178377`：冻结32项与此前84项 **116/116通过、exit 0**，四份测试 hash 均未改变。此前9红已在此版本关闭，不能再作为当前未修项报告。

另新增 `tests/rqa18-html-local-scope.test.js`，SHA256 `87CBC9BFA6E8AA6C1EA6308AB12258A19FD533B7EC446D35D795D3A86C6EDF88`，真实 **16项 / 15通过 / 1失败 / exit 1**。要求的默认 inline code 引用排除、同段外部未知引用拦截、p/div/br/table 字段分隔、源HTML日期与plain/HTML/Markdown-code答复一致，以及伪日期阻断均通过。

唯一新残余：`开始<code>[HIDDEN]` 后空行，再写 `</code>材料[MISSING]。`。`markdownCitationProse` 在 hidden 状态下跳过整个新 paragraph，没遍历其子节点关闭 HTML code，导致外部 MISSING 不被扫描。普通同段、独立起始 code 跨段和 pre/code 之后的控制均绿，状态也未泄漏到下一次独立调用。

最小建议：隐藏期间仍遍历容器结构，以消费其中关闭标签；维持隐藏文字不输出。不要通过全局清空 hidden、把整个容器放行或放宽 citation gate 转绿。这里没有实现生产变更。该版本的最终状态是 **116项旧回归绿 + 新16项剩1红**，待主线修复后原样复跑；仍未运行实际 Electron/QA/fullcheck。
