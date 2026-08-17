## Why

生成主路径拆文件后只剩实现、没有职责边界说明；后续编码也没有注释硬约束。维护成本高，且与「言简意赅、必要注释」的开发约定脱节。

**目标用户**：KnowMe 仓库开发智能体与工程师。  
**体验/商业化价值**：降低主链路误改风险（记忆策略、子 Agent 隔离、IPC 壳），缩短接手时间。

## What Changes

- 新增 Cursor rule：编码 MUST 含文件头、重要导出函数、非显而易见常量；禁止废话/复述代码
- `architecture.md` / `architecture.mdc` 增加对应 MUST
- 为 `ai-generate` 主链路模块补齐三类注释（示范，非全库回填）

## 验收标准

- Rule 对 `src/**` 始终生效；新/改模块缺必要注释视为不合格
- 生成主链路 7 个模块均有文件头 + 导出函数注释 + 关键常量注释
- `npm test` / `npm run lint` 通过

## 非目标（Non-goals）

- 不全库回填存量文件
- 不把注释做成 lint 硬门禁（本 Story）
- 不扩 JSDoc/checkJs 白名单、不改运行时行为

## Capabilities

### New Capabilities

- `src-comments`: 源码必要注释约定（文件头 / 导出函数 / 常量）及生成主链路示范覆盖

### Modified Capabilities

（无）

## Impact

- `.cursor/rules/`、`docs/architecture.md`
- `src/ipc/ai-generate.ts`、`src/lib/agent-generate-*.ts`、`src/lib/agent-context-orchestrator.ts`
- 无 IPC/API/依赖变更
