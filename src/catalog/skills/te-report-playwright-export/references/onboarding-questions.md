# 执行前确认（AskQuestion）

**前置**：`check_te_login.py` 对目标 TE 报表 URL exit **0**（`browser_mode=cdp` 时可跳过）。

## Q1 — 报表来源

| 输入 | 行为 |
|------|------|
| **飞书文档 / Wiki** | `resolve_report_url.py` 提取文内**全部** TE 链接 → 批量导出 |
| **单个 TE 报表 URL** | 直接 `export_te_report_csv.py` |
| **多个 TE 报表 URL** | `batch_export_te_report_csv.py --url ... --url ...` |

## Q2 — 本地 CSV 目录

读 memory `last_output_dir` → 可选「沿用上次的」；须为**绝对路径**。

选定目录后**必须先检测是否已有文件**：

```bash
python scripts/check_output_dir.py --output-dir "<dir>"
```

若 exit **30**（目录非空），**AskQuestion — 已有文件如何处理**：

| 选项 | `--on-existing` | 说明 |
|------|-------------------|------|
| 覆盖重新导出 | `overwrite` | 同名 CSV / manifest 被新文件覆盖 |
| 跳过已成功项 | `skip` | 仅导出尚无成功 manifest+CSV 的报表 |
| 归档后全新导出 | `archive` | 旧文件移入 `output-info/archive_<时间戳>/` |
| 取消 | `abort` | 不执行导出 |

展示 `scan.csv_samples`（最多 12 个文件名）帮助用户判断。

## Q3 — 导出后纠正规则

写入 `rules/corrections.yaml`（选择器、等待时间等，见 correction-rules-schema）。

## 执行顺序

```bash
python scripts/check_output_dir.py --output-dir "<dir>"

python scripts/resolve_report_url.py "<input>"
python scripts/check_te_login.py --url "<te_url>" --memory-root "<memory_root>"

# 单条（用户选定 on-existing 后）
python scripts/export_te_report_csv.py \
  --url "<te_url>" --output-dir "<dir>" --memory-root "<memory_root>" \
  --on-existing overwrite

# 批量
python scripts/batch_export_te_report_csv.py \
  --input "<feishu_or_te>" --output-dir "<dir>" --memory-root "<memory_root>" \
  --on-existing skip --skip-login-gate
```

## 无头慢 → 本机浏览器

memory `browser_mode` 或 CLI：

- `--browser-mode chrome` — 本机 Chrome 无头（通常比内置 Chromium 快）
- `--browser-mode headed` — 弹出 Chrome 窗口
- `--browser-mode cdp --connect-cdp http://127.0.0.1:9222` — 连接已开 Chrome（需 `--remote-debugging-port=9222`）

## 无导出按钮

> 该 TE 报表页**未找到「导出」按钮**，无法自动下载与页面一致的 CSV。  
> 请确认链接为可导出报表页，或手动在浏览器导出后把 CSV 路径发我。  
> 截图：`<output-dir>/output-info/no_export_button_<slug>.png`

## 未登录 TE

> 请先在本机终端运行 `bootstrap_auth.sh --te-login --skip-feishu` 登录 **bi.forevernine.net**，完成后回复「已登录」。
