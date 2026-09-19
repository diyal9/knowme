# RQA14 独立边界复审

日期：2026-09-06。仅新增本报告，不修改 src、测试、专家包或既有报告；不运行 API、Electron、QA profile、fullcheck，不 commit。

## 结论

原 pre-tool over-cap FINALIZE 的 P1 已关闭：原 26 条测试全部通过。新增预算测试当前 8/9 通过，合跑 **35 tests / 34 pass / 1 fail / exit 1**，不能宣称预算边界全部通过。

历史证据：旧 model-tool SHA256 `e02a13d27211557223e4e1c7bd119154dbc1810783a50e336ad11296f8952cc8` 上，预算 1 次、模型返回文字及 2 个工具调用，FINALIZE 的 length/max_tokens/异常工具调用均使旧草稿 DONE/verified；取消甚至产生 CANCELLED→GROUND→PERSIST→DONE。独立测试当时 10/14 过，4 条真实红测。

本次 `src/lib/agent-run-executor/phases-model-tool.ts:458` 调用后，第 459–460 行先传播 cancelled 和 model_response_incomplete，与第 848 行后分支保持一致。上述 4 条现均通过，异常不提交正文、不持久化、工具调用数为 0。

## 其它边界

- 正常 null finishReason 兼容；max_tokens→完整答复可只修复一次；反复截断拒绝成果，不增加第三轮。
- FINALIZE 不提供工具，异常返回工具调用不能执行；GROUND 修复的 incomplete/cancelled 传播仍有效（ground-persist:160 起），不把截断稿提交为成功。
- artifact_ready 的截断、异常工具返回、provider error 均保留成功工具的 fixture artifact，使用事实摘要，不重复副作用；取消不提交成功摘要，成功工具 ledger 保留。取消结果本身没有 artifactRefs 接口，不据此声称已验证取消后的实际文件恢复。
- 以上 artifact 均为内存端口夹具，不是实际图片解码、外部回执或真实 UI 验收。

## 新预算边界未决

`src/lib/agent-run-executor/phases-model-tool.ts:213`：

```js
Math.min(policy.maxOutput || 2400,
  reason === 'incomplete' ? Math.max(2400, (policy.outputTokens || 1200) * 2) : 2400)
```

默认 2600/8192 得到 5200；2600/3000 得到 3000；4096/4096 保持 4096。扩展仅限 incomplete，GROUND、budget、artifact 的 2400 上限未改，共享 policy/inputBudget 未被修改，相关断言通过。

唯一失败：`tests/rqa14-repair-budget.test.js:64`，800/10000 得到 2400，超过测试定义的 `min(2×800,10000)=1600`。这是现有 2400 下限与新“两倍上限”测试契约不一致；没有超过 maxOutput，也没有证明取消或截断门禁失效。待主线/Arendt 收敛策略及测试，不在本复审修改其文件。5200 是默认 2600 的两倍，不是当前公式对所有配置的绝对上限。预算增大不能保证真实模型一定完整输出，仍须保留第二次截断失败门禁。

## 可复跑命令

```powershell
node -r ./scripts/register-ts.js --test tests/rqa14-completion-edge-review.test.js tests/rqa14-incomplete-model-response.test.js tests/rqa14-repair-budget.test.js
```

## 版本绑定（SHA256）

| 文件 | SHA256 |
| --- | --- |
| src/lib/agent-run-executor/phases-model-tool.ts | 864215D221451D4154D5C4589EB87DB7A5E5E2C293F3DE94AAD72F5289980F84 |
| src/lib/agent-run-executor/phases-ground-persist.ts | F26E2A7D2558AACB7D4F06B58BEC3DFDA8BEF74F272C986BEAE53BAED13A232C |
| tests/rqa14-completion-edge-review.test.js | 4B37EEF684BC8FE165243B1A388F40EB1675A569660394A61BE8E3972CB3131B |
| tests/rqa14-incomplete-model-response.test.js | F1B98CDA186BF9D172691265D4F6C93B1E3A9BF96B05AA8F14B679C50C4887C6 |
| tests/rqa14-repair-budget.test.js | 87F0ACA75C23C6602B5C771979C09F010A5E414D37D396DBC023A9AD0853649D |

遵循 GitNexus debugging：query 因 FTS 未安装无有效流程，context 为 lower-bound 且不反映当前行号；fallback 为当前源码调用点手查与真实 executor/内存 ports 测试，不把索引视为完整性证明。本轮不改符号；沿用主线已报告 finalizeResponse HIGH 风险，不作影响降级判断。
