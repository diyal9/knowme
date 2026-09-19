"""TE BI (bi.forevernine.net) Playwright 登录探测。"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from playwright.sync_api import sync_playwright

TE_HOST = "bi.forevernine.net"
LOGIN_HINTS = ("登录", "login", "扫码", "请登录", "Agentic Engine")
EXIT_OK = 0
EXIT_LOGIN_REQUIRED = 10
EXIT_NO_STORAGE_STATE = 11


def probe_te_login(
    report_url: str,
    storage_state: Path | None,
    timeout_ms: int = 60_000,
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "url": report_url,
        "logged_in": False,
        "storage_state": str(storage_state) if storage_state else None,
    }
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx_opts: dict[str, Any] = {"viewport": {"width": 1440, "height": 900}}
        if storage_state and storage_state.exists():
            ctx_opts["storage_state"] = str(storage_state)
        context = browser.new_context(**ctx_opts)
        page = context.new_page()
        try:
            page.goto(report_url, wait_until="domcontentloaded", timeout=timeout_ms)
            page.wait_for_timeout(3000)
            title = page.title()
            text = page.locator("body").inner_text(timeout=10_000)
            url = page.url
            result["title"] = title
            result["final_url"] = url
            # 已登录时通常能进报表壳层，标题非纯登录页且 URL 仍含 tga/ 或 bi 域
            on_login = any(h in text[:500] for h in LOGIN_HINTS) and len(text) < 600
            on_login = on_login or ("login" in url.lower() and TE_HOST in url)
            if TE_HOST in url and not on_login and ("tga" in url or "panel" in url):
                result["logged_in"] = True
                result["reason"] = "report_page_ok"
            else:
                result["logged_in"] = False
                result["reason"] = "login_page_detected"
        except Exception as e:
            result["reason"] = "probe_error"
            result["error"] = str(e)
        finally:
            page.close()
            context.close()
            browser.close()
    return result


def resolve_storage_state(memory_root: Path, profile: dict[str, Any] | None) -> Path | None:
    if profile:
        rel = profile.get("storage_state_path")
        if rel:
            p = memory_root / rel if not Path(str(rel)).is_absolute() else Path(rel)
            if p.exists():
                return p
    default = memory_root / "te-report-playwright-export" / "storage_state.json"
    return default if default.exists() else None


def load_profile(memory_root: Path) -> dict[str, Any]:
    import yaml

    p = memory_root / "te-report-playwright-export" / "profile.yaml"
    if not p.exists():
        # 兼容旧路径
        legacy = memory_root / "feishu-wiki-playwright-export" / "profile.yaml"
        p = legacy if legacy.exists() else p
    if not p.exists():
        return {}
    return yaml.safe_load(p.read_text(encoding="utf-8")) or {}
