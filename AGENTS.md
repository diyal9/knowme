# KnowMe — 智能体仓库总纲

会话启动时 **MUST** 读取本文件。本仓库是 **Electron 桌面便签 + 三角色 Agent Team** 的智能体驱动项目。

## 仓库布局

| 路径 | 内容 |
|------|------|
| `src/` | Electron 主进程、预加载、便签 UI |
| `tests/` | 冒烟测试（`npm test`） |
| `scripts/` | lint 等工具脚本 |
| `.cursor/` | Rules、Skills、Commands、Hooks、Harness、Agents |
| `openspec/` | OpenSpec 规格与变更（OPSX 工作流） |
| `brain/` | 知识库：raw / wiki / knowledge(OKF) / memory |
| `team/` | 虚拟团队宪章与角色定义 |

## 团队使命

以 **制作人 → 开发 → 测试** 三角色协作，按 OpenSpec + ReACT 持续演进 KnowMe 桌面便签产品。

## 角色矩阵

| 角色 | Agent ID | Skill / Command | 职责 |
|------|----------|-----------------|------|
| 制作人 | `producer` | `team-producer` / `/role-producer` | 测试驱动规划、OpenSpec、体验验收 |
| 开发 | `developer` | `team-developer` / `/role-developer` | 架构实现、性能、自测 |
| 测试 | `tester` | `team-tester` / `/role-tester` | QA、反模式体验审查 |

编排：`team-run` / `/team-run`

## 知识库与自我进化

> **边界**：以下为 **智能体仓库开发基建**（`brain/`、Hook、`npm run kb:*`）。  
> **产品运行时**知识库与记忆在 `%APPDATA%\KnowMe\knowledge\` 与 `memory\`，见 `src/lib/product-*.js`、设置页「知识库与记忆」。

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

Skill：`sticky-agent-memory` — 存储在 `%LOCALAPPDATA%\knowme\memory\`（不入 git）

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

## 工作流

```
/opsx:propose → /opsx:apply → 开发自测 → 制作人验收 → 测试 QA → /gate-check → /story-done → /opsx:archive
```

OpenSpec 命令：`/opsx:explore` `/opsx:propose` `/opsx:apply` `/opsx:sync` `/opsx:archive`

## Harness（环境 + 门禁）

```bash
node .cursor/scripts/harness.js preflight --json   # 会话前（<1s）
node .cursor/scripts/harness.js check --json       # 只读健康检查
node .cursor/scripts/harness.js gate --json        # Story 完成硬门禁
node .cursor/scripts/harness.js doctor --json      # 诊断 + 修复建议
```

npm 别名：`npm run harness:preflight` / `harness:check` / `harness:gate`

## 质量门禁

| 门禁 | 触发 | 硬/软 |
|------|------|-------|
| 开发自测 | tasks 完成 | 硬：test + lint |
| 制作人验收 | 自测通过 | acceptance.md |
| 测试接入 | 验收通过 | test-report.md |
| Story 完成 | `/story-done` | 硬：test/lint；软：qa-plan、code-review |

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
