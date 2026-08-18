## Why

管线服务当前是「选路径 → 材料芯片 → 开工 → 右栏运行列表」（图1）。用户真正在管线侧的心智是：**管理一批管线任务的生命周期**，以及**按任务状态做审阅/补材料**——与外部 AI 管线台（图2）一致。  
路径目录不应再占用主视野；新建应走「描述目标 + 补 ingest」对话框（图3），并在创建时按 Daemon 工作流需求判定所需材料（需求文档、美术资源等），而不是只在路径详情里做通用软芯片提示。

## What Changes

- **信息架构重构（BREAKING UI）**：管线服务 Tab 从「路径 | 操作台 | 运行」改为 **左栏任务管理 + 右栏任务审阅/状态**（可选中栏过程区，与图2对齐）。
- **主入口变为任务列表**：展示 Daemon `/api/tasks` 列表；支持搜索、状态筛选、选中后加载详情；服务在线状态保留在栏脚或状态条。
- **「+ 新建任务」对话框（对齐图3）**：目标描述（≥20 字或上传材料）+ 补充材料上传区（PRD / 原型 / 配置表等提示）+ 可选交付路径（默认路径可折叠）+「开始开发」。
- **按路径判定 required ingest**：创建时读取工作流 `launch-context` / catalog 声明的所需输入（如需求说明、美术资源、配置表），逐项 ready/pending；缺 hard 项禁用提交，soft 项可警告后仍启动（策略可配置，默认 hard=连接/路径锁定，业务材料遵循 Daemon 声明）。
- **右侧审阅对齐任务状态**：选中任务后展示状态、步骤/产物/需要你处理；不再把「选路径开工」中栏作为默认首页。
- **文案边界**：顶栏「任务」仍指本机专家任务；管线服务内统一称 **管线任务**，避免混同。

### 目标用户

- 主要：用管线服务跑固定交付、需要回看 run 与补 materials 的工程/制作同学。
- 次要：需要审阅产物、处理门禁/澄清的协作方。

### 验收标准

- 进入「管线服务」默认看到 **任务列表**（非路径目录墙）；有「+ 新建任务」。
- 新建对话框支持描述目标与上传/关联补充材料；提交前展示该路径所需 ingest 清单与就绪态。
- 缺 Daemon 声明的 hard ingest 时无法「开始开发」；软项有明确待补文案。
- 选中管线任务后右侧（或中+右）展示该任务状态与审阅相关信息（产物/步骤/下一动作）。
- 与顶栏「任务」文案不混用；离线时列表与新建均有可读降级。

### 非目标（Non-goals）

- 不重写 Daemon HTTP 协议与 task API（仅消费现有 tasks / launch-context / createAndRun）。
- 不做完整 Prep 工作流（需求→合格文档 / 美术→ArtBundle 产品化）。
- 不合并顶栏「任务」与「管线服务」为单一 Tab。
- 不引入新前端框架；不复制外部 AI 管线台全部三栏细节（中栏实时日志可在有现成 task 投影时增量）。
- 不改变本机专家任务（顶栏任务）生命周期。

### 商业化与体验价值

管线服务是远程交付与算力落点。把入口从「读路径目录」改为「任务工单」，用户完成一次成功开工与审阅的路径更短；ingest 事前校验减少无效 run，降低信任损耗与失败回访成本。

## Capabilities

### New Capabilities

- `pipeline-task-workbench`：管线服务的任务管理列表、新建管线任务对话框、任务态审阅面。

### Modified Capabilities

- `agent-workbench`：管线服务 / Daemon Tab 默认信息架构从「常用路径+开工台+管线记录」改为「管线任务管理 + 任务审阅」；路径策展降为新建时的路径选择器。

## Impact

- `src/workspace.html` — `wbDaemonPage` 壳布局
- `src/workbench.js` — `renderDaemonMode` 及新建/任务详情交互
- `src/lib/workbench-daemon-surface.js` — 扩展任务列表投影、ingest 判定、新建校验
- `src/lib/workbench-daemon-client.js` — 如需规范化 launch-context 中的 required inputs（无 API 变更时仅解析扩展字段）
- `src/workbench-console.css` — 任务管理 + 审阅布局
- `tests/workbench-daemon-surface.test.js` 等
- 取代/收束 `redesign-daemon-ops-and-records`、`polish-pipeline-service-console` 中「路径为主」的验收表述
