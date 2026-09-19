#!/usr/bin/env python3
"""批量导出 worker：同一进程内复用 browser 顺序导出多条报表。"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from playwright.sync_api import sync_playwright

from te_auth import resolve_storage_state, load_profile  # noqa: E402
from te_browser import close_export_browser, launch_export_browser  # noqa: E402
from te_cli_util import log_progress, output_info_dir  # noqa: E402
from te_export_core import export_report_on_page, url_slug  # noqa: E402


def export_url_chunk(chunk_spec: dict) -> list[dict]:
    """ProcessPoolExecutor 入口：一个 worker 处理多条 URL，共享一个 browser。"""
    urls: list[str] = chunk_spec["urls"]
    if not urls:
        return []

    memory_root = Path(chunk_spec["memory_root"])
    output_dir = Path(chunk_spec["output_dir"])
    storage = resolve_storage_state(memory_root, load_profile(memory_root))

    browser_mode = chunk_spec.get("browser_mode") or "headless"
    browser_channel = chunk_spec.get("browser_channel") or "chrome"
    connect_cdp = chunk_spec.get("connect_cdp")

    wait_keys = (
        "post_load_wait_ms",
        "export_button_wait_ms",
        "poll_ms",
        "network_idle_ms",
    )
    wait = {k: chunk_spec[k] for k in wait_keys if chunk_spec.get(k) is not None}
    timeout_ms = int(chunk_spec.get("timeout_ms") or 180_000)
    worker_id = chunk_spec.get("worker_id", 0)

    entries: list[dict] = []
    info_dir = output_info_dir(output_dir)

    log_progress(f"Worker-{worker_id} 启动浏览器（{browser_mode}），本批 {len(urls)} 条")

    with sync_playwright() as pw:
        handle = launch_export_browser(
            pw,
            storage_state=storage,
            browser_mode=browser_mode,
            browser_channel=browser_channel,
            connect_cdp=connect_cdp,
        )
        page = handle.context.new_page()
        try:
            for idx, url in enumerate(urls, start=1):
                log_progress(f"Worker-{worker_id} [{idx}/{len(urls)}] {url}")
                result = export_report_on_page(
                    page,
                    report_url=url,
                    output_dir=output_dir,
                    timeout_ms=timeout_ms,
                    verbose=True,
                    **wait,
                )
                manifest_path = info_dir / f"export_manifest_{url_slug(url)}.json"
                manifest_path.write_text(
                    json.dumps(result["manifest"], ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )
                entries.append(
                    {
                        "url": url,
                        "returncode": int(result["exit_code"]),
                        "result": result["stdout"],
                    }
                )
        finally:
            try:
                page.close()
            except Exception:
                pass
            close_export_browser(handle)

    log_progress(f"Worker-{worker_id} 完成，共 {len(entries)} 条")
    return entries
