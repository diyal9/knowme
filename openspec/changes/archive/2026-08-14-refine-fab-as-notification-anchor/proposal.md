## Why

悬浮铃铛已定位为通知入口，但默认仍离右下角有一段边距；面板内「继续工作」Session 恢复卡信息过重（标题、摘要、依据、双按钮），把通知面做成了工作恢复入口，语义错位。

### 目标用户

- 在工作台右下角扫一眼通知铃铛、需要低干扰入口的日常用户。
- 期望「继续工作」出现在工作流/会话主路径、而不是通知气泡里的用户。

### 验收标准

- 默认（未拖动）铃铛视觉上贴近工作台右下角，边距明显小于当前 `14px / 18px`。
- 悬浮面板不再展示「继续工作」Session 恢复卡（无 kicker / 恢复按钮 / Session 摘要元信息）。
- 铃铛红点不再由「可恢复 Session」驱动；无真实通知时红点隐藏。
- 日志中心 / 日志目录等次级快捷仍可用；纵向拖动与位置持久化仍可用。
- `npm test` / `npm run lint` 通过。

### 非目标（Non-goals）

- 不新建完整通知中心（列表、已读未读、推送通道）。
- 不改工作台主路径的 Session 恢复（如专家任务 `resumeExpertTaskChat` → `WorkspaceAgent.resumeSession`）；**仅禁止通知 FAB 承载或调用该能力**。
- 不改铃铛 SVG、面板头像品牌标记或日志窗口本身。

### 商业化与体验价值

通知入口语义清晰后，用户不会把「恢复 Session」误当成系统提醒；贴角铃铛更符合桌面通知习惯，降低视觉噪音，为后续真实任务/HITL 通知留出干净容器。

## What Changes

- 收紧 `#km-fab-root` 默认 `right` / `bottom`，并同步拖动定位时的右侧边距常量。
- 从 FAB **删除** Session「继续工作」能力（UI + 脚本调用），FAB 只做通知与快捷处理。
- 面板文案改为通知向（副标题等），保留轻量快捷工具区。
- 更新静态测试：断言 FAB 脚本零 `resumeSession` / Session 恢复引用。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `workspace`：悬浮铃铛默认贴右下角；面板定位为通知入口，不再承载 Session 恢复建议。

## Impact

- `src/workspace.html`（FAB CSS / HTML / 脚本）
- `tests/` 中断言 FAB resume 的用例
- OpenSpec：`openspec/changes/refine-fab-as-notification-anchor/`
