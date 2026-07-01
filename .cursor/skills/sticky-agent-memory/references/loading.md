# 会话加载顺序

复杂任务开始前：

## 1. 解析路径

```bash
npm run memory:path
```

## 2. 渐进读取

| 顺序 | 文件 | 用途 |
|------|------|------|
| 1 | `<root>/bootstrap.md` | sessionStart 生成；pending + 近期指正 |
| 2 | `<root>/index.md` | 确认根路径 |
| 3 | `<root>/profile.yaml` | 输出偏好（若有） |
| 4 | `<root>/working/recent.jsonl` | 末 20 条高价值 |
| 5 | `<root>/summaries/daily/<today>.md` | 当日摘要 |
| 6 | `<root>/patterns/pending_prompts.jsonl` | ≥3 次待询问 |
| 7 | 用户提到历史 | 搜 weekly / monthly |

团队长期知识：**另读** `brain/knowledge/index.md`（不替代个人记忆）。

## 3. 与 OpenSpec 边界

- 记忆中的 change 名仅作**提示**，以当前 `openspec list` 为准
- 记忆口径与 OKF spec 冲突 → 并列差异，以 spec 为准

## 4. 回合末

- 高价值指正：Hook 通常已写 working
- 见 pending → [promotion.md](promotion.md)

## 5. compaction 前

Hook `preCompact` 触发 rollup；关键指正未入库时 Agent 应主动摘要到 working。
