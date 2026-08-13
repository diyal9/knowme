# 开发自测 — Workbench Bootstrap 生产可部署性

日期：2026-08-04

## 变更摘要

- 版本化外部 patch：`vendor/workbench-compat/`（manifest + unified diff）
- Bootstrap 模块：`src/lib/workbench-bootstrap.js`
- 设置页：Workbench 安装目录 + 检测/注册/安装兼容层
- CLI：`npm run workbench:bootstrap`

## 自测清单

| 项 | 命令/操作 | 结果 |
|---|---|---|
| 单元测试 | `npm test` | **924 PASS** |
| Lint | `npm run lint` | **PASS** |
| 干净环境 Bootstrap | `npm run test:workbench-clean-env` | **PASS**（`workbench-clean-env.json`） |
| Daemon 真实 E2E | `npm run test:daemon-e2e` | **PASS**（bootstrap 自动 apply + exit 0 + 6 artifacts） |
| Harness gate | `npm run harness:gate` | **PASS** |

## 干净环境证据要点

- 临时目录从 upstream `ae2de9c` 种子文件启动，**无手工 patch**
- `needs_patch` → apply compat → `applied`
- deploy workflows → index/registry/脚本齐全
- 篡改文件后 `unknown_version` 诚实阻断

## 不再依赖

- ❌ 未提交的第二仓库 working tree patch
- ❌ 手工 `npm run workbench:sync`（已由 bootstrap/E2E 自动替代；sync 脚本保留为薄封装）
