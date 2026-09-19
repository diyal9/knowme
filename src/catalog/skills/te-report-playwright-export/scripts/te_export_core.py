"""TE 报表 Playwright 导出核心逻辑（单条 / 批量复用）。"""
from __future__ import annotations

import re
import time
from pathlib import Path
from typing import Any, Callable

import yaml
from playwright.sync_api import Page, TimeoutError as PwTimeout, sync_playwright

from te_browser import close_export_browser, launch_export_browser
from te_cli_util import log_progress, output_info_dir

EXPORT_BUTTON_SELECTORS = [
    "button:has-text('导出')",
    "[aria-label='导出']",
    "[title='导出']",
    ".export-btn",
    "[class*='export']:visible",
    "text=导出",
]
EXPORT_MENU_CSV_SELECTORS = [
    "text=导出 CSV",
    "text=下载 CSV",
    "text=CSV",
    "li:has-text('CSV')",
    "[role='menuitem']:has-text('CSV')",
]
LOADING_SELECTORS = [
    ".ant-spin-spinning",
    ".loading",
    "[class*='loading-mask']",
    "[class*='Loading']",
    ".el-loading-mask",
]

EXIT_NO_EXPORT_BUTTON = 20
DEFAULT_POST_LOAD_WAIT_MS = 8_000
DEFAULT_EXPORT_BUTTON_WAIT_MS = 90_000
DEFAULT_POLL_MS = 2_000
DEFAULT_NETWORK_IDLE_MS = 60_000


def load_corrections(memory_root: Path | None) -> dict[str, Any]:
    if not memory_root:
        return {}
    p = memory_root / "te-report-playwright-export" / "rules" / "corrections.yaml"
    if not p.exists():
        return {}
    data = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
    out: dict[str, Any] = {}
    for rule in data.get("rules") or []:
        apply = rule.get("apply") or {}
        t = apply.get("type")
        if t == "post_load_wait_ms":
            out["post_load_wait_ms"] = int(apply.get("value", DEFAULT_POST_LOAD_WAIT_MS))
        elif t == "export_button_wait_ms":
            out["export_button_wait_ms"] = int(apply.get("value", DEFAULT_EXPORT_BUTTON_WAIT_MS))
        elif t == "poll_ms":
            out["poll_ms"] = int(apply.get("value", DEFAULT_POLL_MS))
        elif t == "network_idle_ms":
            out["network_idle_ms"] = int(apply.get("value", DEFAULT_NETWORK_IDLE_MS))
    return out


def resolve_wait_settings(
    memory_root: Path | None,
    *,
    post_load_wait_ms: int | None = None,
    export_button_wait_ms: int | None = None,
    poll_ms: int | None = None,
    network_idle_ms: int | None = None,
) -> dict[str, int]:
    corrections = load_corrections(memory_root)
    return {
        "post_load_wait_ms": post_load_wait_ms
        if post_load_wait_ms is not None
        else int(corrections.get("post_load_wait_ms", DEFAULT_POST_LOAD_WAIT_MS)),
        "export_button_wait_ms": export_button_wait_ms
        if export_button_wait_ms is not None
        else int(corrections.get("export_button_wait_ms", DEFAULT_EXPORT_BUTTON_WAIT_MS)),
        "poll_ms": poll_ms
        if poll_ms is not None
        else int(corrections.get("poll_ms", DEFAULT_POLL_MS)),
        "network_idle_ms": network_idle_ms
        if network_idle_ms is not None
        else int(corrections.get("network_idle_ms", DEFAULT_NETWORK_IDLE_MS)),
    }


def url_slug(report_url: str) -> str:
    m = re.search(r"/(event|retention|scatter)/([^?]+)", report_url)
    if m:
        return f"{m.group(1)}_{m.group(2).replace('/', '_')}"
    return re.sub(r"[^\w.-]+", "_", report_url)[-80:]


def find_export_button(page: Page) -> tuple[bool, str]:
    for sel in EXPORT_BUTTON_SELECTORS:
        loc = page.locator(sel).first
        try:
            if loc.count() > 0 and loc.is_visible():
                return True, sel
        except Exception:
            continue
    return False, ""


def wait_for_loading_done(page: Page, timeout_ms: int) -> None:
    deadline = time.monotonic() + timeout_ms / 1000
    for sel in LOADING_SELECTORS:
        try:
            loc = page.locator(sel)
            if loc.count() > 0:
                remaining = max(1000, int((deadline - time.monotonic()) * 1000))
                loc.first.wait_for(state="hidden", timeout=remaining)
        except Exception:
            continue


def wait_for_export_button(
    page: Page,
    *,
    export_button_wait_ms: int,
    poll_ms: int,
    on_progress: Callable[[str], None] | None = None,
) -> tuple[bool, str]:
    deadline = time.monotonic() + export_button_wait_ms / 1000
    started = time.monotonic()
    last_notice = 0.0
    while time.monotonic() < deadline:
        found, sel = find_export_button(page)
        if found:
            if on_progress:
                on_progress(f"已找到「导出」按钮（{sel}）")
            return True, sel
        elapsed = int(time.monotonic() - started)
        total = int(export_button_wait_ms / 1000)
        if on_progress and (elapsed - last_notice >= 10 or last_notice == 0):
            on_progress(f"等待「导出」按钮出现… {elapsed}s / {total}s")
            last_notice = elapsed
        page.wait_for_timeout(poll_ms)
    return False, ""


def click_export(page: Page, timeout_ms: int) -> None:
    found, sel = find_export_button(page)
    if not found:
        raise RuntimeError("NO_EXPORT_BUTTON")

    page.locator(sel).first.click(timeout=timeout_ms)
    page.wait_for_timeout(500)
    for menu_sel in EXPORT_MENU_CSV_SELECTORS:
        item = page.locator(menu_sel).first
        try:
            if item.count() > 0 and item.is_visible():
                item.click(timeout=5000)
                return
        except Exception:
            continue


def _new_manifest(
    report_url: str,
    output_dir: Path,
    info_dir: Path,
    wait: dict[str, int],
) -> dict[str, Any]:
    return {
        "exported_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "report_url": report_url,
        "output_dir": str(output_dir),
        "output_info_dir": str(info_dir),
        "files": [],
        "wait": wait,
    }


def export_report_on_page(
    page: Page,
    *,
    report_url: str,
    output_dir: Path,
    timeout_ms: int = 120_000,
    post_load_wait_ms: int = DEFAULT_POST_LOAD_WAIT_MS,
    export_button_wait_ms: int = DEFAULT_EXPORT_BUTTON_WAIT_MS,
    poll_ms: int = DEFAULT_POLL_MS,
    network_idle_ms: int = DEFAULT_NETWORK_IDLE_MS,
    verbose: bool = True,
) -> dict[str, Any]:
    """在已有 page 上导出单条报表（供 worker 复用 browser 时调用）。"""

    def progress(msg: str) -> None:
        if verbose:
            log_progress(msg)

    output_dir.mkdir(parents=True, exist_ok=True)
    info_dir = output_info_dir(output_dir)
    slug = url_slug(report_url)
    wait = {
        "post_load_wait_ms": post_load_wait_ms,
        "export_button_wait_ms": export_button_wait_ms,
        "poll_ms": poll_ms,
        "network_idle_ms": network_idle_ms,
    }
    manifest = _new_manifest(report_url, output_dir, info_dir, wait)

    try:
        progress(f"打开报表页… {report_url}")
        page.goto(report_url, wait_until="domcontentloaded", timeout=timeout_ms)
        progress("等待页面网络空闲（networkidle）…")
        try:
            page.wait_for_load_state(
                "networkidle",
                timeout=min(timeout_ms, network_idle_ms),
            )
        except PwTimeout:
            progress("网络未完全空闲，继续等待报表渲染…")

        progress("等待加载动画消失…")
        wait_for_loading_done(page, post_load_wait_ms)
        progress(f"额外等待报表渲染 {post_load_wait_ms // 1000}s…")
        page.wait_for_timeout(post_load_wait_ms)

        found, _ = wait_for_export_button(
            page,
            export_button_wait_ms=export_button_wait_ms,
            poll_ms=poll_ms,
            on_progress=progress,
        )
        if not found:
            progress("未找到「导出」按钮，已截图")
            shot = info_dir / f"no_export_button_{slug}.png"
            page.screenshot(path=str(shot), full_page=True)
            manifest["ok"] = False
            manifest["error"] = "页面上未找到「导出」按钮（已等待页面加载）"
            manifest["screenshot"] = str(shot)
            return {
                "exit_code": EXIT_NO_EXPORT_BUTTON,
                "manifest": manifest,
                "stdout": {"ok": False, "no_export_button": True},
            }

        progress("点击「导出」并等待 CSV 下载…")
        with page.expect_download(timeout=timeout_ms) as dl_info:
            click_export(page, timeout_ms)
        download = dl_info.value
        suggested = download.suggested_filename or f"te_report_{slug}_{int(time.time())}.csv"
        dest = output_dir / suggested
        download.save_as(str(dest))
        progress(f"下载完成：{dest.name}")
        manifest["ok"] = True
        manifest["files"].append({"path": str(dest), "suggested_name": suggested})
        return {"exit_code": 0, "manifest": manifest, "stdout": {"ok": True, "file": str(dest)}}

    except PwTimeout:
        shot = info_dir / f"download_timeout_{slug}.png"
        page.screenshot(path=str(shot), full_page=True)
        manifest["ok"] = False
        manifest["error"] = "等待下载超时"
        manifest["screenshot"] = str(shot)
        return {"exit_code": 1, "manifest": manifest, "stdout": {"ok": False, "error": "download_timeout"}}

    except RuntimeError as e:
        if "NO_EXPORT_BUTTON" in str(e):
            shot = info_dir / f"no_export_button_{slug}.png"
            page.screenshot(path=str(shot), full_page=True)
            manifest["ok"] = False
            manifest["error"] = "页面上未找到「导出」按钮"
            manifest["screenshot"] = str(shot)
            return {
                "exit_code": EXIT_NO_EXPORT_BUTTON,
                "manifest": manifest,
                "stdout": {"ok": False, "no_export_button": True},
            }
        raise


def export_report_csv(
    *,
    report_url: str,
    output_dir: Path,
    storage_state: Path | None,
    timeout_ms: int = 120_000,
    post_load_wait_ms: int = DEFAULT_POST_LOAD_WAIT_MS,
    export_button_wait_ms: int = DEFAULT_EXPORT_BUTTON_WAIT_MS,
    poll_ms: int = DEFAULT_POLL_MS,
    network_idle_ms: int = DEFAULT_NETWORK_IDLE_MS,
    browser_mode: str = "headless",
    browser_channel: str = "chrome",
    connect_cdp: str | None = None,
    verbose: bool = True,
) -> dict[str, Any]:
    """打开报表页，等待加载完成后点击导出，返回结果 dict（单条 CLI 用，每次启动浏览器）。"""

    with sync_playwright() as pw:
        handle = launch_export_browser(
            pw,
            storage_state=storage_state,
            browser_mode=browser_mode,
            browser_channel=browser_channel,
            connect_cdp=connect_cdp,
        )
        page = handle.context.new_page()
        try:
            return export_report_on_page(
                page,
                report_url=report_url,
                output_dir=output_dir,
                timeout_ms=timeout_ms,
                post_load_wait_ms=post_load_wait_ms,
                export_button_wait_ms=export_button_wait_ms,
                poll_ms=poll_ms,
                network_idle_ms=network_idle_ms,
                verbose=verbose,
            )
        finally:
            try:
                page.close()
            except Exception:
                pass
            close_export_browser(handle)
