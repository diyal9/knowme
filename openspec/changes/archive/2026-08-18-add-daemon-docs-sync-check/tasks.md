## 1. 同步校验脚本

- [x] 1.1 实现 `scripts/check-daemon-docs-sync.js`（本地自洽 + 可选上游比对，`--json`）
- [x] 1.2 `package.json` 增加 `daemon:docs-check`
- [x] 1.3 `harness doctor` advisory 调用；更新 `docs/daemon/README.md` 同步说明

## 2. 自测

- [x] 2.1 本地跑通脚本（上游缺失时 advisory）
- [x] 2.2 写 `evidence/dev-self-test.md`
