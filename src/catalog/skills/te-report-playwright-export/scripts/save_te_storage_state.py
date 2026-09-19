#!/usr/bin/env python3
"""保存 TE BI (bi.forevernine.net) Playwright 登录态（有界面浏览器）。"""
from __future__ import annotations

import argparse
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml
from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from te_auth import probe_te_login  # noqa: E402
from te_cli_util import log_login  # noqa: E402

LOGIN_HINTS = ("登录", "login", "扫码", "请登录")
DEFAULT_BROWSER_CHANNEL = "chrome"


def page_looks_logged_in(page: Page) -> bool:
    try:
        text = page.locator("body").inner_text(timeout=10_000)
        url = page.url
        on_login = any(h in text[:500] for h in LOGIN_HINTS) and len(text) < 600
        if "bi.forevernine.net" not in url or on_login:
            return False
        return "tga" in url or "panel" in url or len(text) > 600
    except Exception:
        return False


def wait_until_logged_in(page: Page, probe_url: str, wait_seconds: int, interval: float = 2.0) -> bool:
    """在当前标签页轮询登录态，避免反复 goto 导致页面闪烁。"""
    deadline = time.time() + wait_seconds
    last_notice = 0.0
    while time.time() < deadline:
        if page_looks_logged_in(page):
            return True
        now = time.time()
        if now - last_notice >= 15:
            remaining = int(deadline - now)
            log_login(f"仍在等待登录… 剩余约 {remaining}s")
            last_notice = now
        time.sleep(interval)
    try:
        page.goto(probe_url, wait_until="domcontentloaded", timeout=60_000)
        page.wait_for_timeout(2000)
        return page_looks_logged_in(page)
    except Exception:
        return False


def launch_context(
    pw: Any,
    *,
    browser_channel: str | None,
    connect_cdp: str | None,
) -> tuple[Browser, BrowserContext, Page, bool]:
    """返回 (browser, context, page, owns_browser)。CDP 模式不关闭用户本地浏览器。"""
    if connect_cdp:
        browser = pw.chromium.connect_over_cdp(connect_cdp)
        context = browser.contexts[0] if browser.contexts else browser.new_context()
        page = context.pages[0] if context.pages else context.new_page()
        return browser, context, page, False

    launch_opts: dict[str, Any] = {
        "headless": False,
        "channel": browser_channel or DEFAULT_BROWSER_CHANNEL,
    }
    browser = pw.chromium.launch(**launch_opts)
    context = browser.new_context()
    page = context.new_page()
    return browser, context, page, True


def main() -> int:
    p = argparse.ArgumentParser(description="保存 TE BI 登录态")
    p.add_argument("--url", default="https://bi.forevernine.net/")
    p.add_argument("--probe-url", help="登录后用于验证的报表 URL")
    p.add_argument("--output", required=True, type=Path)
    p.add_argument(
        "--wait-seconds",
        type=int,
        default=0,
        help="自动轮询登录完成（无需按 Enter）；0 表示交互模式",
    )
    p.add_argument(
        "--browser-channel",
        choices=["chrome", "msedge", "chromium"],
        default=DEFAULT_BROWSER_CHANNEL,
        help="本机浏览器通道（默认 chrome；chromium 为 Playwright 自带）",
    )
    p.add_argument(
        "--connect-cdp",
        metavar="URL",
        help="连接已打开的本地浏览器（如 http://127.0.0.1:9222），复用已有登录态",
    )
    args = p.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    probe_url = args.probe_url or args.url
    use_wait = args.wait_seconds > 0 or not sys.stdin.isatty()

    with sync_playwright() as pw:
        browser, context, page, owns_browser = launch_context(
            pw,
            browser_channel=args.browser_channel,
            connect_cdp=args.connect_cdp,
        )
        if args.connect_cdp:
            log_login("已连接本地浏览器；请确认当前标签页已登录 bi.forevernine.net")
            if sys.stdin.isatty():
                input()
            else:
                ok = wait_until_logged_in(page, probe_url, args.wait_seconds or 30)
                if not ok:
                    log_login("未检测到登录态，请在本机浏览器完成登录后重试。")
                    return 1
        else:
            page.goto(args.url, wait_until="domcontentloaded", timeout=120_000)
            if use_wait:
                secs = args.wait_seconds or 600
                label = args.browser_channel or "Chromium"
                log_login(f"请在弹出的 {label} 窗口中登录 bi.forevernine.net（最多等待 {secs} 秒）")
                ok = wait_until_logged_in(page, probe_url, secs)
                if not ok:
                    log_login("超时：未检测到登录成功，请重试。")
                    if owns_browser:
                        browser.close()
                    return 1
            else:
                log_login("请在浏览器中登录 bi.forevernine.net，完成后回到终端按 Enter…")
                input()
        context.storage_state(path=str(args.output))
        if owns_browser:
            browser.close()
        else:
            browser.close()  # CDP：仅断开连接，不关闭用户浏览器

    probe = probe_te_login(probe_url, args.output)
    mem_root = args.output.parent.parent if args.output.parent.name == "te-report-playwright-export" else None
    if mem_root:
        prof_dir = mem_root / "te-report-playwright-export"
        prof_dir.mkdir(parents=True, exist_ok=True)
        profile_path = prof_dir / "profile.yaml"
        profile = {}
        if profile_path.exists():
            profile = yaml.safe_load(profile_path.read_text(encoding="utf-8")) or {}
        profile["storage_state_path"] = "te-report-playwright-export/storage_state.json"
        profile["storage_state_saved_at"] = datetime.now(timezone.utc).astimezone().isoformat()
        if probe_url:
            profile["last_report_url"] = probe_url
        profile_path.write_text(yaml.dump(profile, allow_unicode=True, sort_keys=False), encoding="utf-8")

    if not probe.get("logged_in"):
        log_login("警告：保存后探测仍像未登录，请重试。")
        return 1
    print(f"已保存并验证: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
