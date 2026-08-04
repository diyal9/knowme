# Retro: admin-remote-config-mvp

- 日期：2026-07-30
- 状态：已 `/story-done` 归档 → `openspec/changes/archive/2026-07-30-admin-remote-config-mvp/`

## 交付

独立 `server/`（Go + Gin + SQLite）管理后台 MVP：healthz、公共配置读取、管理员配置更新（`X-Admin-Key`）、Web 登录/会话/用户管理；客户端可选 `src/lib/remote-config-client.js` + merge（默认关闭，不改工作台行为）。

## 门禁证据

- 开发自测：`evidence/dev-self-test.md`
- 制作人验收：`acceptance.md`（2026-07-30 通过）
- 测试报告：`evidence/test-report.md`（实机 curl 冒烟表）
- 硬门禁：`harness.js gate --json` → `ok:true`；`go test ./...` PASS、`npm test` 496/496、`npm run lint` PASS

## 实机冒烟（:8020）

| 项 | 结果 |
|---|---|
| healthz | 200 |
| 无 `X-Admin-Key` PUT | 401（反模式✓）|
| 带 Key PUT | 200 落库 |
| `/v1/config/public` 回读 | 与写入一致 |
| Web 登录 admin/admin123 | 302 |
| 有会话 `/admin/config` | 200 |
| 无会话 `/admin/config` | 302→登录 |

## 复盘要点

- A/B 线隔离成功：本 change 只新增 `server/`、`src/lib/remote-config-*` 等，未触碰 A 线工作台文件；A 线已先行归档，无冲突。
- 手动冒烟用 curl 直打服务端即可覆盖 API + 鉴权 + Web 会话；客户端合并/非 loopback 拒连由单测兜底，Electron 设置页拖拽为 ADVISORY。
- 归档仍走手动 `mv archive/YYYY-MM-DD-<name>/`（无 openspec CLI）。
- 后续（code-review 未闭项）：Postgres driver、配置版本化、完整 Admin UI。
