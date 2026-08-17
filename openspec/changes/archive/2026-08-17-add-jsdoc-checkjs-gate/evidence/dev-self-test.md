# Dev self-test — add-jsdoc-checkjs-gate

- `jsconfig.json` files 白名单：`workbench-daemon-errors.js`
- `npm run typecheck -- --json` 可运行（advisory）
- `typescript@5.9.2` 已入 devDependencies
- `harness doctor` 含 typecheck-jsdoc advisory
- `npm test` 1879/1879; `npm run lint` ok
