# Parity Matrix — migrate-renderer-react-ts

完成定义：React 实现（非 hosted）。基线 Demo：`f6ad048`。

| ID | 能力 | Spec | 测试 | 状态 |
|----|------|------|------|------|
| P-01 | 默认 React workspace | renderer-react-ts | renderer-entry + e2e | pass |
| P-02 | rail 助理/工作台互斥 | workspace / renderer-react-ts | shell-rail.spec.tsx | pass |
| P-03 | shelf 徽章与网格（workbenchLoad、领域默认全部、点击启动） | workbench-workflow-shelf | shelf.spec.tsx | pass |
| P-04 | 无 Demo 种子（DEMO_VERTICAL_SEED_IDS 过滤） | workbench-workflow-shelf | shelf.spec.tsx | pass |
| P-05 | taskhome | — | taskhome.spec.tsx | pass |
| P-16 | 助理发送冒烟 | agent-chat-ux | e2e/workspace-launch.spec.ts | pass |
| P-06 | run / HITL（workbenchDaemonGate）/ 返回 / 再跑 / 过程日志 | work-surface | run.spec.tsx | pass |
| P-07 | manage | workbench-work-modes + automation copy | manage.spec.tsx | pass |
| P-08 | studio 画布（节点/连线/保存/dirty） | agent-composition-studio | studio.spec.tsx + studio-canvas.png | pass（核心画布；见缺口） |
| P-09 | 助理 Session/流式/@ 文件 | ai-assistant / agent-session-tabs / agent-chat-ux | assistant.spec.tsx | pass |
| P-10 | typed window.api | renderer-react-ts | typecheck | pass |
| P-11 | 数据目录不变 | — | 无 UI 变更 | pass |
| P-12 | 文件树 + 无源引导 | workspace | files.spec.tsx | pass |
| P-13 | 知识网列表/检索 | knowledge-os | knowledge.spec.tsx | pass |
| P-14 | 专家库 Tab overlay | capability-hub | capability-hub.spec.tsx | pass |
| P-15 | 页面级 legacy 壳退役 | renderer-react-ts | React 组件 + Vitest | pass |
| P-17 | 设置 Tab 表单 + saveSettings | — | settings.spec.tsx + settings-tab-sources.png | pass（核心 Tab；见缺口） |
| P-18 | 记忆窗 initMemory 列表 | — | memory.spec.tsx + memory-panel.png | pass |
| P-19 | 日志中心筛选/统计/分组 | — | log-viewer.spec.tsx + log-viewer.png | pass |

## Wave2-G（次要窗 + Studio 画布补齐）

| 面 | 退役前（f6ad048） | 现行 React | 证据 |
|----|-------------------|------------|------|
| 设置 | 7 Tab：内容源/GitLab/GitHub/Web、AI、助手、系统、连接器、记忆、关于；`saveSettings` | `SettingsSurface` + 分 Tab 面板 + 底部保存 | `evidence/screenshots/settings-tab-sources.png` |
| 记忆 | `initMemory` 近期记录列表 | `MemorySurface` + preload `initMemory` | `evidence/screenshots/memory-panel.png` |
| 日志 | 分类 Tab、统计、搜索、run 分组 | `LogViewerSurface` + `useLogViewer` | `evidence/screenshots/log-viewer.png` |
| Studio | `WorkbenchStudioCanvas` 自由画布 + 侧栏 palette | `StudioCanvasBoard` + `buildStudioCanvasBoard` | `evidence/screenshots/studio-canvas.png` |

### 已知缺口（诚实记录）

| 面 | 未完全对齐项 |
|----|-------------|
| Studio | 无拖拽平移/四向端口连线/专家 palette 侧栏/inspector 表单；仅画布渲染 + 列表检视 + 保存校验 |
| 设置 | 飞书授权轮询/scope 确认等复杂流程简化为「授权 + 打开链接」；无 embedded iframe 模式 |
| 记忆 | 便签已退役，不再 `focusNote` 回跳 |
| Electron | 本轮 UI 证据来自 `renderer:build` + Playwright 静态预览；`npm start` 当前因 `chunk-02.ts` 语法错误未能启动（与本轮 renderer 改动无关） |

## 页面级 html/js 退役（Wave2-F）

（同前，略）
