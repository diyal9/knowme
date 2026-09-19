"""TE 导出用 Playwright 浏览器启动（headless / 本机 Chrome / CDP 复用）。"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from playwright.sync_api import Browser, BrowserContext, Playwright

DEFAULT_BROWSER_CHANNEL = "chrome"
DEFAULT_CDP_URL = "http://127.0.0.1:9222"
BROWSER_MODES = ("headless", "chrome", "headed", "cdp")


@dataclass
class ExportBrowserHandle:
    browser: Browser
    context: BrowserContext
    owns_browser: bool
    mode: str


def launch_export_browser(
    pw: Playwright,
    *,
    storage_state: Path | None = None,
    browser_mode: str = "headless",
    browser_channel: str = DEFAULT_BROWSER_CHANNEL,
    connect_cdp: str | None = None,
) -> ExportBrowserHandle:
    """启动或连接导出用浏览器。cdp 模式复用用户已开浏览器，不注入 storage_state。"""
    mode = browser_mode if browser_mode in BROWSER_MODES else "headless"
    cdp_url = connect_cdp or (DEFAULT_CDP_URL if mode == "cdp" else None)

    if mode == "cdp" or cdp_url:
        browser = pw.chromium.connect_over_cdp(cdp_url or DEFAULT_CDP_URL)
        if browser.contexts:
            context = browser.contexts[0]
        else:
            context = browser.new_context(
                accept_downloads=True,
                viewport={"width": 1600, "height": 900},
            )
        return ExportBrowserHandle(browser, context, False, "cdp")

    ctx_opts: dict[str, Any] = {
        "accept_downloads": True,
        "viewport": {"width": 1600, "height": 900},
    }
    if storage_state and storage_state.exists():
        ctx_opts["storage_state"] = str(storage_state)

    launch_opts: dict[str, Any] = {}
    if mode == "headed":
        launch_opts["headless"] = False
        launch_opts["channel"] = browser_channel or DEFAULT_BROWSER_CHANNEL
    elif mode == "chrome":
        launch_opts["headless"] = True
        launch_opts["channel"] = browser_channel or DEFAULT_BROWSER_CHANNEL
    else:
        launch_opts["headless"] = True

    browser = pw.chromium.launch(**launch_opts)
    context = browser.new_context(**ctx_opts)
    return ExportBrowserHandle(browser, context, True, mode)


def close_export_browser(handle: ExportBrowserHandle) -> None:
    try:
        handle.browser.close()
    except Exception:
        pass


def resolve_browser_options(
    memory_root: Path | None,
    *,
    browser_mode: str | None = None,
    browser_channel: str | None = None,
    connect_cdp: str | None = None,
) -> dict[str, str | None]:
    profile: dict[str, Any] = {}
    if memory_root:
        from te_auth import load_profile

        profile = load_profile(memory_root) or {}

    return {
        "browser_mode": browser_mode or profile.get("browser_mode") or "headless",
        "browser_channel": browser_channel or profile.get("browser_channel") or DEFAULT_BROWSER_CHANNEL,
        "connect_cdp": connect_cdp or profile.get("connect_cdp"),
    }
