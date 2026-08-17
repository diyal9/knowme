## 1. 规范

- [x] 1.1 更新 `docs/architecture.md` 文件预算：内聚优先、1200 告警、2000 硬顶
- [x] 1.2 更新 `.cursor/rules/architecture.mdc` 与 `team/charter.md`
- [x] 1.3 将 `split-lib-god-files-by-domain` 剩余「锯到 400」任务标为不作（按域拆仍可另开 change）

## 2. 门禁

- [x] 2.1 改 `scripts/check-architecture.js`：1200 WARN、2000 ERROR、白名单只保留 >2000
- [x] 2.2 按 lint 行数重写 `architecture-lib-oversize.json`
- [x] 2.3 `npm run lint` 绿（architecture 允许 1200+ WARN）
