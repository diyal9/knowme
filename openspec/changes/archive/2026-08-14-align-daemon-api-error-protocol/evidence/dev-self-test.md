# Dev self-test — align-daemon-api-error-protocol

## Commands

```bash
npm test
npm run lint
```

## Result

- `npm test`: **1753/1753** pass
- `npm run lint`: ok（含 script-scope）

## Coverage notes

- `tests/workbench-daemon-errors.test.js`：v1 信封、`DEFAULT_MESSAGES` 回退、鉴权归一、权限码保留
- `tests/workbench-daemon-client.test.js`：`task_not_found` 透传、`task_forbidden` 不误判、`unauthorized` → `auth_required`

## Docs

- `docs/daemon/API.md` 同步上游 v1.0.0
- `docs/daemon/README.md` 记录 KnowMe 端点子集与 `launch-context` 扩展
- `AGENTS.md` 导航已加协议入口
