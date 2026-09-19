#!/usr/bin/env python3
"""扫描 TE 导出输出目录是否已有文件（供 Agent AskQuestion 前调用）。"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from te_cli_util import emit_json  # noqa: E402
from te_output_dir import (  # noqa: E402
    EXIT_NEEDS_USER_CHOICE,
    list_existing_exports,
    needs_user_choice_payload,
)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="检查 TE 导出输出目录是否非空")
    p.add_argument("--output-dir", required=True, type=Path)
    return p.parse_args()


def main() -> int:
    args = parse_args()
    scan = list_existing_exports(args.output_dir)
    if scan["has_files"]:
        emit_json(needs_user_choice_payload(scan))
        return EXIT_NEEDS_USER_CHOICE
    emit_json({"ok": True, "empty": True, "scan": scan})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
