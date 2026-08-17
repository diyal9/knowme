---
name: gate-check
description: >-
  执行 Story 完成门禁：npm test、lint、qa-plan、code-review 检查。
  触发词：/gate-check、门禁、gate check。
---

# 门禁检查（Gate Check）

## 输入

- change 名称（可选，从上下文推断）

## 检查项

### 硬项 [BLOCKING]

```bash
npm test
npm run lint
npm run test:renderer
```

任一项失败 → **BLOCKING**，不得 `/story-done`。

### 软项 [ADVISORY]

在 `openspec/changes/<name>/` 检查：

| 文件 | 条件 |
|------|------|
| `qa-plan.md` | 存在且 **Smoke Scope** 非空 |
| `code-review.md` | 存在且含结论 |

软项缺失 → **ADVISORY**，记录警告，用户确认后可推进。

## 输出

```markdown
## 门禁检查：<change-name>

**门禁名称**：Story 完成门禁  
**触发时机**：/story-done 前

| 检查项 | 级别 | 结果 | 证据 |
|--------|------|------|------|
| npm test | 硬 | PASS/FAIL | ... |
| npm run lint | 硬 | PASS/FAIL | ... |
| qa-plan + Smoke Scope | 软 | PASS/WARN | path |
| code-review | 软 | PASS/WARN | path |

**结论**：✅ 可推进 / ⛔ BLOCKING

**失败处理**：
- 硬项失败 → 必须修复
- 软项警告 → ADVISORY，记录原因
```

## 证据路径

- 测试报告：`openspec/changes/<name>/evidence/test-report.md`
- 截图：`openspec/changes/<name>/evidence/screenshots/`
