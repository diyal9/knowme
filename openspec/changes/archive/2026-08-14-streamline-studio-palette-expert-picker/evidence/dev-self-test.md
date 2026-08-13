# Dev self-test — streamline-studio-palette-expert-picker

## Static

- `npm test` — 1682/1682 pass
- `npm run lint` — ok

## UI contract (static sources)

| Check | Result |
|---|---|
| 无配置 Tab / 无侧栏专家列表 | `workspace.html` |
| 单列分区组件 | `paletteTypes` + `.wb-studio-palette-col` |
| 专家多选弹窗 | `openStudioExpertPicker` + `wb-task-quick-card` |
| 确认批量 `addAgent` | `confirmStudioExpertPicker` |

## Manual smoke (开发自测)

1. 打开工作台 → 编排工作流
2. 侧栏仅见「组件」单列分区（流程 / 能力 / 控制）
3. 点「专家」→ 弹窗；多选有✓ → 确认后画布增加专家节点
4. 无工作台绑定时空态 + 去专家库
