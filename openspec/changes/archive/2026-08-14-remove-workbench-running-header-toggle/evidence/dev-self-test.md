# Dev self-test — remove-workbench-running-header-toggle

Date: 2026-08-12

## Commands

```text
npm test   → pass
npm run lint → pass
```

## Checks

- [x] `workspace.html` 无 `#wbRunningToggle` / `#wbRunningPopover`
- [x] `workbench.js` 无 `renderRunList` / `syncRunningToggleVisibility` / 相关监听
- [x] 契约测试改为断言入口已移除，任务列表与管线筛选仍在
- [x] 引导文案不再承诺「货架进行中入口」

## Notes

运行中事项改由「任务」首页与「管线服务」记录面承载；顶栏第二入口已删除。
