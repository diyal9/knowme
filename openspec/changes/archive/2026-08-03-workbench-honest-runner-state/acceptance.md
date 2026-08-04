# 制作人体验验收: workbench-honest-runner-state

## 核心路径

| 路径 | 结论 | 证据 |
|---|---|---|
| workflow 加载失败时进度为「无法确认进度」，无假 100% | 通过 | `summarizeRunnerProgress` + projection 单测；`progressSummary` 过滤占位 |
| 顶部 / 当前状态 / 执行节点语义一致 | 通过 | degraded 时 meta/status/graph 均指向「流程详情暂不可用」 |
| 左侧助手不推荐 `ingest/brief.md` 作产物 | 通过 | `classifyWorkbenchPaths` + `workbenchContextText` 门禁文案 |
| `#wbRunArtifacts` 仅 Daemon artifacts | 通过 | `renderTaskContext` 仍只读 `run.artifacts` |
| 相对路径产物可打开；未生成友好提示 | 通过 | `resolveArtifactOpenPath` + toast `尚未生成或未同步` |
| degraded「打开内容源设置」可跳转 | 通过 | `data-run-action=open-sources` → `openSettings('sources')` |

## 体验标准

- 不假装完成、不骗用户去打开输入路径
- 失败给出可行动出口（内容源设置）
- 正常任务进度百分比不被误伤

## 验收结论

- [x] 通过
- 验收人：制作人
- 日期：2026-08-03
- 备注：ADVISORY — 真机 Daemon degraded 会话建议用户本地再扫一眼；逻辑与单测已覆盖
