# Dev self-test — compact-daemon-task-card-title

Date: 2026-08-13

## Commands

- `node --test tests/workbench-daemon-surface.test.js` — PASS（14）
- `npm run lint` — PASS

## Behavior

- 多行/单行「需求文档：+ 飞书 URL」→ 标题含「需求文档」+ 缩短链接，**不再**回退为 `daemon-stage-impl`
- 短 intent 仍作标题
- 完整 intent 保留在 `intentTitle` / tooltip
- 卡片可渲染 `cardBrief` 次要简介行（与标题不重复时）

## Manual

- 重启后打开管线服务 → 全部任务，确认主题可读且路径名只在 meta
