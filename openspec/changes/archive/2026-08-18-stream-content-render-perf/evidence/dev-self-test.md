# Dev self-test — stream-content-render-perf

## Tests

- content-blocks + content-view + assistant: 30/30 pass

## Behavior

- Streaming: 100ms throttle + stable prefix cache
- Chat: page size 32, reveal +32; bubble memo + content-visibility
- `html[data-ui-throttle=1]` disables backdrop-filter
