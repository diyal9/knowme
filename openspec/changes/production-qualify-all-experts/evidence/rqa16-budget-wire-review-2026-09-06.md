# RQA16 生产修复预算接线：独立红测

2026-09-06。本轮只新增`tests/rqa16-production-repair-budget.test.js`及本报告；未改生产源码、既有测试、包、原始任务或N/A记录。无API、QA、用户APPDATA、fullcheck或commit。使用gitnexus-debugging；query仍FTS降级，context命中buildProductionRunPorts、三个直接调用方，epistemic=lower-bound、processes=[]，以源码核实。主线已另完成并告知HIGH impact（6 symbols / 3 direct / 3 processes），本轮未把该结果冒充自己的完整图谱结果，也未修改被分析的生产符号。

## 首次旧源实际结果

命令：`node -r ./scripts/register-ts.js --test tests/rqa16-production-repair-budget.test.js`

**23 tests，12 pass / 11 fail，exit1，skipped=0，cancelled=0。** 首次创建后直接执行，没有先修fixture、没有放宽断言。红测完成即通知主线可以开始生产修复；本文件冻结后不再改测试。测试取消场景本身成功，不等于Node runner取消测试。

| 分组 | 数量 | 旧源结果 |
|---|---:|---|
| 两种参数各测800→1600、2600→5200、3200→6400、2600→cap3000 | 8 | 全失败；FINALIZE body实际值均2400 |
| 两种参数各测600→cap1000、512→cap512 | 4 | 全通过，小cap已能保持 |
| grounding / budget / artifact / repeated最终收敛2400 | 4 | 全通过，工具次数符合预期 |
| 工具成功后MODEL length→FINALIZE | 1 | 失败于2400≠5200；此前的单次执行、工具凭据保留及answer-only断言通过 |
| FINALIZE再次length / max_tokens | 2 | 失败于2400≠5200；此前ERROR、不提交、不持久化、不第三次调用断言通过 |
| FINALIZE返回tool_calls / 修复传输处取消 / 首次前取消 / 首次正常stop | 4 | 全通过 |

因此11个失败都是预算wire断言，不能把其中二次length用例记为“已有截断拦截失效”。测试输出末尾还出现register-ts父进程after-hook的0-test汇总；目标测试文件实际报告23项、12/11，不能取最后0项误报未运行。

## 穿透层级与防假阳性

测试直接构造真实`buildProductionRunPorts`，再调用真实`AgentRunExecutor.run`。保留真实context、LLM adapter、工具adapter、会话合并/持久化逻辑与stream parser。唯一请求替身是注入的`requestAgentCompletion`：捕获adapter已经构造完的`body`，通过有限脚本返回stream parser解析后的snapshot；从未替换`ports.llm.complete`，不存在在测试中自行把policy写成max_tokens的捷径。

- 同时断言初次body和FINALIZE body，分别覆盖`max_tokens`和`max_completion_tokens`，另一参数必须不存在；模型名、stream保留，共享policy不变。
- FINALIZE无tools、无tool_choice、保留原始用户输入。工具后修复检查已有tool receipt仍在消息中，工具只执行一次；返回的新tool_calls不执行。
- 正常完成确实DONE并持久化完整替换正文；二次截断/取消无answer.committed、无run.completed、无答复持久化。
- 请求signal与原controller一致。提前abort零请求；修复transport内abort后返回cancelled，断言终态CANCELLED。无真实sleep或网络。
- transport脚本越界或fixture断言失败会另收集错误并使测试失败，避免executor捕获异常后让“应阻断”用例假绿。
- 所有tool effects、session读写均内存替身；finally清理测试run的registry绑定。只有budget场景包装真实context结果补充maxRounds=1/maxToolCalls=1，用于有限触发该路径；不重写policy或LLM端口。

## 指纹、范围与交接

红测后立刻读取的SHA256：

- 新测试：`CB3683BF21E8FF8D560896BD8C34BC6A54CDEECF37998B2D70BA3BE384551393`
- 旧production adapter：`BCFA56EEABBAE0A2B4BF8DA815503F1C2646E804AE0011D788D16BA247B2B50D`
- 当时model-tool：`0BBA6FE97FFB082E0D792C31AFBE5B88D00372E6FEC567D584B2C9D8CC35E2BC`。不同于上轮诊断的6706778；本轮读到的incomplete策略仍为min(maxOutput,2×outputTokens)，不把旧诊断hash倒填到本轮。共享工作区可能并行更新，以上明确是红测后即时指纹。

尚未运行修复后绿测，不预填23绿。主线修改生产后，应保持本测试hash不变重跑，并记录新adapter hash；若另需更改测试，应保留本首次红测历史。

覆盖边界：测试从已经准备好的policy开始，不包含prepare的模型路由/设置解析、真实HTTP序列化库/供应商接受参数、实际token消耗或UI任务重试；有限abort回执不证明永不返回的底层传输已停止。未新增缺省/非法policy字段的通用校验要求；本轮目标是正确转发受信任的resolved预算，并保持已有收敛与执行安全边界。共享入口的其它回归由主线按impact安排；23项不能取代fullcheck或专业验收。所有SA原始N/A及UR阻断结果原样保留。

## 追加：按主线接口提议补充六项直调边界，重新冻结

首次23项记录及hash以上原样保留。主线随后授权补充req额度缺省、req/base cap大小关系；因此仅在本轮新增测试文件末尾追加六项，不改原23项或生产符号，不扩展题外invalid-policy处理。

两次运行追加后的旧源测试均exit1；第二次保留过滤后的完整计数：**29 tests / 15 pass / 14 fail / skipped0**。adapter仍为旧SHA `BCFA56EEABBAE0A2B4BF8DA815503F1C2646E804AE0011D788D16BA247B2B50D`。六项均直接调用真实ports.llm.complete并捕获requestAgentCompletion.body；不自行模拟预算映射：

| 边界 | 期望 | 旧源实际 | 结果 |
|---|---:|---:|---|
| finalize缺req outputTokens | 2400 | 2400 | 过 |
| 初次缺req outputTokens，base=2600 | 2600 | 2600 | 过 |
| finalize额度5200，req cap16000/base cap3000 | 3000 | 2400 | 失败 |
| 初次额度5200，req cap16000/base cap3000 | 3000 | 5200 | 失败 |
| finalize额度5200，req cap1000/base cap8192 | 1000 | 1000 | 过 |
| 初次额度5200，req cap1000/base cap8192 | 1000 | 5200 | 失败 |

所有直调用例同时检查req parameter=max_completion_tokens优先于base max_tokens、无重复参数、temperature=0.3保持、无工具字段及policy不变。主线拟采用“本轮额度优先；finalize缺额度回退2400；cap取req/base较小者”的方案与这些断言一致，尚未据此宣称生产已绿。

最终冻结测试SHA256：`20715A4416A9968354BA2AAB3424AAB8427F7EFAA26732B51096F98F9A6E237E`。已再次通知主线可开始patch；本次补充后未再改测试。29项中23项穿过executor+adapter，6项是直接adapter边界，明确不把后者称为完整executor链。源码修复与绿测尚待主线，原N/A任务仍保留。

## 追加：主线修复后的独立绿测及源码复审

2026-09-06，主线预算补丁落地后，以原命令独立复跑冻结文件：**29 tests / 29 pass / 0 fail / exit0；skipped=0、cancelled=0**。本轮未修改任何测试或生产源码，仅追加本节。此前23项12/11、29项15/14两轮旧源红测均保留，不覆盖历史。

本轮指纹：

- 测试仍为 `20715A4416A9968354BA2AAB3424AAB8427F7EFAA26732B51096F98F9A6E237E`，与冻结时一致。
- 修复后adapter：`365C148C17FED946C3CED093257D12A41F975065B57D67C43CC791BFB679709A`。
- model-tool：`0BBA6FE97FFB082E0D792C31AFBE5B88D00372E6FEC567D584B2C9D8CC35E2BC`，与红测后记录一致。

**独立核实修改范围**：当前git diff相对HEAD包含此前其它工程修改，不能一并归为RQA16。本轮仅读取当前adapter，在内存中去除三行说明注释与两个新增预算变量，并将body预算字段还原为旧三元表达式；重算整文件SHA256恰为红测旧值`BCFA56EEABBAE0A2B4BF8DA815503F1C2646E804AE0011D788D16BA247B2B50D`。没有磁盘回写。这证实相对实际红测文件，本次只变动所述预算局部及body字段，没有夹带温度、工具、信号、会话持久化或材料接线变更。

源码复审（`agent-run-kernel-adapter.ts:218-225`）：

1. outputTokens先取本轮reqPolicy.outputTokens，因此executor的800→1600、2600→5200、3200→6400不再被finalize分支2400覆盖；两种预算参数的最终transport body已实测对应精确值。
2. maxOutput取req/base有效上限的较小者，body再取额度与该cap的较小者。较大req cap不能放宽base cap；较小req cap仍生效，初次请求同样钳制。cap3000、1000、512均经最终body验证。
3. 本轮无额度时，finalize兼容回退2400，初次回退base outputTokens；随后仍经过双重cap。不是无条件赋2400，也没有以base常规额度覆盖显式修复额度。
4. parameter仍优先req，否则base；不同时发两个预算字段。没有修改现有温度、stream、tool_choice、signal和完成状态处理。其它grounding/budget/artifact/repeated收敛保持2400；不重放、二次length阻断、取消和正常stop的冻结断言均绿。

结论：**在本轮受信任resolved policy的有效正数约定内，RQA16生产预算接线缺陷已关闭，未发现需要阻止该局部补丁的新增问题。** GitNexus复查仍FTS降级、context lower-bound，未将结果夸大为共享入口的完整安全证明。

残余与非结论：`||`仍沿用既有falsy回退语义，并不是对0/负数/非数值的通用验证器；本任务明确不扩展invalid-policy处理。完整reqPolicy缺失、单侧cap缺省等分支从源码可解释，但本套六个直调用例不是它们的逐项动态穷举。29绿不覆盖prepare路由/实际模型cap配置、真实供应商请求接受/完成率、挂起传输彻底取消或全部共享调用方；本轮未跑API、QA或fullcheck。SA原N/A和UR来源检查问题不会因预算绿测被改判；真实重试及其专业评审仍由主线另行进行。
