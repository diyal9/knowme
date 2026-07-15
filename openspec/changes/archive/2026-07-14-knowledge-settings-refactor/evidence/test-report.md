# 测试报告: knowledge-settings-refactor

## 门禁

- [硬] npm test: **PASS**（60/60）
- [硬] npm run lint: **PASS**
- [软] qa-plan Smoke Scope: **已执行**
- [软] code-review: **已完成**

## Smoke 结果

| 用例 | 结果 | 备注 |
|------|------|------|
| 文案精简、无大路径块 | PASS | `kb-intro` 单行；路径入口收敛为「目录」 |
| 点击概念看正文 | PASS | `knowledge-read-concept` + `#kbDrawer` |
| 预览可实例化 | PASS | `#kbDrawerInstantiate` → `instantiateFromOkf` |
| 单主题导出 | PASS | 单测 `exports a single category pack` |
| 全选=整包 | PASS | 单测 `full category selection equals whole-bundle` |

## Regression

| 用例 | 结果 | 备注 |
|------|------|------|
| 导入 OKF | PASS | `btnKnowledgeImport` / IPC 未删 |
| 记忆面板 | PASS | `#btnMemoryPanel` |

## 反模式发现

### [PASS] 未勾选不静默全量
- UI Toast「请先勾选主题，或点全选」；API `categories: []` 返回错误

### [PASS] 预览不误触实例化
- 条目仅打开预览；实例化须点明确按钮

### [ADVISORY] 记忆目录快捷入口收敛
- **反模式**：原「打开记忆目录」独立行已去掉
- **预期**：高级用户可能想直接开文件夹
- **实际**：保留知识「目录」+「记忆」面板；记忆目录可从面板/系统再开
- **建议**：可接受；若投诉再加次要入口

## 结论

- [x] 通过，可 story-done
- [ ] 不通过，打回开发

证据目录：`evidence/`（本报告 + `dev-self-test.md`）
