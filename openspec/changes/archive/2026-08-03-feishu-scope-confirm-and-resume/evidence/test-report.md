# 测试报告: feishu-scope-confirm-and-resume

## 门禁

- [硬] npm test: PASS（758）
- [硬] npm run lint: PASS
- [软] qa-plan Smoke Scope: 已执行（自动化 + 静态预览；真人扫码为 ADVISORY）
- [软] code-review: 已完成

## Smoke 结果

| 用例 | 结果 | 备注 |
|---|---|---|
| 补充权限弹出确认面板 | PASS | DOM + 预览截图 |
| 取消不打开浏览器 | PASS | 代码路径 |
| 未确认时不假成功 | PASS | baseline/signature 单测 |
| 对话深链不报不允许的协议 | PASS | 拦截顺序单测 |
| 非法 scope 降级仍可发起 | PASS | `startFeishuAuth` 端到端 |
| 全分区 missing_scope → CTA | PASS | feishu-cli / grounding 单测 |

## 反模式发现

无 BLOCKING。ADVISORY：真人扫码后续跑建议用户本地再验一次。

## 结论

- [x] 通过，可 story-done

证据目录：evidence/screenshots/、evidence/dev-self-test.md
