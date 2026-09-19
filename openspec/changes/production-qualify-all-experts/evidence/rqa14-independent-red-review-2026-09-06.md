# RQA14 独立desired-red测试与冻结

日期：2026-09-06。新增独立测试，未修改src、既有测试、QA配置或专家包。无真实API/外部工具副作用、不运行fullcheck、不commit。

## 建议的最小通用行为

1. 仅依据可信provider snapshot.finishReason。明确length表示本次响应不完整，即使句尾有句号；stop不因缺句尾标点被判截断。不使用expertID、领域关键词或标点启发式。
2. 在任何工具dispatch之前判断length；本次未完成响应的整个toolCalls批次不执行，包括参数已能解析的前缀调用。JSON可解析不证明provider已完成调用请求；不能把不完整JSON交给纠参流程后继续执行。
3. 在原任务和已确认工具结果基础上，最多一次禁用工具的FINALIZE完整重写答复；不是拼接半句或重新进入MODEL/TOOL循环。只修复答复，不重放已成功副作用。
4. FINALIZE无论由length、工具预算还是GROUND纠正触发，仍须检查finishReason。再次length不能提交原半成品为完整答案，不能DONE/verified/可验收。保留已有成功工具回执；完成状态/错误码具体命名可由主线决定，测试不强制某个新code。
5. 父取消及FINALIZE取消优先并向上传递，终态仍CANCELLED，不用截断稿或拒绝语替换后返回DONE。

本批测试的交付目标为完整文本答复；并未改变真实artifact已完成但说明失败时的专门降级契约。不得把“答复不完整”扩张为删除真实成果或重做生成操作。stop也仅是生成完成信号，不代表事实/专业正确，仍需既有治理和验收。

## 测试构造

`createMockRunPorts`当前不把llmScript.response.finishReason带进snapshot，因此测试只替换LLM端口：通过真实agent-stream的SSE累积器喂入content/toolCalls及finish_reason，断言snapshot保留原因，再调用真实AgentRunExecutor。覆盖GROUND、工具预算FINALIZE、事件提交与session持久化边界。工具仅为内存计数及mock回执；不调用网络或文件handler。记录模型请求时排除onSnapshot函数，其余参数结构化克隆，防止后续数组修改污染请求证据。

## 红测命令及结果

```powershell
node -r ./scripts/register-ts.js --test tests/rqa14-incomplete-model-response.test.js
```

**12 tests / 2 pass / 10 fail / 0 skip / 0 todo，exit 1。**

| 场景 | 当前结果 |
| --- | --- |
| stop，无句尾标点 | 绿：一次生成，DONE/verified，单次answer.committed |
| length，有完整句号；修复再次length | 红：首轮直接DONE/verified，没有修复 |
| length→stop一次答复修复 | 红：模型请求1次而非2次，旧稿直接交付 |
| length工具批次：合法前缀+截断JSON | 红：进入mock executor dispatch 2次，期望0 |
| length工具批次：完整JSON | 红：dispatch 1次，期望0 |
| 成功工具→length→stop，只修答复 | 红：工具只执行1次，但模型请求2次而非3次，未修复 |
| 成功工具→length→length | 红：首个length摘要DONE/verified，未到修复轮 |
| GROUND纠正→FINALIZE length | 红：第二轮截断稿DONE/verified |
| 工具预算FINALIZE length | 红：截断说明DONE/verified |
| length伴随父取消 | 绿：CANCELLED，无修复 |
| length修复期间取消 | 红：首轮length直接DONE，未抵达取消轮 |
| GROUND FINALIZE期间取消 | 红：取消终态返回值未正确传播，最终result.terminal=DONE |

失败断言保留为desired behavior，没有skip/todo或放宽生产校验。截断参数案例的2次是mock dispatch计数，不等于生产handler一定接受不合法JSON，也不证明真实外部副作用已发生；合法前缀调用及完整JSON案例单独证明finishReason缺少前置门禁。

## 源码定位与既有限制

- agent-stream已保存finishReason；mockports脚本默认丢弃该字段，不能只在fixture里填值而不校验传递。
- MODEL目前取snapshot.toolCalls后直接进入正文/工具分支，没有length分支；FINALIZE也只检查error/cancel/content，不检查finishReason。
- GROUND取得finalizeResponse后继续提取snapshot/核验/提交，未将取消结果作为终态早退。本轮仅测试和报告，不修改该路径。
- 检查的是显式length，不从上一批SE/SA答复半句推断其真实provider finishReason；缺少真实结束原因日志不能凭文字判根因。
- 缺失finishReason、其它provider结束原因及artifact专门降级不属于本批新契约，不将这些测试通过扩张为全部响应完整性保证。
- GitNexus调试技能用于追踪runModelToolLoop→executor和相关边界；query FTS降级，context为下界，新测试及scenario未索引、impact=UNKNOWN。全工作区detect_changes的CRITICAL（305文件、569符号、160受影响）属于共享改动，不归因为这两个新增文件。

## 冻结与SHA256

仅新增 `tests/rqa14-incomplete-model-response.test.js` 和本报告；测试冻结，后续实现由主线负责。

| 文件 | 红测版本SHA256 |
| --- | --- |
| tests/rqa14-incomplete-model-response.test.js | F1B98CDA186BF9D172691265D4F6C93B1E3A9BF96B05AA8F14B679C50C4887C6 |
| src/lib/agent-run-executor/phases-model-tool.ts | 40BB73AA4CC9D0305FDB509CCF3BFDA00C8A0A573F545F6B9867A5C999B4C75D |
| src/lib/agent-run-executor/phases-ground-persist.ts | D892EFF90859ECFCEA6AA72F9F15E86E021E4382E1FF25D43478F756A34633E1 |
| src/lib/agent-run-ports.ts | 7B0254FDFF681E23B7A209B531D13E11242D497FF74C6F8D6A4C7C8D88EED946 |
| src/lib/agent-stream.ts | AFB6B5431A90B0EF9EC11BE777A993CBF4A2670923609DBE4EEC1213CAD67694 |
