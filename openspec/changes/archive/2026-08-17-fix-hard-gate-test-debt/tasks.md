## 1. 盘点失败簇

- [x] 1.1 跑 `npm test`，按文件聚类失败（executor / protocol / team-runtime / eval / audit / 其他）
- [x] 1.2 跑 `npm run test:renderer`，列出失败用例与对应 feature

## 2. 修复 Node 硬门禁

- [x] 2.1 对齐 `SUPPORTED_PROTOCOL_VERSION` / `BUS_VERSION` 与实现单一真值
- [x] 2.2 修 agent-run-executor / grounding / team-runtime 相关失败
- [x] 2.3 修 eval / benchmark harness 断言或夹具
- [x] 2.4 修 audit jsonl 落盘路径 / 目录创建类失败
- [x] 2.5 `npm test` 退出码 0

## 3. 修复 Vitest 硬门禁

- [x] 3.1 修 capability-hub / manage / run / studio 等 overlay 规格失败
- [x] 3.2 `npm run test:renderer` 退出码 0

## 4. 门禁证据与关单

- [x] 4.1 写 `evidence/test-report.md`（含命令与摘要）
- [x] 4.2 `npm run harness:gate` PASS；必要时回头归档 main 三 change
