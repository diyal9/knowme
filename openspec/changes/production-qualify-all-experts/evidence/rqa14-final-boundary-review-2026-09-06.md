# RQA14 最终工程边界复核

日期：2026-09-06。结论：**当前指定源码版本独立合跑 35/35 通过，exit 0；旧版唯一小预算失败已转绿。** 本轮仅新增本报告；未改 src/tests/其它文档，未运行 fullcheck、API、真实模型、UI 或安装操作。

## 独立执行

仓库：`D:/aispace/knowme`。

```powershell
node -r ./scripts/register-ts.js --test tests/rqa14-completion-edge-review.test.js tests/rqa14-incomplete-model-response.test.js tests/rqa14-repair-budget.test.js
```

实际结果：tests=35、pass=35、fail=0、cancelled=0、skipped=0、todo=0，exit=0；测试统计 duration_ms=440.0669。日志执行时间为 2026-09-06 07:47:54（Asia/Shanghai）。

| 测试文件 | 结果 |
|---|---|
| rqa14-completion-edge-review.test.js | 14/14 |
| rqa14-incomplete-model-response.test.js | 12/12 |
| rqa14-repair-budget.test.js | 9/9 |

## 边界结论

- 当前 incomplete 修复预算为 `min(maxOutput || 2400, (outputTokens || 1200) * 2)`，已移除该分支的 2400 floor。800/10000 按源码得到 1600；对应两倍/cap 用例通过。2600/8192、2600/3000、4096/4096 也通过；不改共享 policy/inputBudget。GROUND、budget、artifact 收敛原有 2400 策略保留，不能把此次改动说成移除全部 2400 限制。
- 明确 length/max_tokens 只允许一次无工具答复修复；再次截断或 FINALIZE 意外工具调用不得提交为 DONE/verified，不增加第三次模型调用。正常 stop/null 兼容，不凭句号判断完整。
- pre-tool over-cap 及后续 budget FINALIZE 均先传播 cancelled/model_response_incomplete，不能用旧草稿兜底成功；GROUND 修复亦保留取消/不完整门禁及完整契约核验。
- 已成功副作用不重放。artifact_ready 的说明失败可保留真实回执支持的 fixture artifact 并输出事实摘要；取消不能提交成功摘要，成功工具 ledger 保留。

以上通过的是实际 executor + 内存 provider/tool/persistence 端口测试，不是外部产物真实性、真实取消后文件恢复、UI 或专业质量验收，也不证明方法 L1 已加载。主线报告的 fullcheck27881 exit0 为主线结果，本轮未独立重跑。

## 历史结果与版本绑定

此前 Pasteur 的 **34/35、exit1** 是 `evidence/rqa14-completion-edge-followup-2026-09-06.md` 中绑定旧 model-tool SHA256 `864215D221451D4154D5C4589EB87DB7A5E5E2C293F3DE94AAD72F5289980F84` 的历史结果：800 输入预算仍被抬至 2400，超过两倍上限1600。该结果保留有效历史意义，**不是当前 6706778… 版本仍失败**；旧报告未覆盖或修改。

下列 hash 在本轮测试前后均一致：

| 文件（仓库相对路径） | SHA256 |
|---|---|
| src/lib/agent-run-executor/phases-model-tool.ts | 6706778DFE5DDBC54D4693AAADE06E845B75950BEB98F1395ABA08B5348F62E7 |
| src/lib/agent-run-executor/phases-ground-persist.ts | F26E2A7D2558AACB7D4F06B58BEC3DFDA8BEF74F272C986BEAE53BAED13A232C |
| tests/rqa14-completion-edge-review.test.js | 4B37EEF684BC8FE165243B1A388F40EB1675A569660394A61BE8E3972CB3131B |
| tests/rqa14-incomplete-model-response.test.js | F1B98CDA186BF9D172691265D4F6C93B1E3A9BF96B05AA8F14B679C50C4887C6 |
| tests/rqa14-repair-budget.test.js | 87F0ACA75C23C6602B5C771979C09F010A5E414D37D396DBC023A9AD0853649D |
| openspec/changes/production-qualify-all-experts/evidence/rqa14-completion-edge-followup-2026-09-06.md | DB7EBE94EF940CCF4F4A3E50A5EE41A1E8B08F1903CFBC9C85E4E6C74E1F628A |

遵循 GitNexus debugging：query 因 FTS 不可用降级为空，finalizeResponse context 为 lower-bound、processes=[]；因此以当前源码调用点与独立定向运行复核，不把旧索引视为完整性证明。未改符号，不新增影响降级判断。
