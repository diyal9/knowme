# 制作人体验验收: refactor-checkpoint-closeout（v0.4.0 工程基线）

## 核心路径
- [x] 本树定位为 **v0.4.0 React+TS 工程基线**，非整包产品 1:1 完成
- [x] 主规格与实现一致（气泡无「应用到文件」；写入走产物卡）
- [x] ContentView source 切换不闪旧内容（vitest 覆盖）
- [x] LLM Endpoint IPv4 优先且允许纯 IPv6 自定义 Endpoint（单测覆盖）
- [x] 薄表面走查有结论（能开 / 仍薄；见 `evidence/producer-walkthrough.md`）
- [x] 未完成 epic / restore 缺口已转入 `openspec/changes/BACKLOG.md`

## 体验标准
- 不把「门禁全绿」当成产品完成
- 不把 Worker 架构当成性能完成（须真机长文 profiler；本轮 Electron smoke 通过，无 fps profiler）

## 验收结论
- [x] **v0.4.0 工程基线通过**（像素 1:1 / 全薄表面补齐 / profiler 属 v0.5.0 产品需求，见 BACKLOG）
- [ ] 不通过
- 验收人：制作人
- 日期：2026-08-18

本 change 收口 v0.4.0 发布候选；产品增长项从 BACKLOG 单独立项。
