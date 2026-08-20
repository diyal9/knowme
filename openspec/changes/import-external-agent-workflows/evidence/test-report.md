# Test Report

日期：2026-08-19

## 目标范围

- 专家包装回归：能力目录仅出现 `external-capability-importer / expert`；curated 安装写入 Expert 目录并可由 Expert Runtime 加载，安装目录没有 `SKILL.md`。
- Node：30 tests / 30 pass（精确规划、生命周期、Agent 工具、Manifest 与 Catalog）
  - `cursor-capability-repository`
  - `agent-capability-import-tools`
  - `capability-manifest-v2`
  - catalog / naming / hub contracts
- Renderer：`capability-hub.spec.tsx` 15 tests / 15 pass
- `npm run lint`：通过
- `npm run typecheck:renderer`：通过

## th-art 真实目录验证

- 扫描：22 Skill、5 Expert、0 可安全导入 Connector、3 Workflow、1 blocked。
- 精确规划：1 Workflow、2 Expert、10 Skill。
- 临时用户目录注册：13 installed、0 skipped、0 failed，`complete: true`。
- `th-art-psd-to-artbundle`：`team / draft`，17 nodes，5 gates，专家引用为 `ui-expert` 与 `artbundle-expert`，10 个 Skill 引用全部验证通过。
- 旧 `th-art-fixed-ui-artbundle` 因 deprecated 跳过。
- `creator_mcp` 因本机 SSE + 明文 Authorization 被安全策略阻止；报告未包含凭据值。

## 全仓门禁状态

`npm run check` 未全绿，失败来自当前工作区中与本 change 无关的并行改动：

1. Node 全量 1704 项中 2 项失败：
   - `capability-pack.test.js` 的 legacy scene-only 安装在全量并发时偶发失败；单文件复跑通过。
   - 两份画布测试对 `human/action` 与 `tool` 的可见性要求互相冲突。
2. Renderer 全量 303 项中 1 项失败：未跟踪的 `personal-agent.css` 使用 11px 字号，违反现有 CSS contract。

本 change 的目标测试、lint 与 typecheck 均通过；未改写上述其它活跃 change 的文件来掩盖门禁。
