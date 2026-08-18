# Tasks: quality-pass-token-and-hygiene

## Implementation

- [ ] 1. 在 `.workbench` 补 `--wb-border: var(--wb-line)`
- [ ] 2. `.wb-run-btn.primary` / `.wb-modal-btn.primary`（含 workflow-detail hover）接 accent
- [ ] 3. Daemon review 进度条与 step-mark 状态色接 `--wb-success/warning/danger`
- [ ] 4. `.wb-studio-tool-btn.primary` 硬编码绿改 token
- [ ] 5. 删除 `INTENT_TEMPLATES` 死代码；移除 `MOCK_CATALOG` 并更新测试
- [ ] 6. `npm test` && `npm run lint`

## QA

- [ ] Smoke：打开工作台任务运行底栏、启动弹窗、Daemon 审阅步骤色、Studio 保存钮，确认绿主色一致
