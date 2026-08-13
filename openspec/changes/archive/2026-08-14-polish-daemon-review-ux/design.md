## Context

Daemon WebUI 已有只读代码工作区：`GET /api/tasks/{slug}/workspace/tree|blob`，前端为 modal（repo 选择 + 左树 + 右 blob）。KnowMe 审阅面已有「代码工作区」按钮，但仅 `artifact-open` 本地路径，且常因无路径隐藏；步骤页在 degraded 时渲染嵌套说明卡，进度不可读。

## Goals / Non-Goals

- Goals：扁平审阅面、图标两字底栏、步骤进度时间线、变更区打开 WebUI 同构工作区。
- Non-Goals：服务端改动、语法高亮库、编辑能力。

## Decisions

1. **视觉压平**  
   - 运行审阅态：`wb-run-body` 在 daemon review 时用白底；步骤行去掉「白卡套白卡」边框阴影，改为时间线节点（左侧竖线 + 状态点）。  
   - 底栏 `wb-runner-actions`：白底 + 顶部分割线，与内容同色阶。

2. **底栏按钮**  
   - `actionButton` 支持 `icon` + 两字 `label`：刷新 / 重跑（原「重新执行」）/ 返回（原「返回流程」）。  
   - `title` 保留完整语义（重新执行 / 返回流程）。

3. **步骤进度**  
   - 顶部进度条：`已完成 n/total` + 当前节点名。  
   - 列表为竖向时间线；`done/active/error/pending` 色点；当前步强调。  
   - degraded 且无真实节点：单行 callout +「查看过程日志」，不渲染占位步骤卡。

4. **代码工作区**  
   - 变更 Tab 顶栏常驻「代码工作区」按钮（有 slug 即显示）。  
   - 点击打开 KnowMe 内 modal，IPC：`workbenchDaemonWorkspaceTree/Blob` → client `GET .../workspace/tree|blob`。  
   - UI 对齐 WebUI：repo select、左树、右预览、刷新、关闭。  
   - 无仓目录时诚实空态。

## Risks / Trade-offs

- Workspace API 不可达时需 toast/空态，避免假成功。  
- 大文件预览依赖服务端截断字段；前端只展示。

## Migration

无数据迁移。旧「仅本地 artifact-open」可保留为次要路径，主入口改为 workspace modal。
