#!/usr/bin/env python3
"""
通过 Playwright 打开 TE 报表页并触发「导出 CSV」，使文件与页面下载一致。

⚠️ 依赖本机已登录 bi.forevernine.net（持久化浏览器 profile 或手动先登录）。
⚠️ 导出按钮选择器需按实际 DOM 调整（见 SELECTORS）。

用法:
  pip install playwright
  playwright install chromium

  python te_bi_playwright_export.py \\
    --url "https://bi.forevernine.net/#/tga/retention/2_86037" \\
    --output "d:/downloads/report_export.csv" \\
    [--user-data-dir "%LOCALAPPDATA%/te-bi-playwright-profile"]

未安装 playwright 时仅打印操作说明（--dry-run）。
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# 按 BI 前端实际 DOM 修改（示例占位，须抓包或审查元素后更新）
SELECTORS = {
    # 工具栏「导出」主按钮
    "export_button": "button:has-text('导出'), [data-testid='export'], .export-btn",
    # 若导出为下拉，第二项「导出 CSV」
    "export_csv_item": "text=导出 CSV, text=下载 CSV, li:has-text('CSV')",
}


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="TE BI 报表 Playwright 导出 CSV")
    p.add_argument("--url", required=True, help="报表完整 URL（含 #/tga/...）")
    p.add_argument("--output", required=True, type=Path, help="保存 CSV 路径")
    p.add_argument(
        "--user-data-dir",
        type=Path,
        default=None,
        help="Chromium 用户目录（保留登录态）",
    )
    p.add_argument(
        "--timeout-ms",
        type=int,
        default=120_000,
        help="等待下载超时（毫秒）",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="只打印步骤，不启动浏览器",
    )
    return p.parse_args()


def dry_run_instructions(args: argparse.Namespace) -> None:
    print("Playwright 导出步骤（需本地执行）:")
    print(f"  1. 打开: {args.url}")
    print(f"  2. 确认已登录 bi.forevernine.net")
    print(f"  3. 点击导出 → CSV")
    print(f"  4. 保存到: {args.output}")
    print("选择器占位:", SELECTORS)
    print("\n或在 Cursor 中启用 user-playwright MCP，由 Agent 执行 navigate + click + 下载。")


def run_playwright_export(args: argparse.Namespace) -> int:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("未安装 playwright。请: pip install playwright && playwright install chromium", file=sys.stderr)
        dry_run_instructions(args)
        return 1

    args.output.parent.mkdir(parents=True, exist_ok=True)

    launch_kwargs: dict = {"headless": False}
    if args.user_data_dir:
        launch_kwargs["user_data_dir"] = str(args.user_data_dir.expanduser())

    with sync_playwright() as p:
        if args.user_data_dir:
            context = p.chromium.launch_persistent_context(
                str(args.user_data_dir.expanduser()),
                headless=False,
                accept_downloads=True,
            )
            page = context.pages[0] if context.pages else context.new_page()
        else:
            browser = p.chromium.launch(headless=False)
            context = browser.new_context(accept_downloads=True)
            page = context.new_page()

        page.goto(args.url, wait_until="networkidle", timeout=args.timeout_ms)
        page.wait_for_timeout(2000)

        with page.expect_download(timeout=args.timeout_ms) as download_info:
            # 尝试多种选择器
            clicked = False
            for sel in SELECTORS["export_button"].split(", "):
                loc = page.locator(sel.strip()).first
                if loc.count() > 0:
                    loc.click()
                    clicked = True
                    break
            if not clicked:
                raise RuntimeError(
                    "未找到导出按钮，请更新 te_bi_playwright_export.py 中 SELECTORS"
                )
            for sel in SELECTORS["export_csv_item"].split(", "):
                loc = page.locator(sel.strip()).first
                if loc.count() > 0:
                    loc.click()
                    break

        download = download_info.value
        download.save_as(str(args.output))
        print(f"已保存: {args.output}")
        context.close()
    return 0


def main() -> int:
    args = parse_args()
    if args.dry_run:
        dry_run_instructions(args)
        return 0
    return run_playwright_export(args)


if __name__ == "__main__":
    raise SystemExit(main())
