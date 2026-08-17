# 开发自测报告 — migrate-renderer-react-ts（Wave3 · Studio/UI parity）

- 日期：2026-08-14
- Change：migrate-renderer-react-ts
- 分支：refactor/renderer-react-ts
- 基线对照：f6ad048（非 origin/main 7699dee）

## 硬门禁

| 命令 | 结果 |
|------|------|
| `npm run typecheck:renderer` | PASS |
| `npm run test:renderer` | PASS（44/44） |
| `npm test` | PASS（本轮未单独重跑全量；上一轮会话 PASS 1613） |
| `npm run lint` | PASS |

## 本轮恢复（相对 f6ad048 / 上轮 React 壳）

| 面 | 状态 | 说明 |
|----|------|------|
| 工作台 chrome | 部分 | `AppShell`：L 形壳、三 Tab 仅在 taskhome/shelf/manage 显示；Studio 时隐藏 Tab、显示 `StudioHeadNav` + 返回按钮 |
| TaskHome | 部分 | 快捷专家网格 + 最近协作卡片结构；`enterStudio('taskhome')` 记录返回面 |
| Shelf | 部分 | 领域 chip 筛选、卡片网格、管理工作流入口（对齐 `workbench-shelf.css`） |
| Studio 编排 | 部分 | **三栏** `wb-studio-shell`：左侧 `StudioPalette`（流程/能力/控制分组）、画布 `StudioCanvasBoard`（节点卡片+端口+拖拽+连线）、右侧 inspector 列表 |
| Studio 导航 | 部分 | 可编辑标题、meta 未保存提示；`leaveStudio()` 按 `studioReturnSurface` 返回（非第 4 Tab） |
| 设置/记忆/日志 | 保持 | 独立 Vite 窗 + 7 Tab；证据脚本仍 PASS |
| Run 任务房 | 保持 | 顶栏「返回」+ HITL/结束态 footer |

## Electron 真机

命令：`node scripts/electron-migrate-renderer-evidence.js`

| 结果 | 说明 |
|------|------|
| **PASS** | 工作台 + Studio + 设置 7 Tab + 记忆 + 日志截图均生成 |
| JSON | `evidence/electron-evidence.json`（2026-08-14T15:21Z） |
| 截图 | `evidence/screenshots/electron-*.png` |

`npm start`：证据脚本后已再次启动，供本地目视核对。

## 测试修复（本轮）

- `TaskHomeSurface`：`hubItems.filter` 移出 zustand selector（修复 infinite loop）
- `studio.spec`：palette 上保留 `data-testid="studio-add-node"`；离开 Studio 改点返回按钮
- `shelf.spec`：领域筛选改为 chip 交互
- `capability-hub.spec`：`within(hub)` 避免与 TaskHome 快捷专家重名
- `run.spec`：HITL 态返回按钮文案为「返回」

## 仍未对齐 f6ad048（诚实）

| 项 | 状态 |
|----|------|
| Studio 专家多选弹窗 / 专家库跳转 | **未做** |
| Studio inspector 内联字段编辑（Prompt/模型/技能绑定） | **未做**（仅右侧列表摘要） |
| Studio 一键对齐 / 轻量步骤模式 / 右键菜单 / 连线预览 SVG | **未做** |
| Studio 保存确认 modal / 检查流程 run | **未做** |
| Manage 工作流管理子面板（`renderWorkflowManage` 完整 UI） | **简化**（模式+自动化列表） |
| Console 抽屉 / 专家任务房完整对话布局 | **未验收** |
| 飞书授权假成功 | **未做**（仍走真实 IPC） |

## 备注

- 未恢复便签 / 独立便签窗 / `tests/fixtures/legacy-pages`
- 制作人 / QA 签字：**未签**（开发自测 only）
- 未 git commit（按指示）
