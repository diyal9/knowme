## 1. 模型：任务投影与 ingest

- [x] 1.1 扩展 `workbench-daemon-surface.js`：管线任务列表视图（intent 标题、状态、bucket、相对时间文案）
- [x] 1.2 实现 `resolveIngestRequirements(workflow, launchContext)` + `evaluateIngest(...)` + 新建表单门槛（≥20 字或 ≥1 材料）
- [x] 1.3 补充/更新 `tests/workbench-daemon-surface.test.js`（列表投影、筛洗、ingest hard/soft、回退 schema）

## 2. 管线服务壳：创建 + 任务列表

- [x] 2.1 改 `workspace.html` `wbDaemonPage`：左创建表单、右任务轨；去掉路径三栏默认壳
- [x] 2.2 重写 `renderDaemonMode`：渲染创建表单 + 任务列表/空态/筛选/搜索/服务状态
- [x] 2.3 选中任务：点击卡片进入既有 `openDaemonTask` 运行面
- [x] 2.4 样式 `workbench-console.css` / `workbench-shelf.css`：创建区 + 任务卡密度

## 3. 创建管线任务

- [x] 3.1 表单 DOM（路径、目标、补充材料、取消/开始开发）嵌入左栏
- [x] 3.2 切换路径时刷新 launch-context（最佳努力）
- [x] 3.3 提交：校验 → `workbenchDaemonStart` → 刷新 overview 并打开新任务
- [x] 3.4 文件选择：`workbench-pick-files` IPC，仅路径/文件名入表单

## 4. 兼容与文案

- [x] 4.1 管线内用「管线任务 / 创建新任务」；顶栏「任务」未合并
- [x] 4.2 路径策展用于表单 select；旧路径墙交互移除
- [x] 4.3 开工入口改为 compose-submit（不再中栏「开工」按钮）

## 5. 质量

- [x] 5.1 相关用例与 lint；`workbench-daemon-surface` + templates 已对齐（全量 `npm test` 见 evidence 备注）
- [x] 5.2 写入 `evidence/dev-self-test.md`
- [x] 5.3 截图：`evidence/screenshots/`（真机跑通后补）
