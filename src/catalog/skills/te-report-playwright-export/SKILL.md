---
name: te-report-playwright-export
description: 从飞书文档中的 TE 报表链接或直接给出的数数报表 URL，用 Playwright 点击页面导出按钮并保存真实 CSV；当用户说 TE/数数报表导出、BI 导出 CSV 或给出 bi.forevernine.net 链接时使用。
version: 1.0.0
disable-model-invocation: false
---

# TE 报表 CSV 导出

本技能原样携带 th-BI 的 Playwright 导出实现。目标是得到与报表页面“导出”按钮一致的 CSV；禁止用 `query_report_data` 拼 CSV 冒充页面全量导出。

## 路由

| 输入 | 脚本 |
|---|---|
| 单个 TE 报表 URL | `scripts/export_te_report_csv.py` |
| 多个 TE URL 或含多个链接的飞书文档 | `scripts/batch_export_te_report_csv.py` |
| 判断输入类型 | `scripts/resolve_report_url.py` |
| 检查输出目录是否已有文件 | `scripts/check_output_dir.py` |
| 登录状态与首次授权 | `scripts/bootstrap_auth.py` / `scripts/check_te_login.py` |

所有脚本都通过 `run_skill_script(skill_id="te-report-playwright-export", ...)` 调用，stdout 是 JSON，进度在 stderr。不得只把命令贴给用户后声称已执行。

运行依赖见 `requirements.txt`：Python 需要 Playwright 与 PyYAML；首次使用 Playwright Chromium 时需完成浏览器安装，或改用本机 `chrome` / `cdp` 模式。解析飞书文档还需要已登录的 `lark-cli`。依赖或登录态缺失时返回可操作的配置提示，不得降级成伪造 CSV。

## SOP

1. 确认输入链接、输出目录和浏览器模式。飞书文档还需本机 `lark-cli` 登录态；TE 未登录时按 [auth-bootstrap.md](references/auth-bootstrap.md) 启动登录。
2. 先运行 `scripts/check_output_dir.py --output-dir <dir>`。exit 30 表示目录非空，必须请用户选择 `overwrite`、`skip`、`archive` 或 `abort`，不能自动覆盖。
3. 单条调用 `export_te_report_csv.py --url <url> --output-dir <dir> --memory-root <memory-root>`；批量调用 `batch_export_te_report_csv.py`，可用 `--input` 或多个 `--url`。
4. 保留页面加载顺序：`domcontentloaded → networkidle → loading 消失 → 固定等待 → 轮询导出按钮`。不要为了速度跳过 networkidle。
5. exit 0 才能回报成功并给出文件路径；exit 10 进入登录；exit 20 报告无导出按钮并附截图路径；exit 30 重新询问覆盖策略。
6. 批量导出后核对 `output-info/_batch_summary.json`，逐项报告成功、跳过和失败；失败项可用 `--retry-from-summary` 重试。

## 浏览器模式

- `headless`：默认 Playwright Chromium。
- `chrome`：本机 Chrome 无头。
- `headed`：显示 Chrome，适合首次登录。
- `cdp`：连接已打开的 Chrome；workers 自动降为 1。

详细首次提问见 [onboarding-questions.md](references/onboarding-questions.md)，登录与 storage state 见 [auth-bootstrap.md](references/auth-bootstrap.md)。

## 红线

1. 只接受页面真实导出；找不到按钮就明确失败。
2. 输出目录已有文件时不静默覆盖。
3. 登录态、Cookie 和 storage state 不写入知识库或回答正文。
4. 未得到真实脚本回执时，不声称 CSV 已生成。
