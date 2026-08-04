# Retro: workbench-home-visual-polish

- 日期：2026-07-30
- 状态：已 `/story-done` 归档 → `openspec/changes/archive/2026-07-30-workbench-home-visual-polish/`

## 交付

统一工作台首页视觉层级；专家卡片四层结构（图标 / 中英文名 / 可调度 / 简介 + 三项真实统计）；自动化模板整卡按钮 + 场景图标 + 键盘焦点；响应式 4→2(980px)→1(760px) 列；`prefers-reduced-motion` 关闭卡片位移。

## 门禁证据

- 开发自测：`evidence/dev-self-test.md`
- 制作人验收：`acceptance.md`（2026-07-30 通过）
- 测试报告：`evidence/test-report.md`（Smoke + Regression 已勾）
- 硬门禁：`harness.js gate --json` → `ok: true`；`npm test` 496/496、`npm run lint` PASS

## 复盘要点

- 专家卡统计全部取真实数据（`skills.required/optional`、`workflowNodes` 长度），无占位假数——反模式检查项通过。
- 自动化模板去掉次级「使用模板」按钮，整卡 `<button>` 可点/Enter/Space，无重复操作面。
- 静态回归测试 `tests/workbench-templates.test.js`（20+ 断言）是本次可靠的结构护栏；Electron 真机窄窗拖拽为 ADVISORY，未阻断。
- 归档步骤：本仓无 `openspec` CLI，按惯例手动 `mv` 到 `archive/YYYY-MM-DD-<name>/`（change 目录当时为 git 未跟踪，`git mv` 不适用）。
