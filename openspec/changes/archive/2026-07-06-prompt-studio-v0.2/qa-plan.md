# QA Plan: prompt-studio-v0.2

## Smoke Scope（必填）

- [ ] 启动应用，托盘/总览文案体现 Sticky-Notes 定位
- [ ] 新建提示词 → 结构化模式填写五段 → 保存 → 重启后 sections 与 content 一致
- [ ] 自由模式 ↔ 结构化模式切换不丢正文
- [ ] 迭代新版本 → 版本历史可见 → 两版 diff 可查看
- [ ] 总览按 category / okfTags 筛选，结果正确
- [ ] 打开「使用记忆」面板，近期记录可见；点击跳转对应卡片
- [ ] 卡片「收录到知识库」→ 设置页概念数 +1；Concept 文件存在且含 source_note_id
- [ ] 从 Concept「实例化为卡片」→ 新卡片内容正确
- [ ] 卡片内 AI 生成流式正常（有 API Key 时）
- [ ] 设置页版本显示 `0.2.0`

## Regression Scope

- [ ] `npm test` 通过（含 prompt-sections、prompt-okf、迁移测试）
- [ ] `npm run lint` 通过
- [ ] 旧 v0.1.x 格式卡片（无 sections/category）正常打开编辑
- [ ] 多窗口、托盘、热键 `Ctrl+Alt+N` 仍可用
- [ ] 便签备份导出/导入仍可用
- [ ] 知识库 OKF 导入/导出仍可用
- [ ] API Key safeStorage 降级逻辑未破坏
- [ ] 检查更新、关于页仍可用

## Anti-pattern Checks

- [ ] 结构化模式只保存 sections 不更新 content（应同时更新）
- [ ] 空 category 筛选导致全库隐藏或崩溃
- [ ] promote 同一卡片重复点击产生大量重复 Concept 且无提示
- [ ] instantiate 覆盖已有卡片而非新建
- [ ] 记忆面板空数据时显示友好空状态，非空白页
- [ ] 无 API Key 时 AI 分类建议按钮导致报错弹窗
- [ ] diff 超大文本时 UI 卡死
- [ ] parentNoteId 环引用导致版本列表死循环

## Release QA（Story 末）

- [ ] `package.json` 版本 `0.2.0`
- [ ] 本地打包 `dist-release` 或 CI 构建成功
- [ ] Release notes 描述 v0.2.0 定位变化与主要功能
- [ ] tag `v0.2.0` 后 GitHub Release 资产可下载（用户确认发布时）

## Evidence

- `openspec/changes/prompt-studio-v0.2/evidence/dev-self-test.md`
- `openspec/changes/prompt-studio-v0.2/evidence/test-report.md`
- `openspec/changes/prompt-studio-v0.2/evidence/screenshots/`（可选）

## Mac / 签名

- [ ] 延续 v0.1.1 状态：未签名披露不变；Mac 实机仍记阻塞（非本 Story 范围）
