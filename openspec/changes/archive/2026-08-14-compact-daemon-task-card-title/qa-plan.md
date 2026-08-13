# QA Plan: compact-daemon-task-card-title

## Smoke Scope（必填）

- [ ] 管线服务 → 全部任务：含飞书 URL 的 intent 卡片主标题为短摘要，不是整段 URL
- [ ] 短 intent 任务卡片标题仍可读（如验收冒烟类文案）
- [ ] 悬停卡片仍能看到完整 intent 线索

## Regression Scope

- 状态筛选 / 搜索仍可用
- 选中卡片打开右侧审阅不受影响

## Anti-pattern Checks（交给测试）

- 标题是否仍像「粘贴墙」
- 是否误把 slug 当唯一主标题（有短 intent 时）
