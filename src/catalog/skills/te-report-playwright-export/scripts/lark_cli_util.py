"""定位本机 lark-cli 可执行文件（Git Bash / Windows npm PATH）。"""
from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path


def find_lark_cli() -> str | None:
    found = shutil.which("lark-cli")
    if found:
        return found
    appdata = os.environ.get("APPDATA") or str(Path.home() / "AppData" / "Roaming")
    for name in ("lark-cli.cmd", "lark-cli", "lark-cli.exe"):
        candidate = Path(appdata) / "npm" / name
        if candidate.is_file():
            return str(candidate)
    return None


def run_lark_cli(args: list[str], *, timeout: int = 120) -> subprocess.CompletedProcess[str]:
    cli = find_lark_cli()
    if not cli:
        raise FileNotFoundError("未找到 lark-cli，请安装: npm install -g @larksuiteoapi/lark-cli")
    return subprocess.run(
        [cli, *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
    )
