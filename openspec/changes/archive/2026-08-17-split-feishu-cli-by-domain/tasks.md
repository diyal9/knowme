## 1. OpenSpec

- [x] 1.1 proposal / design / tasks / qa-plan

## 2. 拆分实现

- [x] 2.1 创建 `feishu-cli/core.ts`（spawn + read 执行）
- [x] 2.2 创建 `feishu-cli/scopes.ts`（鉴权/scope）
- [x] 2.3 创建 `feishu-cli/meetings.ts`
- [x] 2.4 创建 `feishu-cli/im.ts`
- [x] 2.5 创建 `feishu-cli/calendar.ts`
- [x] 2.6 创建 `feishu-cli/drive.ts`
- [x] 2.7 创建 `feishu-cli/write.ts` + `tool-defs.ts`
- [x] 2.8 `feishu-cli.ts` 薄组合根 re-export（61 键显式映射）

## 3. 门禁

- [x] 3.1 从 `architecture-lib-oversize.json` 删除 feishu-cli 键
- [x] 3.2 feishu 相关定向测试 PASS
- [x] 3.3 `npm run lint` PASS
- [x] 3.4 `evidence/dev-self-test.md`
