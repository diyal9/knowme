#!/usr/bin/env python3
"""Locate last30days-cn engine and run a topic research query."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path


CANDIDATE_ROOTS = [
    Path(os.environ.get("LAST30DAYS_ROOT", "")),
    Path(r"D:\Docs\openkb-wiki\vendor\last30days-skill-cn"),
    Path.home() / "Docs" / "openkb-wiki" / "vendor" / "last30days-skill-cn",
]


def resolve_script() -> Path | None:
    for root in CANDIDATE_ROOTS:
        if not root or str(root) in {".", ""}:
            continue
        for rel in (
            Path("scripts") / "last30days.py",
            Path("skills") / "last30days" / "scripts" / "last30days.py",
        ):
            candidate = (root / rel).resolve()
            if candidate.is_file():
                return candidate
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Run last30days-cn research")
    parser.add_argument("topic", nargs="?", help="Research topic")
    parser.add_argument("--topic", dest="topic_flag")
    parser.add_argument("--mode", choices=["quick", "deep", "default"], default="quick")
    parser.add_argument("--emit", default="compact")
    parser.add_argument("--search", default="")
    parser.add_argument("--as-of", dest="as_of", default="")
    parser.add_argument("--diagnose", action="store_true")
    parser.add_argument("--days", type=int, default=0)
    args, extra = parser.parse_known_args()

    script = resolve_script()
    if not script:
        print(
            "未找到 last30days-cn 引擎。请设置 LAST30DAYS_ROOT，"
            "或克隆 https://github.com/Jesseovo/last30days-skill-cn"
            " 到 vendor/last30days-skill-cn。",
            file=sys.stderr,
        )
        return 3

    cmd = [sys.executable, str(script)]
    if args.diagnose:
        cmd.append("--diagnose")
        if args.emit:
            cmd.extend(["--emit", args.emit])
    else:
        topic = (args.topic_flag or args.topic or "").strip()
        if not topic:
            print("Usage: run_last30days.py <topic> [--mode quick|deep]", file=sys.stderr)
            return 2
        cmd.append(topic)
        if args.mode == "quick":
            cmd.append("--quick")
        elif args.mode == "deep":
            cmd.append("--deep")
        if args.emit:
            cmd.extend(["--emit", args.emit])
        if args.search:
            cmd.extend(["--search", args.search])
        if args.as_of:
            cmd.extend(["--as-of", args.as_of])
        if args.days > 0:
            cmd.extend(["--days", str(args.days)])
        cmd.extend(extra)

    env = os.environ.copy()
    env.setdefault("LAST30DAYS_ROOT", str(script.parents[1]))
    completed = subprocess.run(cmd, env=env, check=False)
    return int(completed.returncode)


if __name__ == "__main__":
    raise SystemExit(main())
