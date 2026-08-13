# Code Review — strengthen-workbench-tool-surface

> 开发初稿 + **测试 QA 补充**（2026-08-06）

## 范围确认

- [x] 未 touch 6 个活跃 change 专属路径（见 proposal Impact 隔离清单）
- [x] 变更集中在 `src/lib/*tool*`、`connectors/tool-runtime`、`main.js` IPC、`workspace-agent.js` 审批 UI
- [x] OpenSpec delta specs 与实现一致（registry / file / process / artifact / feishu draft / orchestration）
- [x] 测试独立重跑 `npm test` 1069/1069、`lint`、harness gate、openspec strict validate

## 安全

- [x] 写文件/飞书写：draft → approve → apply → audit（`tool-drafts-store` + `tool-approve-draft` IPC）
- [x] path traversal 拒绝（`isTraversalPath` + `sources.resolveUnderRoot`）
- [x] 危险 shell 拦截（`agent-sandbox.screenCommand` + DANGEROUS_PATTERNS）
- [x] 幂等键防重复 pending draft（`tool-drafts-store.rememberDraft`）
- [x] fake 测试 spy 断言 0 次真实 Feishu CLI 写
- [x] 双批准返回 `not_pending`，无重复副作用（anti-pattern + IPC roundtrip 验证）
- [x] 渲染进程不直接 fs.write/spawn（D8 IPC 边界遵守）

## 资源与竞态

- [x] 进程 cancel 与 Run cancel 联动（`cancelProcessesForRun`）
- [x] 子 Run 预算 depth≤1、parallel cap（`agent-orchestration.test.js`）
- [ ] **ADVISORY**：symlink 在 Windows 上 `resolveUnderRoot` 可能跟随链接到 root 内路径；若需严格禁止 symlink 逃逸，应加 `lstat` + `realpath` 校验（当前与只读文件工具一致）

## 权限与兼容

- [x] `KNOWME_TOOL_SURFACE=legacy` 无 write/run_task 投影（node + Electron 验证）
- [x] v1 默认全量工具；draft store v2 向前兼容
- [x] MCP stdio 路径不退化；HTTP transport 为增量

## UX / 可发现性（测试 ADVISORY）

- [ ] 审批卡 summary 未展示 path/connector（`renderToolApprovalCard` 仅 badge+hint）
- [ ] 回滚 IPC 存在（`toolRollbackDraft`）但 UI 无入口
- [ ] mkdir 低风险直建符合 spec，但缺用户向说明
- [ ] Hub Playwright 安装指引未 UI 走查（文档化于 `windows-smoke.md`）

## 测试

- [x] ≥40 新增工具层用例（实际 65 专项 + 24 反模式）
- [x] 闭环 eval 100%（`tool-surface-closed-loop` + agent-eval 7/7）
- [x] Electron IPC approve/reject roundtrip（`tester-electron-ipc-roundtrip.js`）
- [x] 回归：`npm test` 全绿

## 测试结论

**无 BLOCKING。** 上述 UX 项为 ADVISORY，不阻塞 story-done。

## 待跟进（非阻塞）

- [ ] Capability Hub Playwright 安装指引 UI 点击流
- [ ] 审批卡 target path 摘要 + 回滚 UI 入口（建议独立 UX Story）
- [ ] Windows manual：飞书真 apply + Playwright MCP（需用户凭据）
