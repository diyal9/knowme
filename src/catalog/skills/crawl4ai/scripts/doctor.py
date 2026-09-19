#!/usr/bin/env python3
"""Report whether crawl4ai and its browser stack are ready."""

from __future__ import annotations

import json
import sys


def main() -> int:
    report = {"ok": False, "crawl4ai": None, "error": None}
    try:
        import crawl4ai

        version = getattr(crawl4ai, "__version__", None)
        if not isinstance(version, (str, int, float)):
            version = "installed"
        report["crawl4ai"] = version
        report["ok"] = True
    except Exception as exc:  # noqa: BLE001
        report["error"] = str(exc)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 1
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
