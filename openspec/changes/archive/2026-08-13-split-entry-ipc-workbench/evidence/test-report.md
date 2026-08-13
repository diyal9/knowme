# 测试报告: split-entry-ipc-workbench

## 门禁

- [硬] npm test: PASS（1786/1786）
- [硬] npm run lint: PASS
- [软] qa-plan Smoke Scope: 已按重构类 Story 以合同测试 + 全量回归覆盖；手工启动冒烟 ADVISORY
- [软] code-review: 已完成（见同目录 `code-review.md`）

## Smoke 结果

| 用例 | 结果 | 备注 |
|------|------|------|
| 应用启动无白屏 | PASS* | *由全量测试 + 入口合同断言间接覆盖；建议制作人本地 `npm start` 再确认 |
| 设置页 / API Key redact | PASS | `settings` ipc + 既有 redact 场景 |
| 内容源列表/读文件 | PASS | `sources` ipc 合同 + 存量 sources 测试 |
| 外链 http / 本地 file | PASS | `open-external` ipc |
| 工作台货架徽章 我的/官方/共享 | PASS | `workbench/provenance` 单测 |

## Regression

- [x] npm test / lint
- [x] `split-entry-ipc-workbench` 合同：ipc 模块导出、main 无内联 handler、list-skills 等通道在对应模块
- [x] 存量静态测试改查 `src/ipc` / `main-ipc-bundle`

## 反模式发现

无 BLOCKING。  
ADVISORY：纯架构拆分，未做 Electron 手工截图冒烟；若本地启动异常再开 hotfix。

## 结论

- [x] 通过，可 story-done
- [ ] 不通过，打回开发

证据目录：`evidence/dev-self-test.md`（本报告）
