# Retro: workbench-taskroom-readable

## 背景

用户从一张任务工作间截图提出「如何优化才能符合人的视角、操作习惯、阅读习惯」。定位到右栏三大硬伤并落地修复。

## 根因与修复

1. **文字墙**：`renderTaskContext` 把 `factualBrief`（喂给 LLM 的防臆造多行事实串，含「禁止把任务输入路径当作产物…」内部规则）原样 `textContent` 到 `#wbRunStatus`。
   - 修：改为「语义色圆点 + headline 结论 + 一行说明」；`factualBrief` 仅保留 LLM 注入用途，不入 DOM。
2. **状态矛盾**：`done` 时顶部 meta 仍「流程执行中」，与进度「已完成 100%」、状态「done」三处打架。
   - 修：`renderDaemonRunner` meta 在 done/degraded 分别显示「已完成」「流程详情暂不可用」。
3. **黑话泄漏**：`userFacingDegradedReason` 暴露 workflow id 与 `.cursor/workflows/` 路径，且在「参与助手」「执行节点」重复。
   - 修：projection 去 id/路径（保留「激活内容源可能与该工作流不匹配」测试短语）；参与助手压成一句短提示。
4. **绿色滥用**：进度标签/下一步框/节点点都绿。
   - 修：tone 语义色（done 绿 / waiting 琥珀 / running 蓝灰 / error 红 / muted 灰），绿色仅留成功。

## 关键设计

- 纯函数 `buildWorkbenchTaskBrief` 新增 `tone`/`headline`，可 Node 单测，渲染分支由其驱动 → 无头环境也能门禁化验证 UI 逻辑。
- 旧字段（`factualBrief` 等）保留，向后兼容，回归面小。

## 门禁

- `npm test` 764 pass / 0 fail；`npm run lint` ok；harness gate `ok=true`/`blocking=false`，soft 清空。
- 证据：`evidence/dev-self-test.md`、`acceptance.md`、`qa-plan.md`、`evidence/test-report.md`、`code-review.md`。

## 归档踩坑（复发项 · 关注 ≥3 触发 /evolve）

- **主 workspace spec 为旧自由格式（无 `## Purpose`/`## Requirements`），`openspec archive` 严格校验必失败**。这是本仓库第 2+ 次因同一结构问题被迫 `--skip-specs`（上次：workbench-honest-runner-state / work-context-toggles）。
  - 现状：用 `--skip-specs` 归档，delta spec 留档于 archive 供追溯。
  - 建议：择机把 `openspec/specs/workspace/spec.md` 迁移为标准 OpenSpec 结构（补 `## Purpose` + `## Requirements` 包裹），一次性消除该复发阻塞。若再复发一次即达 ≥3，应走 `/evolve` 升为规范修复任务。
- MODIFIED vs ADDED：新能力必须用 `## ADDED Requirements`，否则 archive 找不到同名 header 直接 abort。

## 结果

任务工作间右栏从「日志式文字墙」变为「结论优先 + 语义色 + 去黑话」。归档：`openspec/changes/archive/2026-08-03-workbench-taskroom-readable/`。
