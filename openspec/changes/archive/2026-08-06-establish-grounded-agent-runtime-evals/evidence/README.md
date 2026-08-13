# Evidence 目录约定

本 change 实现与 QA 阶段使用以下证据文件（实现前仅为占位说明）。

| 文件 | 说明 |
|---|---|
| `dev-self-test.md` | 开发自测：命令、scenario 摘要、控制台无报错 |
| `eval-report.json` | Conversation eval 结构化结果（dimensions/threshold/passed） |
| `eval-report.md` | 人类可读 eval 摘要 |
| `test-report.md` | 测试 QA 正式报告 |
| `code-review.md` | Code review 结论 |
| `screenshots/` | UI provenance、blocked 状态、事故/happy path 截图 |

生成 eval 报告示例：

```bash
node scripts/agent-eval.js --suite conversation --baseline v1 \
  --out openspec/changes/establish-grounded-agent-runtime-evals/evidence/eval-report
```
