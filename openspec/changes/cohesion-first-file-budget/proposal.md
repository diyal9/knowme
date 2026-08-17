## Why

行数硬门禁把「文件长」当成架构问题，驱动按行数切碎模块（闭包改 `ctx`、prototype 外挂），耦合不降、测试易碎。真正要拦的是多变化原因挤在一个上帝文件，以及单文件已经「过于庞大」。

## What Changes

- 架构规范改为 **高内聚、低耦合优先**：按变化原因拆域，禁止为过行数而拆。优先级：单一职责 > 模块化 / 组件化 > 行数。
- **1200 行 = 告警**（lint 打印 WARN，不失败）。
- **2000 行 = 过于庞大，硬失败**；仅存量已超 2000 的路径进 shrinking 白名单。
- 停止 `split-lib-god-files-by-domain` 里「全部锯到 ≤400」的剩余任务。

## 目标用户

后续改 `src/lib` 的开发者：能按域改一块完整能力，而不被行数门禁逼成碎片文件。

## 验收标准

- `docs/architecture.md` 与 `architecture.mdc` 写明：单一职责优先，1200 告警、2000 硬顶。
- `npm run lint`：1200 行以下不告警；1200～2000 仅 WARN。
- 现有已 >2000 的文件在白名单内且只许缩小；新增 `src/**/*.ts` 不得无白名单超过 2000。
- 不为过行数再机械拆文件。

## 非目标（Non-goals）

- 不在本 change 里拆 `feishu-cli` / Hub / executor。
- 不放宽「禁止双份规则、禁止 vm concat、禁止 `src/lib` 新增 `.js`」。
- 不修本会话之前已存在的执行器测试红。

## Capabilities

### New Capabilities

- `file-budget-cohesion`: 文件预算以内聚与「过于庞大」执法，1200 行为告警、2000 行为硬顶。

### Modified Capabilities

- （无产品 IPC/表面变更）

## Impact

- `docs/architecture.md`、`.cursor/rules/architecture.mdc`、`team/charter.md`
- `scripts/check-architecture.js`、`scripts/architecture-lib-oversize.json`
- `openspec/changes/split-lib-god-files-by-domain` 剩余按行数拆的任务作废
