# 测试报告

日期：2026-09-23

## 结果

- `npm run check`：通过。
  - Node 主进程/领域测试：3,620 passed，0 failed，51 skipped。
  - Renderer：95 files / 746 tests passed。
  - lint：通过；包含颜色令牌、视觉预算、CSS cascade、script scope 与 prompt lint。
  - Renderer typecheck：通过。
- `npm run visual:check`：通过；当前 ceiling 无回退。
- 定向 CSS/视觉契约：22/22 通过。
- 能力中心组件：27/27 通过。
- `git diff --check`：通过；只有工作区其他文件的既有 CRLF 提示。

## Electron 视觉 smoke

报告：`evidence/capability-card-visual-smoke.json`

- 1200×800：3 列，无横向溢出。
- 850×720：2 列，无横向溢出。
- 620×720：响应式收敛，无横向溢出。
- 中档计算样式：标题 14px/600，元信息 12px/400，正文 13px/400；卡片最小高度 156px，图标 40px，底栏 28px。
- Renderer console error：0。

截图存于 `evidence/screenshots/`。

## OpenSpec 与影响范围

- 本 change 已包含 proposal、design、spec、tasks、acceptance、qa-plan、code-review、evidence 与 test-report。
- `openspec:health` 对本 change 不再报告软项缺失；全局仍有其他 active change 的既有缺口。
- GitNexus `CapabilityHubSurface` upstream impact：LOW，直接影响 0；本批未修改该组件符号。
- `detect_changes(all)`：CRITICAL，原因是当前未提交工作区横跨 226 个文件、208 个图符号和 122 条流程。本报告不把这些既有改动归因于视觉 change；提交或拆分前仍需按 change 范围隔离审查。

## 结论

视觉治理基础与能力中心样板达到自动化和真实 Electron 验收条件。后续专家协作、工作流、管线及辅助入口仍按单一体验域逐批迁移，本 change 暂不归档。
