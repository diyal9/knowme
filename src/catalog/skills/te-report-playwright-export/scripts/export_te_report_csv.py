#!/usr/bin/env python3
"""
TE 报表 CSV 无头导出：打开报表页 → 等待加载完成 → 点击「导出」→ 保存下载文件。

与页面「导出」按钮下载的 CSV 一致（不走 MCP query_report_data 拼表）。

退出码: 0 成功 | 10 需登录 | 20 页上无导出按钮
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from te_auth import (  # noqa: E402
    EXIT_LOGIN_REQUIRED,
    load_profile,
    probe_te_login,
    resolve_storage_state,
)
from te_browser import resolve_browser_options  # noqa: E402
from te_cli_util import emit_json, login_error_payload, log_progress, output_info_dir  # noqa: E402
from te_export_core import (  # noqa: E402
    EXIT_NO_EXPORT_BUTTON,
    export_report_csv,
    resolve_wait_settings,
    url_slug,
)
from te_output_dir import (  # noqa: E402
    EXIT_NEEDS_USER_CHOICE,
    OutputDirNotEmptyError,
    needs_user_choice_payload,
    resolve_on_existing,
    should_skip_url,
)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="TE 报表 Playwright 无头导出 CSV")
    p.add_argument("--url", required=True, help="TE 报表完整 URL")
    p.add_argument("--output-dir", required=True, type=Path, help="CSV 保存目录")
    p.add_argument("--memory-root", type=Path, help="Agent memory 根")
    p.add_argument("--storage-state", type=Path)
    p.add_argument("--timeout-ms", type=int, default=120_000)
    p.add_argument("--post-load-wait-ms", type=int, help="页面初始加载后额外等待（毫秒）")
    p.add_argument("--export-button-wait-ms", type=int, help="轮询等待「导出」按钮出现的最长时间")
    p.add_argument("--poll-ms", type=int, help="轮询间隔（毫秒）")
    p.add_argument("--network-idle-ms", type=int, help="networkidle 最长等待（毫秒）")
    p.add_argument(
        "--browser-mode",
        choices=["headless", "chrome", "headed", "cdp"],
        help="headless=内置 Chromium；chrome=本机 Chrome 无头；headed=本机 Chrome 有界面；cdp=连接已开浏览器",
    )
    p.add_argument("--browser-channel", choices=["chrome", "msedge", "chromium"])
    p.add_argument("--connect-cdp", metavar="URL", help="CDP 地址，如 http://127.0.0.1:9222")
    p.add_argument(
        "--on-existing",
        choices=["overwrite", "skip", "archive", "abort", "prompt"],
        help="输出目录已有文件时：overwrite 覆盖；skip 跳过已成功项；archive 归档后导出；abort 取消；默认 prompt 须 Agent 询问用户",
    )
    p.add_argument("--skip-login-gate", action="store_true")
    p.add_argument("--quiet", action="store_true", help="不输出阶段性进度（stderr）")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    info_dir = output_info_dir(args.output_dir)

    try:
        policy, scan = resolve_on_existing(args.output_dir, args.on_existing)
    except OutputDirNotEmptyError as e:
        emit_json({"ok": False, "aborted": True, "reason": "output_dir_not_empty", "scan": e.scan})
        return EXIT_NEEDS_USER_CHOICE

    if policy is None:
        emit_json(needs_user_choice_payload(scan))
        return EXIT_NEEDS_USER_CHOICE

    if policy == "skip" and should_skip_url(args.output_dir, args.url):
        payload = {
            "ok": True,
            "skipped": True,
            "reason": "already_exported",
            "url": args.url,
            "scan": scan,
        }
        manifest_path = info_dir / f"export_manifest_{url_slug(args.url)}.json"
        if manifest_path.exists():
            try:
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                for item in manifest.get("files") or []:
                    if item.get("path"):
                        payload["file"] = item["path"]
                        break
            except (json.JSONDecodeError, OSError):
                pass
        emit_json(payload)
        return 0

    storage = args.storage_state
    if not storage and args.memory_root:
        storage = resolve_storage_state(args.memory_root, load_profile(args.memory_root))

    browser_opts = resolve_browser_options(
        args.memory_root,
        browser_mode=args.browser_mode,
        browser_channel=args.browser_channel,
        connect_cdp=args.connect_cdp,
    )

    if not args.skip_login_gate and browser_opts["browser_mode"] != "cdp":
        if not storage:
            payload = login_error_payload(
                reason="no_storage_state",
                hint="运行 bootstrap_auth.sh --te-login --skip-feishu",
            )
            manifest_path = info_dir / f"export_manifest_{url_slug(args.url)}.json"
            manifest_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
            emit_json(payload)
            return EXIT_LOGIN_REQUIRED
        log_progress("检测 TE 登录态…")
        probe = probe_te_login(args.url, storage, args.timeout_ms)
        if not probe.get("logged_in"):
            payload = login_error_payload(
                reason=probe.get("reason", "login_page_detected"),
                hint="运行 bootstrap_auth.sh --te-login --skip-feishu",
                probe=probe,
            )
            manifest_path = info_dir / f"export_manifest_{url_slug(args.url)}.json"
            manifest_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
            emit_json(payload)
            return EXIT_LOGIN_REQUIRED
        log_progress("登录态有效，开始导出")
    elif browser_opts["browser_mode"] == "cdp":
        log_progress("CDP 模式：跳过 storage_state 登录探测，使用已开浏览器会话")

    wait = resolve_wait_settings(
        args.memory_root,
        post_load_wait_ms=args.post_load_wait_ms,
        export_button_wait_ms=args.export_button_wait_ms,
        poll_ms=args.poll_ms,
        network_idle_ms=args.network_idle_ms,
    )

    result = export_report_csv(
        report_url=args.url,
        output_dir=args.output_dir,
        storage_state=storage,
        timeout_ms=args.timeout_ms,
        verbose=not args.quiet,
        browser_mode=str(browser_opts["browser_mode"]),
        browser_channel=str(browser_opts["browser_channel"] or "chrome"),
        connect_cdp=browser_opts["connect_cdp"],
        **wait,
    )

    manifest_path = info_dir / f"export_manifest_{url_slug(args.url)}.json"
    manifest_path.write_text(
        json.dumps(result["manifest"], ensure_ascii=False, indent=2), encoding="utf-8"
    )
    emit_json(result["stdout"])
    return int(result["exit_code"])


if __name__ == "__main__":
    raise SystemExit(main())
