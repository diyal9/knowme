## 1. OpenSpec

- [x] 1.1 proposal / design / tasks / qa-plan / acceptance / spec

## 2. domain / workbench

- [x] 2.1 workbench labels/escape/provenance/run-phase → domain
- [x] 2.2 work-surface → domain

## 3. ipc / preload

- [x] 3.1 ipc/*.js → .ts
- [x] 3.2 preload → .ts
- [x] 3.3 main/load-renderer、tray → .ts

## 4. main 拆分

- [x] 4.1 main.js 薄 boot
- [x] 4.2 组合根拆到 src/main/*.ts（≤400 行/文件 via chunks）

## 5. 文档与门禁

- [x] 5.1 更新 docs/architecture.md
- [x] 5.2 npm test + test:renderer + typecheck:renderer + lint
- [x] 5.3 evidence/dev-self-test.md
