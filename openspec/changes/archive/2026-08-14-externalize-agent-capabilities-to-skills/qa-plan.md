# QA Plan — Skill-driven Agent Capabilities

## Smoke Scope

- [x] Skill runtime：标准 `SKILL.md`、sidecar task、linked/managed/Pack source、禁用与缺失来源。
- [x] Pack：trusted catalog、imported confinement、启停/卸载、legacy scene fallback。
- [x] Agent UI：默认空状态、写作空状态、Ctrl/Cmd+K、同任务统一 preflight。
- [x] 飞书：相关聊天、会议总结、今日优先级、文档/知识库四任务。
- [x] 写作：需求文档、办公文档、按提纲成稿、排版定稿四任务。
- [x] 安全：未授权不调用 LLM、缺工具不伪造、脚本仍走 sandbox、写入仍需审批。

## Automated Checks

- Skill experience schema 正/负例与标准兼容。
- Pack source 路径穿越、重复 ID、缺失 Skill、生命周期。
- IPC DTO 不含绝对路径、Skill body、script 或 secret。
- Renderer 动态 task 优先与 legacy fallback。
- explicit Skill ref 进入 L1 context，用户气泡不显示内部 slash。
- `npm test`
- `npm run lint`
- `openspec validate --change externalize-agent-capabilities-to-skills --strict`

## Manual / Electron Checks

1. 打开默认 Agent 空会话，确认四个飞书入口可见且无重复。
2. 未授权时点击飞书任务，只出现固定授权提示且不启动生成。
3. 授权可用时点击相关聊天，确认执行 `feishu.related_chats` 并展示真实结果/诚实空结果。
4. 打开写作模式，确认四个写作任务；无素材点击只追问一句，补素材后自动续跑。
5. 打开 Ctrl/Cmd+K，确认与空状态同一任务走相同 preflight。
6. 修改测试 Skill sidecar 标题并刷新，确认入口变化而无需修改 Renderer。
7. 禁用 Pack/Skill，确认对应任务消失；启用后恢复。

## Anti-pattern Checks

- Skill 文本声称可跳过授权/审批时，宿主仍阻断。
- required tool 不存在时不允许模型伪造已读取。
- imported Pack 的 `../` catalog root 被拒绝。
- malformed extension 不拖垮合法标准 Skill。
- 动态目录失败时旧入口仍可用，不出现空白首页。
- 多 Pack 重复 task/Skill ID 有确定性告警，不静默覆盖。

## Evidence

- 开发：`evidence/dev-self-test.md`
- 制作人：`acceptance.md`
- 测试：`evidence/test-report.md`
- 截图：`evidence/screenshots/`
