## Why

Daemon 任务房通栏顶栏同时展示目的标题与工作流副文案，扫读时像两行标题叠在一起；左栏「管线进度」卡的 kicker + 卡身又像两张卡重叠。需要把身份收敛到「顶栏只留目的标题」，副身份放到右栏审阅区，并压平进度卡层级。

## What Changes

- 通栏对话状态栏在 Daemon 审阅态：**只显示目的标题**（`Daemon 阶段 · …`）+ 结论态 + 返回；不再并排展示工作流名 / context 副文案（及易抢视线的模式标签）。
- 工作流短名等副身份改放到**右栏审阅区**（Tab 上方轻量身份行），避免顶栏双标题。
- 左栏「管线进度」卡改为**单层卡片**：去掉「标题条叠卡身」的双层观感，结构与间距清晰、不与相邻消息/输入区视觉重叠。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `workbench-dialogue-chrome`：Daemon task-room 通栏顶栏标题唯一性（仅目的标题）。
- `pipeline-run-review-surface`：右栏承载工作流副身份；左栏进度卡单层展示。

## 目标用户

- 在工作台打开管线任务、需要一眼确认「这次任务目的」并对照右栏制品/步骤的知识工作者。

## 验收标准

- Daemon 任务房通栏顶栏可见唯一目的标题，旁侧不再出现第二段「Daemon 阶段 · …」或工作流名抢位。
- 右栏审阅区可见工作流短名（或等价副身份），不依赖顶栏 meta。
- 左栏管线进度为单层卡片：无「灰条标题 + 白卡」叠层观感；与输入框间距正常。
- `npm test` / `npm run lint` 通过。

## 非目标（Non-goals）

- 不改 Daemon API / 轮询 / 制品列表逻辑。
- 不恢复右栏完整 `wb-run-topbar` 双返回。
- 不重做步骤时间线或过程日志 Tab。

## Impact

- `src/workbench.js`、`src/workspace-agent.js`、`src/workspace.html`、`src/workbench-layout.css`
- 相关静态契约测试 / `openspec/changes/.../evidence/`
