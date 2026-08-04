# Design: game-studio-work-partner-daemon

## Architecture

```
用户（游戏行业）→ 任务场景 UI（game-design/dev/qa/production）
    → assistant-prompt-router（industry=game 时路由）
    → Skill/Expert 运行时（catalog bundled skills）
    → 结构化需求案（game-requirement.js）
    → Workbench handoff（game-workbench-handoff.js）
    → workbench-daemon-client（真实 HTTP 契约）
```

## Key Decisions

1. **Legacy agentId 兼容**：general/steward/writing/coding 映射到四类游戏场景，不删除 Session 字段。
2. **诚实 Daemon**：`assessDaemonReadiness` 在 handoff 前检查；offline/auth_required 时 blocked=true 并返回 recovery 步骤。
3. **飞书审批**：需求 artifact 保留 `allowFeishuDraft` 与现有 artifact 审批 IPC，不新增绕过路径。
4. **单一身份**：UI 文案统一为「KnowMe 工作伙伴」，场景按钮展示任务名而非 Skill ID。

## Modules

| 模块 | 职责 |
|------|------|
| `game-studio-scenes.js` | 场景解析、legacy 映射、prompt 策略 |
| `game-requirement.js` | 需求案结构、校验、artifact |
| `game-workbench-handoff.js` | Daemon 就绪评估、workflow 选择、handoff payload |
| `catalog/*` | bundled skills + game-studio-partner expert |

## IPC

- `game-studio-scenes` / `game-requirement-build` / `game-requirement-approve` / `game-workbench-handoff`

## Testing

- 单元：scenes、requirement、handoff、prompt-router
- 契约：daemon client 已有测试复用
- UAT：Playwright 静态预览 + Electron 真机（证据标注）
