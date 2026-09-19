# KnowMe — 智能体仓库总纲

会话启动时 **MUST** 读取本文件。本仓库是 **知我 KnowMe（Electron 桌面 AI 知识工作台 / 工作伙伴 Agent）+ 三角色 Agent Team** 的智能体驱动项目。

## 产品定位

- **是什么**：本地优先的 AI 知识工作台与工作伙伴；主界面是工作台（专家协作、工作流、管线服务）。
- **内容从哪来**：用户绑定的**本地文件夹**或 **GitLab** 仓库；应用目录只保存会话、设置与索引。
- **数据目录**：`%APPDATA%\KnowMe\`（不会自动迁移旧版数据）。

## 仓库布局

| 路径 | 内容 |
|------|------|
| `src/` | Electron 主进程、预加载、工作台与渲染层 |
| `docs/architecture.md` | 运行时分层与文件预算（人读主文档） |
| `tests/` | 冒烟测试（`npm test`） |
| `scripts/` | lint 等工具脚本 |
| `.cursor/` | Rules、Skills、Commands、Hooks、Harness、Agents |
| `openspec/` | OpenSpec 规格与变更（OPSX 工作流） |
| `brain/` | 知识库：raw / wiki / knowledge(OKF) / memory |
| `team/` | 虚拟团队宪章与角色定义 |

## 团队使命

以 **制作人 → 开发 → 测试** 三角色协作，按 OpenSpec + ReACT 持续演进 KnowMe 知识工作台与工作伙伴体验。

## 角色矩阵

| 角色 | Agent ID | Skill / Command | 职责 |
|------|----------|-----------------|------|
| 制作人 | `producer` | `team-producer` / `/role-producer` | 测试驱动规划、OpenSpec、体验验收 |
| 开发 | `developer` | `team-developer` / `/role-developer` | 架构实现、性能、自测 |
| 测试 | `tester` | `team-tester` / `/role-tester` | QA、反模式体验审查 |

编排：`team-run` / `/team-run`

## 知识库与自我进化

> **边界**：以下为 **智能体仓库开发基建**（`brain/`、Hook、`npm run kb:*`）。  
> **产品运行时**知识库与记忆在 `%APPDATA%\KnowMe\knowledge\` 与 `memory\`，见 `src/lib/product-*.ts`、设置页「知识库与记忆」。

基于 [Karpathy LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) + [OKF v0.1](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)：

| 层 | 开发仓库路径 | 产品用户数据路径 |
|----|--------------|------------------|
| Knowledge (OKF) | `brain/knowledge/` 模板/种子 | `%APPDATA%\KnowMe\knowledge\` |
| Memory | `brain/memory/` 团队回顾 | `%APPDATA%\KnowMe\memory\` |
| Wiki / Raw | `brain/wiki/`、`brain/raw/` | 仅开发用 |

| 命令 | 作用 |
|------|------|
| `/kb-ingest` | 吸收资料 → wiki + knowledge |
| `/kb-lint` | OKF 健康检查 |
| `/kb-export` | 导出 bundle 给其他用户 |
| `/kb-import` | 导入外部 OKF bundle |
| `/evolve` | 自我进化 / Skill 升格 |

### 个人会话记忆（Hook 自动）

Skill：`sticky-agent-memory`（开发侧本地会话记忆，与产品运行时无关）— 存储在 `%LOCALAPPDATA%\knowme\memory\`（不入 git）

| 能力 | 说明 |
|------|------|
| 自动采集 | 指正、产品约定、开发习惯 |
| 日/周/月 rollup | `summaries/` |
| ≥3 次重复 | 提示升 OKF 或建 Skill（须用户确认） |

```bash
npm run memory:path    # 查看当前记忆根目录
STICKY_MEMORY=0      # 关闭 Hook 记忆
```

个人记忆 → 用户确认 → `brain/knowledge/`（OKF）→ `kb:export` 分享

Story 完成后 SHOULD 写 `brain/memory/working/<change>-retro.md` 并 `/kb-ingest` 沉淀。

## 本地运行（基建）

| 命令 | 作用 |
|------|------|
| `npm start` | 清残留 → Vite 热更 → Electron `--dev`。再跑一次即重启。改界面保存即更新，**不要**为看 UI 而 `renderer:build` |
| `npm run start:dist` | 清残留后加载 `dist/renderer`（核对发行包） |
| `npm run renderer:build` | 仅出包或核对 dist 时编渲染产物 |
| `npm run kill` | 只清 KnowMe / Electron / :5173 |

启动脚本会 `chdir` 到仓库真实路径（`fs.realpathSync`）。关窗口后 `npm start` 以 0 退出。

## 工作流

```
/opsx:propose → /opsx:apply → 开发自测 → 制作人验收 → 测试 QA → /gate-check → /story-done → /opsx:archive
```

OpenSpec 命令：`/opsx:explore` `/opsx:propose` `/opsx:apply` `/opsx:sync` `/opsx:archive`

## Harness（环境 + 门禁）

```bash
npm run check                                          # 开发自测硬项一键：test + lint + test:renderer + typecheck:renderer
npm run check:quick                                    # lint + test:renderer
npm run openspec:health                                # 活跃 change 软项缺口
node .cursor/scripts/harness.js preflight --json       # 会话前（<1s）
node .cursor/scripts/harness.js gate --json --change <name>
# 或 OPENSPEC_CHANGE=<name> npm run harness:gate
```

未指定 `--change` 时，gate 软项只输出活跃 change **汇总**，不刷 40+ 条 WARN。

## 质量门禁

| 门禁 | 触发 | 硬/软 |
|------|------|-------|
| 开发自测 | tasks 完成 | 硬：`npm run check` |
| 制作人验收 | 自测通过 | acceptance.md |
| 测试接入 | 验收通过 | test-report.md |
| Story 完成 | `/story-done` | 硬：check；软：qa-plan、code-review（当前 change） |

详见 `.cursor/rules/quality-gates.mdc`

## Hooks

| 事件 | 作用 |
|------|------|
| `sessionStart` | 注入团队上下文 + preflight 摘要 |
| `beforeShellExecution` | 危险命令须用户确认 |
| `afterFileEdit` | `src/` 变更提示跑 test/lint |
| `stop` | 提醒未过门禁时勿宣称完成 |

## 安全约束

- 同进程执行任务；端口占用可覆盖
- 破坏性操作（`rm -rf`、`git reset --hard`、force push 等）**须用户确认**
- 危险指令由 hook + rule 双重拦截

## 导航

- 宪章：`team/charter.md`
- 角色：`team/roles/`
- 进化：`team/evolution/skill-promotion.md`
- 知识库：`brain/knowledge/index.md`
- Wiki：`brain/wiki/index.md`
- OpenSpec 配置：`openspec/config.yaml`
- 团队规则：`.cursor/rules/team-workflow.mdc`
- **Daemon / 管线服务协议**：`docs/daemon/API.md`（上游同步）· `docs/daemon/README.md`（KnowMe 端点说明）

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **knowme** (30264 symbols, 49216 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/knowme/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/knowme/context` | Codebase overview, check index freshness |
| `gitnexus://repo/knowme/clusters` | All functional areas |
| `gitnexus://repo/knowme/processes` | All execution flows |
| `gitnexus://repo/knowme/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
