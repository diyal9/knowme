## Context

Daemon 面由 `renderDaemonMode` 渲染三栏壳：左 workflow 列表、中只读阵容、右 tasks。目录来自 `GET /api/workflows`（`catalog.visibility` ∈ primary|advanced）。启动仍走 Launch Drawer。

## Goals / Non-Goals

**Goals**

- 策展常用路径，降低选择成本。
- 材料软体检提示缺口，不伪造「合格文档」门禁。
- 管线记录人话化；运行页审阅优先。

**Non-Goals**

- 智能匹配、Prep 真工作流、Daemon API 变更、大改布局壳。

## Decisions

1. **路径策展在客户端**：`primary` 按 `order` 取前 4；其余进「更多」。可选展示覆盖表按 workflow id 映射结果文案/阶段。
2. **材料体检为软门禁**：读 localStorage daemon-context + Daemon 在线/locked；缺 PRD/资源仅警告。
3. **术语**：右栏称「管线记录」，避免与「任务」Tab 冲突。
4. **阵容/日志**：默认折叠，一键展开，满足只读可访问。
5. **纯函数抽离**到 `workbench-daemon-surface.js`，便于单测；`workbench.js` 只负责 DOM。

## Risks / Trade-offs

- Daemon 侧 primary 过多时仍只显示 4 条 → 靠「更多」兜底。
- 无覆盖表时阶段条用通用三步 → 可接受的 P0 降级。
- 软门禁仍可能启动失败 → 记录区用可行动失败文案缓解。

## Migration

无数据迁移。旧 localStorage context key 不变。
