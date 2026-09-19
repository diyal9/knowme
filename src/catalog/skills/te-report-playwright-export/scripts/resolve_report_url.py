#!/usr/bin/env python3
"""从飞书文档 Markdown / 纯文本中提取 TE 报表 URL。"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from lark_cli_util import find_lark_cli, run_lark_cli

TE_URL_RE = re.compile(
    r"https?://bi\.forevernine\.net[^\s\)\]\"'<>]+",
    re.IGNORECASE,
)


def extract_from_text(text: str) -> list[str]:
    urls = TE_URL_RE.findall(text)
    # 去重保序
    seen: set[str] = set()
    out: list[str] = []
    for u in urls:
        u = u.rstrip(".,;")
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


def fetch_feishu_doc_markdown(doc_ref: str) -> str:
    if not find_lark_cli():
        raise RuntimeError("未找到 lark-cli，请先运行 bootstrap_auth.sh --initiate")
    proc = run_lark_cli(
        [
            "docs",
            "+fetch",
            "--api-version",
            "v2",
            "--doc",
            doc_ref,
            "--doc-format",
            "markdown",
            "--as",
            "user",
            "--format",
            "json",
        ],
        timeout=120,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr[:500] or "lark-cli docs +fetch 失败")
    data = json.loads(proc.stdout)
    payload = data.get("data") or data
    doc = payload.get("document") or {}
    return (
        doc.get("content")
        or payload.get("content")
        or payload.get("markdown")
        or ""
    )


def classify_input(raw: str) -> str:
    raw = raw.strip()
    if "feishu.cn" in raw or "larkoffice.com" in raw:
        return "feishu"
    return "te_direct"


def resolve_input(raw: str) -> list[str]:
    raw = raw.strip()
    if "bi.forevernine.net" in raw:
        found = extract_from_text(raw)
        return found if found else [raw]
    if "feishu.cn" in raw or "larkoffice.com" in raw:
        md = fetch_feishu_doc_markdown(raw)
        urls = extract_from_text(md)
        if not urls:
            raise RuntimeError("飞书文档中未找到 bi.forevernine.net 报表链接")
        return urls
    raise RuntimeError("请输入 TE 报表 URL 或飞书文档链接")


def main() -> int:
    p = argparse.ArgumentParser(description="解析 TE 报表 URL")
    p.add_argument("input", help="TE 报表 URL 或飞书 doc/wiki 链接")
    args = p.parse_args()
    try:
        urls = resolve_input(args.input)
        source = classify_input(args.input)
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False))
        return 1
    print(json.dumps({"ok": True, "urls": urls, "source": source}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
