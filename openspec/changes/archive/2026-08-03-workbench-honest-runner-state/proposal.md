# Proposal: workbench-honest-runner-state

## Why

工作台运行时「任务工作间」（`renderTaskContext()`）在**工作流节点定义加载失败**时，会把一次失败会话伪装成成功交付，严重损害用户信任。真机截图（team-run）同一屏出现三处自相矛盾信号：顶部「流程执行中」、当前状态「状态 done · 已完成 1/1 步 · 100%」、执行节点「选择详情暂不可用 · 无法从仓库加载工作流 [team-run] 的节点定义」。

根因链：

1. **假 100%**：workflow 加载失败进入 degraded 后只塞 1 个占位节点 `degraded-info`，而 `progressSummary()`（`src/workbench.js:1742`）看到「1 节点 + status=done」直接判定 `已完成 1/1 步 · 100%`，把「加载失败占位」当「已完成步骤」计数。
2. **推荐不存在的产物**：左侧助手引导用户查看「任务产物 `ingest/brief.md`」，但该路径是任务**输入配置**（`inputs.root=ingest/`），并非已产出文件；`workbench-presenter.js` 本应过滤 `ingest/` 内部路径的脱敏未对左侧对话生效，内部实现细节直接漏给 C 端用户。
3. **产物打不开 + 报错无出口**：产物按钮对相对路径直接 `shell.openPath("ingest/brief.md")`（`src/workbench.js:3035`）不解析仓库根，注定失败；且「无法加载节点定义」重复两次却无任何可行动指引（真实原因常是设置里激活的 Git 内容源不是含 `team-run.json` 的仓库）。

这三点都是「系统说完成了、却什么都没交付、还让用户去撞墙」的欺骗性体验，属运行时任务工作间面板，**不被任何现有活跃 change 覆盖**（`workbench-dag-branch-view` 只改启动弹窗 DAG）。

## 目标用户

- 在工作台通过远程 Daemon 启动 team-run 等工作流、依赖右侧「任务工作间」判断进度与产出的办公用户
- 激活内容源与工作服务 workflow 不一致、易触发 degraded 的用户（常见误配场景）

## What Changes

- **诚实进度**：degraded 占位节点 MUST NOT 计入进度；加载失败时进度显示「无法确认进度」而非 100%，顶部标题与「当前状态」不再自相矛盾。
- **只展示真产物**：任务工作间与左侧助手建议 MUST 只呈现 Daemon `/artifacts` 真实返回、可打开的产物；输入路径（如 `ingest/brief.md`）MUST NOT 作为「产物」展示；`presenter` 脱敏对左侧对话建议同样生效。
- **产物可打开**：`workbench-daemon-artifact-open` 对相对路径先解析到仓库根再 `openPath`；解析不到给「该产物尚未生成 / 未同步」友好提示而非系统级文件不存在报错。
- **失败有出口**：degraded 文案用户化，并提供一键跳转「设置 → 内容源」，附自检提示（激活源是否含 `.cursor/workflows/`）。

## Non-goals

- 不改 `buildWorkflowGraph()` 图模型与编排推进逻辑
- 不新增本地生成 `brief.md` 等产物的能力（产物仍由 Daemon 侧产出）
- 不改动 `workbench-dag-branch-view` 涉及的启动弹窗 DAG 渲染
- 不引入第三方图库或全屏画布

## 验收标准

- workflow 加载失败时，任务工作间 MUST NOT 出现「100%」或「已完成 N/N 步」，MUST 显示「无法确认进度」并给出可行动出口
- 顶部进度、当前状态、执行节点三处状态语义一致，无「执行中 + done + 加载失败」并存
- 左侧助手 MUST NOT 推荐或引用未由 Daemon 产出的输入路径（如 `ingest/brief.md`）作为产物
- 点击真实产物（含相对路径）能正确打开；未生成产物给友好提示，无系统级报错
- degraded 提示对 C 端可读，并能一键跳转内容源设置
- `npm test` / `npm run lint` 全绿，无回归
