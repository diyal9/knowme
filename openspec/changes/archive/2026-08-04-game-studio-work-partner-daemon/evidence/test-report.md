# 测试报告: game-studio-work-partner-daemon (follow-up + bootstrap)

## 摘要

| 项目 | 结果 |
|------|------|
| 单元/集成 | **924 PASS** |
| Lint | **PASS** |
| Harness gate | **PASS** |
| 干净环境 Bootstrap | **PASS**（临时目录，无手工 patch） |
| Daemon 在线 E2E | **PASS**（bootstrap 自动注册 + exit 0 + 6 交付物） |
| Daemon 失败路径 | **PASS**（短 brief → script exit 1 + resume 提示） |
| 飞书真实 OAuth | NOT VERIFIED（安全预期） |

## 生产可部署性（Bootstrap）

| 项 | 说明 |
|---|---|
| 外部 patch 审计 | `vendor/workbench-compat/AUDIT.md` + `patches/knowme-cli-required-v1.patch` |
| 版本锚点 | Workbench `ae2de9c` + pre-patch SHA256 校验 |
| 路径解析 | 设置 `workbenchInstall.path` / `KNOWME_WORKBENCH_INSTALL` / 自动发现（无硬编码唯一来源） |
| 产品入口 | 设置 → Workbench 部署与兼容；Daemon overview 含 `bootstrap` 状态 |
| 干净环境证据 | `evidence/workbench-clean-env.json` |

**协议结论**：上游 Daemon **不**通过 `/api/health` 或 workflow schema 原生跳过 CLI preflight；KnowMe 在哈希匹配时幂等应用版本化 compat patch。长期建议合并 patch 至 Workbench 上游（需第二仓库授权）。

## 根因与修复

| 层级 | 原问题 | 修复 |
|------|--------|------|
| 工作流选型 | E2E 使用 `demo-experience`（agent 节点） | 默认 `game-dev-delivery`（script-only，`cli_required: false`） |
| CLI preflight | 缺少 `CURSOR_API_KEY` → daemon exit 1 | KnowMe bootstrap 版本化 compat patch（非未提交手工 patch） |
| 部署 | 依赖手工 `workbench:sync` | `workbench-bootstrap.js` + E2E 自动 deploy/apply |
| Handoff 协议 | 无 GitLab 时仍带 `inputs.prd` | meta-only context |
| 鉴权 | guest 无法 create | Bearer token（设置 / 环境变量，日志不泄露） |

## 真实 E2E 证据（2026-08-04）

- JSON：`evidence/daemon-live-e2e.json`（含 `bootstrap` 步骤，`ok: true`）
- 干净环境：`evidence/workbench-clean-env.json`（`ok: true`）
- 成功任务：`game-req-*`，`returncode: 0`，6 artifacts
- 交付物快照：`evidence/daemon-artifacts/`

## 用例

1. **策划结构化需求案** — PASS
2. **需求交接 Workbench（meta-only）** — PASS
3. **Bootstrap 干净环境** — PASS
4. **Daemon game-dev-delivery 真实执行** — PASS（exit 0 + delivery-pack/manifest）
5. **失败可恢复路径** — PASS
6. **未知版本阻断** — PASS（`unknown_version`）
7. **客户端校验** — PASS

## Word 报告

`evidence/KnowMe-手机游戏研发工作伙伴-UAT测试报告.docx`（含 bootstrap 结论）
