# Design: agent-task-preflight-ask

## 架构

改动完全落在渲染层单文件 `src/workspace-agent.js`，不新建平行模块，不触碰主进程与 LLM 协议：

1. **准入配置 `TASK_PREFLIGHT`**
   - 以任务 id 为 key，声明 `need`（`feishuAuth` | `material`）与 `ask`（一句话询问文案）
   - 覆盖 12 个卡片任务：通用 4（feishuAuth）、写作 4（material）、编程 4（material）
2. **反查表 `PROMPT_TO_TASK`**
   - 由 `EMPTY_SHORTCUT_PROMPTS` + `QUICK_ACTION_PROMPTS` 构建 prompt→taskId 映射
   - 让快捷菜单（只带 prompt 文本）也能复用同一套 preflight
3. **统一入口 `runTaskCard(taskId, label)`**
   - 先 `taskContextReady(spec)` 做确定性判断
   - 缺内容 → `askForTaskContent`（推一句话、暂存任务、聚焦输入框，**不调用 LLM**）
   - 齐备 → 走既有增强路径 `runOfficeShortcut`（含执行策略与飞书 workflow 锚点）
4. **暂存续跑 `pendingShortcut`**
   - 缺 material 时记住 `{ prompt, label }`
   - `runAI` 顶部拦截：手动发送且已补齐素材时，自动带上原任务指令继续

## 进程边界

| 层 | 位置 | 责任 |
|----|------|------|
| Renderer | `src/workspace-agent.js` | 卡片点击、preflight、一句话询问、暂存续跑 |
| 既有共享逻辑 | `enrichOfficeShortcutPrompt` / `buildShortcutIntentPrompt` | 增强执行 prompt（复用，未改） |
| 连接器状态 | `readFeishuConnector`（`connectorsStatus`） | 读取飞书授权状态（复用，未改） |
| Main / LLM | `src/main.js` `ai-generate` | 未改动 |

## 判定逻辑

```
shortcutHasMaterial() = 输入框有文本 或 已选附件
taskContextReady(spec):
  need = 'material'   → { ok: shortcutHasMaterial() }
  need = 'feishuAuth' → 读 connector：enabled && state != auth_required && userReady != false
  其他/无 spec        → { ok: true }
```

## 交互流程

### 1. 素材类任务（写作 / 编程 / remote-rag）
- 无素材 → 一句话询问 + 暂存任务 + 聚焦输入框；用户粘贴/@ 文件后直接发送即自动执行
- 有素材 → 直接走增强路径；素材经 `mergeShortcutPromptWithComposer` 并入任务 prompt

### 2. 飞书授权类任务（通用 4 卡）
- 未授权 → 只提示"设置 → 连接器授权飞书(user)"，**不调用 LLM**
- 已授权 → 走增强路径，附日期锚点与确定性 workflow 工具名

### 3. 兼容性
- `enrichOfficeShortcutPrompt` 对写作/编程 prompt 是 no-op 透传（各 enricher 有 `isXxxShortcut` 守卫）
- 空态卡片改走 `runTaskCard`；无 spec / 无匹配 id 时回落原 `runQuickStarter`

## 风险与权衡

- 一句话询问会用 system-note 替换空态卡片视图；已用 `pendingShortcut` 让"补素材直接发送"即可续跑，避免二次点击摩擦
- material 判定仅取输入框文本 + 附件（不含可能过期的编辑器上下文），保证可预测、不误判"已有素材"
- 飞书授权类未做一键内联跳转，保持"不乱做"，作为后续迭代项
