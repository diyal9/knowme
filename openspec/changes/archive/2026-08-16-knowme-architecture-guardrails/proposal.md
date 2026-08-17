## Why

统一结构完成后，必须用可执行规则锁住分层、文件预算和便签退役，避免上帝文件与双份实现回流。

## What Changes

- 人读主文档 `docs/architecture.md`
- Cursor Rule `architecture.mdc` alwaysApply
- `scripts/check-architecture.js` 纳入 `npm run lint`
- 质量门禁增加架构检查与 `typecheck:renderer`
- OpenSpec context 去掉「原生 HTML/JS」
- 宪章：无 OpenSpec 不得新表面；超 400 行不得合入

## Capabilities

### New Capabilities
- `knowme-architecture-guardrails`: 机器执法的分层与文件预算

### Modified Capabilities
- （无产品行为变更）

## Impact

- 受影响代码：lint 脚本、规则、文档
- 目标用户：开发与制作人（防回归）
- 验收标准：故意超 400 行或新增 `src/foo.html` 时 lint 红；删样例后绿
- 非目标：把 `src/lib` 全部改写成 TS；改 IA / Daemon
