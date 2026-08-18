# Dev self-test — speed-up-workspace-first-paint

## Assessment (kept for follow-ups)

| Hotspot | Action this change |
|---------|-------------------|
| Eager surface imports | Lazy non-assistant surfaces |
| Files hidden still mounts | Conditional mount |
| Assistant chrome Hub+knowledge fan-out | Drop Hub; defer knowledge |
| TaskHome double Hub IPC | Single load |
| Streaming markdown full re-parse | Deferred (needs dedicated change) |
| backdrop-filter on software GPU | Deferred |

## Tests

- `vitest` taskhome + assistant: 28/28 pass
