# Dev self-test — add-daemon-docs-sync-check

- `npm run daemon:docs-check -- --json` → ok=true, local version 1.0.0
- 上游缺失 → advisory `upstream-missing`, exit 0
- `harness doctor` 含 daemon-docs-sync advisory
- `npm test` 1879/1879; `npm run lint` ok
