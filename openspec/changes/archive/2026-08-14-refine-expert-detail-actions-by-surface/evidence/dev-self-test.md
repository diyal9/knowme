# Dev self-test: refine-expert-detail-actions-by-surface

## Commands

```bash
npm test
npm run lint
```

## Result

- `npm test` — PASS（1642/1642）
- `npm run lint` — PASS

## Code paths covered by static tests

- 工作台快捷专家卡 UI 对齐专家库 hub-card（头像/标题/副标/描述/徽章/版本）
- 快捷卡点击 → `openCapabilityHub(..., { surface: 'workbench', presentation: 'detail' })`，不打开专家库整页、不直接 `openTaskComposer`
- 「+ 新建任务」仍 `openTaskComposer()`
- Hub `surface=capability` 底栏无 `startExpert`；`surface=workbench` 仅开工 CTA
- 宿主 `listLocalWorkbenchAgents` 与能力目录同源展示名
- 宿主 `buildCapabilityHubSrc` / `capability-hub-select-expert` 深链
