## Context

启用 `game-studio` 后，`listEmptyStateGroups()` 把 `showInEmptyState !== false` 的场景推到 Renderer，`workspace-agent.js` 优先渲染 pack 空状态，盖住通用飞书四卡。场景数据与 UI 文案都在 pack 文件中（`pack.json` / `scenes.json`），运行时经主进程 IPC 下发 DTO。见 proposal.md Why。

## Goals / Non-Goals

**Goals:**
- 空状态以飞书连接快捷入口为主，并提供通向 Daemon 工作流的 intake 卡。
- 保留游戏场景 ID / 关键词 / legacy 映射，不破坏路由。
- 空 kicker 不渲染，避免残留「游戏工作室」。

**Non-Goals:**
- 不改飞书连接器实现、不新增 MCP 工具。
- 不改工作台左侧 Rail 与工作流目录。
- 不把游戏角色场景从能力包删除。

## Decisions

1. **用新空状态场景，而不是改写 `game-design` 等角色场景标签**  
   - 理由：角色场景仍被关键词与 `buildScenePrompt` 使用；改标签会污染系统提示与测试。  
   - 备选：直接改四角色卡文案 → 拒绝（路由语义混淆）。

2. **空状态四卡复用现有快捷 prompt 文案约定**  
   - `feishu-docs` / `feishu-meeting` / `feishu-chats` 的 `emptyPrompt` 对齐 `workspace-agent` 中已验证的 `docKbSuggest` / `meetingSummary` / `relatedChats`。  
   - `workflow-intake` 新增 intake 导向 prompt，绑定 `game-requirement-doc` 与 `defaultWorkflow: game-dev-delivery`。  
   - 备选：空状态走 `data-shortcut` 绕过 pack → 拒绝（破坏 pack 驱动空状态契约）。

3. **UI kicker 允许空字符串；Renderer 条件渲染**  
   - `pack.json` 设 `emptyStateKicker: ""`；`listEmptyStateGroups` 原样透传；HTML 仅在非空时输出 `.agent-empty-kicker`。  
   - 备选：完全删除 kicker 字段 → 回退到 `pack.name`（「游戏研发能力包」）更糟。

4. **进程边界**  
   - 场景与 UI 元数据仍只在主进程 pack runtime 解析；Renderer 只消费 IPC DTO，无文件系统访问。

## Risks / Trade-offs

- [Risk] 用户仍期望一键进入「研发实现」角色卡 → Mitigation：需求梳理卡结尾给出进入工作台流程的下一步；Rail 工作流入口不变。
- [Risk] intake prompt 过长导致气泡标题泄漏 → Mitigation：沿用现有 `compactSessionDisplayTitle` / `runQuickStarter` 标题压缩；标题用「需求梳理」。
- [Trade-off] 空状态不再直接展示 QA/制作卡 → 关键词路由与技能仍可用，符合「连接为主」优先级。

## Migration Plan

- 仅改 bundled pack 与渲染；已安装用户下次加载 pack 记录时读新 scenes（bundled 源更新即可；若 store 缓存 hash，重启后 `installPack`/`loadPackRecord` 走 bundled 文件）。
- 回滚：恢复 `pack.json` / `scenes.json` 与 renderer kicker 条件即可。
