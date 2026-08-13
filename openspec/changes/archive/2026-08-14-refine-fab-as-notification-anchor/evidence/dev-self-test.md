# Dev self-test: refine-fab-as-notification-anchor

- Date: 2026-08-13
- Change: refine-fab-as-notification-anchor

## Checks

| Check | Result |
|------|--------|
| `npm test` | PASS |
| `npm run lint` | PASS |
| FAB default `right/bottom: 6px` | OK |
| No `#km-fab-resume` / Session CTA in FAB | OK |
| Badge not driven by Session | OK |
| Static tests updated | OK |

## Notes

- 通知 FAB **禁止**调用 `resumeSession`；工作台主路径（如专家任务恢复）可继续使用。
- 面板定位：通知 + 快捷处理（日志等）。
- 真机请重启应用后看右下角贴边与面板文案。
