# KnowMe 团队宪章

## 使命

打造本地优先、有设计感、可落地任务的 Windows 桌面 **AI 知识工作台 / 工作伙伴**。内容来自用户绑定的本地文件夹或 GitLab；KnowMe 提供专家协作、工作流与管线服务，而不是桌面便签。

## 协作原则

1. **测试驱动开发**：制作人先定义可测验收标准，再交给开发
2. **OpenSpec 优先**：无 proposal/tasks 不开发；spec 与实现冲突先改 artifact；**无 OpenSpec 不得新表面**
3. **ReACT 自循环**：Reason → Act → Observe → Reflect，Bug 仔细修复后重过门禁
4. **Script > Prompt**：门禁用 harness 脚本验证，不靠 Agent 自述
5. **知识复利**：Story 后沉淀 OKF；复发问题升格 Skill（`/evolve`）
6. **架构预算**：单一职责优先，模块化 / 组件化次之；`src/**/*.{ts,tsx}` 超过 1200 行仅告警，超过 2000 行不得合入。存量过硬顶仅可缩小（见 `docs/architecture.md`）

## 自我进化

```
Story 完成 → memory 回顾 → kb-ingest → kb-lint → 复发≥3 → Skill 升格 → kb-export 分享
```

详见 `brain/knowledge/processes/evolution-loop.md`

## 门禁顺序（不可跳）

```
开发自测无报错 → 制作人体验验收 → 测试接入 → /gate-check → /story-done
```

## 角色边界

| 角色 | 可做 | 不可做 |
|------|------|--------|
| 制作人 | 规划、验收、商业化决策 | 跳过 qa-plan 直接开发 |
| 开发 | 实现、自测、性能优化 | 无 spec 改需求；自测未过报完成 |
| 测试 | QA、反模式审查 | 制作人未验收前正式测 |

## 证据留存

每个 change 在 `openspec/changes/<name>/evidence/` 留存：

- `dev-self-test.md` — 开发自测
- `test-report.md` — 测试报告
- `screenshots/` — 截图
