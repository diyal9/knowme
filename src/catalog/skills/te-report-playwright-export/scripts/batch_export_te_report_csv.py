#!/usr/bin/env python3
"""
批量 TE 报表 CSV 导出：飞书文档全量 / 直接 TE URL 列表，worker 内复用 browser。

每个 worker 进程启动一次浏览器，顺序导出分配给它的多条报表。
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from batch_export_worker import export_url_chunk  # noqa: E402
from resolve_report_url import classify_input, resolve_input  # noqa: E402
from te_browser import resolve_browser_options  # noqa: E402
from te_cli_util import emit_json, log_progress, output_info_dir  # noqa: E402
from te_output_dir import (  # noqa: E402
    EXIT_NEEDS_USER_CHOICE,
    OutputDirNotEmptyError,
    needs_user_choice_payload,
    resolve_on_existing,
    should_skip_url,
)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="批量 TE 报表 Playwright 导出 CSV")
    p.add_argument("--input", help="飞书文档 / Wiki 链接，或 TE 报表 URL（自动识别）")
    p.add_argument("--feishu-url", help="同 --input（飞书链接，兼容旧参数）")
    p.add_argument("--url", action="append", help="直接指定 TE 报表 URL，可重复")
    p.add_argument("--urls-file", type=Path, help="每行一个 TE 报表 URL 的文本/JSON 文件")
    p.add_argument(
        "--retry-from-summary",
        type=Path,
        help="从上次 output-info/_batch_summary.json 重试失败项",
    )
    p.add_argument("--output-dir", required=True, type=Path)
    p.add_argument("--memory-root", type=Path, required=True)
    p.add_argument("--workers", type=int, default=3, help="并行 worker 数（默认 3）")
    p.add_argument("--timeout-ms", type=int, default=180_000)
    p.add_argument("--post-load-wait-ms", type=int)
    p.add_argument("--export-button-wait-ms", type=int)
    p.add_argument("--poll-ms", type=int)
    p.add_argument("--network-idle-ms", type=int)
    p.add_argument(
        "--browser-mode",
        choices=["headless", "chrome", "headed", "cdp"],
        help="无头慢时可试 chrome 或 cdp（连接本机已开 Chrome）",
    )
    p.add_argument("--browser-channel", choices=["chrome", "msedge", "chromium"])
    p.add_argument("--connect-cdp", metavar="URL")
    p.add_argument(
        "--on-existing",
        choices=["overwrite", "skip", "archive", "abort", "prompt"],
        help="输出目录已有文件时的处理策略（默认 prompt）",
    )
    p.add_argument("--skip-login-gate", action="store_true")
    return p.parse_args()


def resolve_batch_summary_path(output_dir: Path, explicit: Path | None = None) -> Path:
    if explicit:
        if explicit.exists():
            return explicit
        legacy = output_dir / "_batch_summary.json"
        if legacy.exists():
            return legacy
        raise FileNotFoundError(f"batch summary not found: {explicit}")
    return output_info_dir(output_dir) / "_batch_summary.json"


def load_urls_and_source(args: argparse.Namespace) -> tuple[list[str], str]:
    if args.retry_from_summary:
        summary_path = resolve_batch_summary_path(args.output_dir, args.retry_from_summary)
        data = json.loads(summary_path.read_text(encoding="utf-8"))
        urls: list[str] = []
        for key in ("fail", "no_export", "login"):
            for item in data.get(key) or []:
                urls.append(item if isinstance(item, str) else item.get("url", ""))
        return [u for u in urls if u], "retry"

    if args.url:
        seen: set[str] = set()
        out: list[str] = []
        for u in args.url:
            u = u.strip()
            if u and u not in seen:
                seen.add(u)
                out.append(u)
        if not out:
            raise ValueError("未提供有效的 --url")
        return out, "te_direct"

    raw = (args.input or args.feishu_url or "").strip()
    if raw:
        urls = resolve_input(raw)
        return urls, classify_input(raw)

    if args.urls_file:
        raw_text = args.urls_file.read_text(encoding="utf-8").strip()
        if raw_text.startswith("["):
            urls = json.loads(raw_text)
        else:
            urls = [
                line.strip()
                for line in raw_text.splitlines()
                if line.strip() and not line.startswith("#")
            ]
        return urls, "te_direct"

    raise ValueError("请提供 --input、--url、--urls-file 或 --retry-from-summary")


def chunk_urls(urls: list[str], workers: int) -> list[list[str]]:
    n = max(1, min(workers, len(urls)))
    chunks: list[list[str]] = [[] for _ in range(n)]
    for i, url in enumerate(urls):
        chunks[i % n].append(url)
    return [c for c in chunks if c]


def main() -> int:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    try:
        policy, scan = resolve_on_existing(args.output_dir, args.on_existing)
    except OutputDirNotEmptyError as e:
        emit_json({"ok": False, "aborted": True, "reason": "output_dir_not_empty", "scan": e.scan})
        return EXIT_NEEDS_USER_CHOICE

    if policy is None:
        emit_json(needs_user_choice_payload(scan))
        return EXIT_NEEDS_USER_CHOICE

    try:
        urls, source = load_urls_and_source(args)
    except Exception as e:
        emit_json({"ok": False, "error": str(e)})
        return 1

    if not urls:
        emit_json({"ok": False, "error": "未解析到任何 TE 报表 URL"})
        return 1

    skipped_urls: list[dict[str, str]] = []
    if policy == "skip":
        kept: list[str] = []
        for url in urls:
            if should_skip_url(args.output_dir, url):
                skipped_urls.append({"url": url})
            else:
                kept.append(url)
        if skipped_urls:
            log_progress(f"跳过 {len(skipped_urls)} 条已成功导出的报表")
        urls = kept

    if not urls:
        emit_json(
            {
                "ok": True,
                "skipped_all": True,
                "skipped_count": len(skipped_urls),
                "scan": scan,
            }
        )
        return 0

    browser_opts = resolve_browser_options(
        args.memory_root,
        browser_mode=args.browser_mode,
        browser_channel=args.browser_channel,
        connect_cdp=args.connect_cdp,
    )
    browser_mode = str(browser_opts["browser_mode"])

    if not args.skip_login_gate and browser_mode != "cdp":
        check = subprocess.run(
            [
                sys.executable,
                str(Path(__file__).parent / "check_te_login.py"),
                "--memory-root",
                str(args.memory_root),
            ],
            capture_output=True,
            text=True,
        )
        if check.returncode != 0:
            try:
                payload = json.loads(check.stdout.strip() or "{}")
            except json.JSONDecodeError:
                payload = {"ok": False, "login_required": True, "reason": "check_failed"}
            emit_json(payload)
            return 10
        log_progress("批量导出：登录态检测通过")

    workers = max(1, min(args.workers, len(urls)))
    if browser_mode == "cdp" and workers > 1:
        log_progress("CDP 模式共享同一浏览器，workers 降为 1")
        workers = 1

    wait_keys = (
        "post_load_wait_ms",
        "export_button_wait_ms",
        "poll_ms",
        "network_idle_ms",
    )
    wait_values = {
        k: getattr(args, k)
        for k in wait_keys
        if getattr(args, k) is not None
    }

    chunks = chunk_urls(urls, workers)
    chunk_specs = [
        {
            "worker_id": i + 1,
            "urls": chunk,
            "output_dir": str(args.output_dir),
            "memory_root": str(args.memory_root),
            "timeout_ms": args.timeout_ms,
            "browser_mode": browser_mode,
            "browser_channel": browser_opts["browser_channel"],
            "connect_cdp": browser_opts["connect_cdp"],
            **wait_values,
        }
        for i, chunk in enumerate(chunks)
    ]

    results: dict[str, list] = {"ok": [], "fail": [], "no_export": [], "login": []}

    meta = {
        "total": len(urls),
        "workers": len(chunk_specs),
        "source": source,
        "browser_mode": browser_mode,
        "on_existing": policy,
    }
    if skipped_urls:
        meta["skipped_count"] = len(skipped_urls)
        meta["skipped_urls"] = [s["url"] for s in skipped_urls]
    print(json.dumps(meta, ensure_ascii=False), flush=True)

    if source == "feishu":
        log_progress(f"飞书文档：解析到 {len(urls)} 个报表，{len(chunk_specs)} 个 worker")
    else:
        log_progress(f"直接导出 {len(urls)} 个 TE 报表，{len(chunk_specs)} 个 worker（每 worker 复用 browser）")

    done = 0
    with ProcessPoolExecutor(max_workers=len(chunk_specs)) as pool:
        futures = {pool.submit(export_url_chunk, spec): spec for spec in chunk_specs}
        for fut in as_completed(futures):
            for entry in fut.result():
                done += 1
                url = entry["url"]
                rc = entry["returncode"]
                print(f"[{done}/{len(urls)}] {url} -> {rc}", flush=True)
                if rc == 0:
                    file_path = (entry.get("result") or {}).get("file", "")
                    if file_path:
                        log_progress(f"完成 [{done}/{len(urls)}] {Path(file_path).name}")
                    results["ok"].append(entry)
                elif rc == 10:
                    results["login"].append(url)
                elif rc == 20:
                    results["no_export"].append(url)
                else:
                    results["fail"].append(entry)

    summary_path = output_info_dir(args.output_dir) / "_batch_summary.json"
    summary_payload = {
        **results,
        "meta": meta,
        "skipped": skipped_urls,
    }
    summary_path.write_text(json.dumps(summary_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print("BATCH_DONE", flush=True)
    print(json.dumps({k: len(v) for k, v in results.items()}, ensure_ascii=False), flush=True)
    return 0 if not results["fail"] and not results["login"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
