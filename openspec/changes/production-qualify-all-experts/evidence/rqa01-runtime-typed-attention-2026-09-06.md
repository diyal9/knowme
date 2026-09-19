# RQA01 runtime typed attention 透传与暂停边界

日期：2026-09-06。仅修改 expert-task-runtime.ts 与本轮已新增的 expert-task-preflight-liveness.test.js；未改 phases-loop、waitForInput 标题、UI、治理、传输或包。

## 结果

联合定向回归 126/126 通过，包含 RQA03 全部 18 项最终用例、本次 9 项用例和既有 runtime/preflight/required-skills/profile 回归。前轮共享治理模块加载阻断在本次运行时已消失；未修改或 shim 该模块。

- provide_input 分支保留上游非空字符串 kind，经原有文本长度规范化，不再一律 missing_information。不对专家 ID、工具名称或 operation_status_unknown 做专用判断。
- operation_status_unknown 的 action 保持 provide_input，题目、详情、核对问题、选项等字段保留，不转 retry、不生成交付物、不把 blockedEvidence=false 或未验证证据解释为成功。
- 缺失、空白或非字符串 kind 使用兼容回退 missing_information；已有不带类型的澄清结果不退化。
- 旧排队输入不能回答后来产生的新核对问题：execute finally 遇到 provide_input 不自动续跑；recoverQueuedTasks 也不恢复该暂停点。材料和 inputQueue 仍保留，收到新的具体用户输入后由原 provideInput 路径继续。
- retry 仍拒绝 provide_input；泛泛“确认”仍被现有输入校验拒绝。正常非暂停的队列续跑、修改和恢复回归通过。

## 红测与修复

新增九项：
1. operation_status_unknown 保留；
2. 另一泛化字符串 resource_unavailable 保留；
3–7. undefined/空字符串/null/数字/对象回落兼容类型；
8. 执行中旧补充已排队时，未知操作结果不能触发自动再生成；
9. 恢复时保留类型与暂停，新的具体核对输入才继续。

修复前：总共 27 项中 23 pass / 4 fail。两种类型被改成 missing_information；排队分支实际再次生成（2 次而非 1 次）；恢复分支自动执行（1 次而非 0 次）。此时 RQA03 18 项均已通过，补齐上一轮最后两项未验断言。

修复后：五个文件联合 126 pass / 0 fail；未使用真实 API、真实长 sleep、UI QA、fullcheck 或 commit。runtime 输出边界测试使用真实 runtime + 实际预检与规范化，生成边界是受控替身，不声称再次覆盖主线真实 phases-loop 网络场景。

命令：

```powershell
node -r ./scripts/register-ts.js --test tests/expert-task-preflight-liveness.test.js tests/expert-task-tool-preflight.test.js tests/expert-task-runtime.test.js tests/expert-required-skills.test.js tests/expert-execution-profile.test.js
```

node scripts/lint.js 通过（现有 renderer spec 1343 行 advisory warning）；定向 git diff --check 通过。红绿完整日志见 rqa01-runtime-typed-attention-2026-09-06.json。

## GitNexus / 技能影响

完整阅读 gitnexus-debugging、gitnexus-impact-analysis，重新 query/context/impact。execute 为 UNKNOWN、partial/lower-bound；context 指向 createStart、provideInput、retry、reviewDeliverable。recoverQueuedTasks 图中未找到，impact UNKNOWN。query FTS 降级，没有可用流程资源可据以声称覆盖。

这些技能促使额外检查排队和恢复调用边界，红测证实仅保留 kind 仍会被自动续跑绕过，因而修复同一 runtime 的两条暂停守卫。没有扩大到上游工具策略或 UI。

detect_changes(scope=all)：297 文件、550 changed symbols、160 affected，CRITICAL；属于并发脏工作区全量扫描，不可当成本次两文件的独立风险评级。未忽略该共享风险，也未修改无关文件或执行提交。

## 最终 hash / main 检查边界

本次 runtime/tests 在 41442 及前轮 hash 之后再次变化；最后一次 126 项定向回归覆盖以下源码版本。仅证据文件在其后落盘。

| 文件 | SHA256 |
|---|---|
| src/lib/expert-task-runtime.ts | 07F1E01BBE2B04775D7D4C34FC7D5D871E7FDAD119B4E4CAD8CB76A8CAC2CEF1 |
| tests/expert-task-preflight-liveness.test.js | 77FA8A3627602457DD3B9A3695E8930E2F13EA8EA729D4554E16B4C59DDA43A9 |
| src/lib/expert-task-tool-preflight.ts（本次未改） | F89C3DE9F89A5B21119D0F4D6BE6F0C3F10C77912E45C6CF6B180806275E07B9 |
| src/lib/expert-task-preflight-wait.ts（本次未改） | 17E3497A7920AB94D7D3637C5152AC758679170AC3B403D17B96563B05EB70F7 |

原诊断脚本 SHA256 仍为 8D3175FC3FC191CC70804DE051AF17B01F8176BC5507207C6EBCFDEA748DC443，保持不改。RQA03 的宿主脱离等待仍不代表底层请求已停止。

