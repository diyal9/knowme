#!/usr/bin/env python3
"""Crawl a single URL with Crawl4AI and print Markdown to stdout."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys


async def crawl(url: str, timeout_ms: int) -> dict:
    from crawl4ai import AsyncWebCrawler, BrowserConfig, CacheMode, CrawlerRunConfig

    browser = BrowserConfig(headless=True, viewport_width=1280, viewport_height=900)
    run = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        remove_overlay_elements=True,
        wait_until="networkidle",
        page_timeout=timeout_ms,
    )
    async with AsyncWebCrawler(config=browser) as crawler:
        result = await crawler.arun(url=url, config=run)
    markdown = getattr(result, "markdown", None) or ""
    if hasattr(markdown, "raw_markdown"):
        markdown = markdown.raw_markdown or str(markdown)
    meta = getattr(result, "metadata", None) or {}
    return {
        "ok": bool(getattr(result, "success", False)),
        "url": getattr(result, "url", url),
        "title": meta.get("title") if isinstance(meta, dict) else None,
        "markdown": str(markdown),
        "error": getattr(result, "error_message", None),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Crawl4AI single-page markdown crawl")
    parser.add_argument("url", nargs="?", help="Target URL")
    parser.add_argument("--url", dest="url_flag", help="Target URL (named)")
    parser.add_argument("--timeout-ms", type=int, default=60000)
    parser.add_argument("--json", action="store_true", help="Emit JSON envelope")
    args = parser.parse_args()
    url = (args.url_flag or args.url or "").strip()
    if not url:
        print("Usage: crawl_markdown.py <url>", file=sys.stderr)
        return 2
    try:
        payload = asyncio.run(crawl(url, args.timeout_ms))
    except ImportError as exc:
        print(
            "crawl4ai 未安装。请执行: pip install crawl4ai && crawl4ai-setup\n"
            f"详情: {exc}",
            file=sys.stderr,
        )
        return 3
    except Exception as exc:  # noqa: BLE001 — surface to agent
        print(f"crawl failed: {exc}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        if not payload["ok"]:
            print(payload.get("error") or "crawl failed", file=sys.stderr)
            return 1
        title = payload.get("title") or ""
        print(f"# {title}\n\nSource: {payload['url']}\n\n{payload['markdown']}".strip())
    return 0 if payload.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
