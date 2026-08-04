# 测试报告: workbench-honest-runner-state

## 门禁

- [硬] npm test: PASS（761）
- [硬] npm run lint: PASS
- [软] qa-plan Smoke Scope: 已执行（对照实现 + 单测）
- [软] code-review: 已完成

## Smoke 结果

| 用例 | 结果 | 备注 |
|---|---|---|
| degraded 无 100% / 无已完成 1/1 | PASS | projection + templates 断言 |
| 三处状态语义一致 | PASS | meta/status/graph 同为详情不可用 |
| 助手不推荐 ingest 输入路径 | PASS | brief classify + agent 上下文 |
| 真产物区仍渲染 run.artifacts | PASS | workbench.js |
| 相对路径解析到仓库根 | PASS | workbench-repo 单测 |
| 未产出友好提示 | PASS | reason=not-generated |
| 内容源设置出口 | PASS | open-sources 按钮 |

## 反模式

- 正常线性图进度：PASS（仍显示真实百分比）
- 同名 brief.md 仅当匹配 inputs 才过滤：PASS（真实产物可保留）
- 目录穿越拒绝：PASS
- 脱敏不过度抹掉无内部路径的正常文案：PASS（looksInternal 才处理）

## 结论

- [x] 通过，可 story-done

证据：evidence/dev-self-test.md、acceptance.md、code-review.md
