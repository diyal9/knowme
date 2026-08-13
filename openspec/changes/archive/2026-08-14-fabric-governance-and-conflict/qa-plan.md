# QA Plan · fabric-governance-and-conflict

## Smoke Scope

| # | 场景 | 步骤 | 期望 |
|---|------|------|------|
| S1 | 打开治理 Tab | 知识库 → 治理 | Tab 可见，空状态有「运行体检」 |
| S2 | 运行联合体检 | 点击「运行体检」 | 健康分、分类计数、问题列表渲染 |
| S3 | 行动项 | 对一条问题点「忽略」或「清理提案」 | toast 成功，列表刷新 |
| S4 | SSOT 模式 | 切换 SSOT 下拉 | 保存成功 toast |
| S5 | 控制台 | 全程 | 0 error |

## Regression

- 织网/检索 Tab 仍可用（runAsyncKnowledgeButton 不卡死）
- ingest 在 mark 模式下仍可写入

## Evidence

- `evidence/test-report.md`
- `evidence/fabric-governance-electron-smoke.json`
- `evidence/screenshots/governance-*.png`
