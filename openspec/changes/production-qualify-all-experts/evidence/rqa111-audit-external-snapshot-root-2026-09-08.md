# RQA111：生产能力审计外置快照根目录

日期：2026-09-08

## 目的

生产能力审计需要读取真实 `%APPDATA%/KnowMe` 用户数据，但不应因为审计进程所在环境无法写入用户数据目录，就把所有专家误判为快照失败。正式运行时仍保持默认快照目录和原有写入门禁；本项只为审计提供显式的隔离快照目录。

## 变更

- `createExpertRuntime` 支持可选 `snapshotRoot`，未提供时仍使用原来的 `capabilities/snapshots`。
- capability hub 以可选依赖注入方式传递该目录，不改变正式运行时默认行为。
- `audit-production-capabilities.js` 支持 `--snapshot-root <path>`。
- 审计脚本直接执行仍自动加载 TypeScript 注册器。

## 验证

1. 聚焦回归：后端 50/50 通过，0 失败。
2. 完整 `npm run check`：
   - 后端 3509 项，3458 通过，51 跳过，0 失败；
   - Renderer 86 个文件、620 项通过；
   - lint、CSS cascade、script scope、prompt lint、renderer typecheck 通过。
3. 使用真实 `%APPDATA%/KnowMe` 作为输入，使用工作区 `.tmp/production-audit-snapshots` 作为快照根目录执行：退出码 0，实际生成专家快照文件。
4. 结构化摘要：`packageReady=true`、`degradedExperts=[]`；`executionReady=false`、`productionReady=false`，仍有 7 条条件路线未取得真实工具回执，0 条路线被误提升为 verified。

## 结论

审计写入权限问题已与专家能力问题隔离，审计结果可复现；没有放宽真实执行证据门禁。当前总体目标继续 ACTIVE，后续仍需完成 7 条真实工具路线、独立专业评审和完整生图交付验收。
