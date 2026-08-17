# Acceptance: split-agent-run-and-studio-by-domain

## 验收项

- [x] `agent-run-executor.ts` 拆为组合根 + `agent-run-executor/` 子模块，各文件 ≤800 行
- [x] `agent-run-manager.ts` 拆为组合根 + `agent-run-manager/` 子模块，各文件 ≤800 行
- [x] 对外 `require('./agent-run-executor')` / `require('./agent-run-manager')` 路径与导出符号不变
- [x] 相位函数显式 deps，无共享 mutable god ctx
- [x] Run 状态机语义、输出协议、IPC 未改
- [x] Studio **不作** 拆分（design 已记录理由）
- [x] 定向测试 PASS（110/110）
- [x] `npm run lint` PASS（architecture 无 WARN）

## 制作人体验

- 纯重构，无 UI 变更；Studio UMD 回归测试通过。
