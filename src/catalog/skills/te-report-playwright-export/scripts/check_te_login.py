#!/usr/bin/env python3
"""检测 TE BI 是否已登录（Step 0）。"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from te_auth import (  # noqa: E402
    EXIT_LOGIN_REQUIRED,
    EXIT_NO_STORAGE_STATE,
    EXIT_OK,
    load_profile,
    probe_te_login,
    resolve_storage_state,
)
from te_cli_util import emit_json, login_error_payload  # noqa: E402

DEFAULT_PROBE_URL = "https://bi.forevernine.net/#/tga/retention/2_86037?fromPanel=2_10790"


def memory_root_from_env() -> Path:
    import os

    try:
        hooks = Path(__file__).resolve().parents[3] / "hooks"
        sys.path.insert(0, str(hooks))
        import memory_paths as m  # type: ignore

        return m.memory_root()
    except Exception:
        local = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
        return Path(local) / "th-bi" / "memory"


def main() -> int:
    p = argparse.ArgumentParser(description="检测 TE BI 登录态")
    p.add_argument("--url", default=DEFAULT_PROBE_URL, help="TE 报表 URL（默认通用探测页）")
    p.add_argument("--memory-root", type=Path)
    p.add_argument("--storage-state", type=Path)
    args = p.parse_args()

    mem = args.memory_root or memory_root_from_env()
    storage = args.storage_state or resolve_storage_state(mem, load_profile(mem))

    if not storage:
        emit_json(
            login_error_payload(
                reason="no_storage_state",
                hint="运行 bootstrap_auth.sh --te-login --skip-feishu 登录 bi.forevernine.net",
            )
        )
        return EXIT_NO_STORAGE_STATE

    probe = probe_te_login(args.url, storage)
    if probe.get("logged_in"):
        emit_json({"logged_in": True, "reason": probe.get("reason", "report_page_ok")})
        return EXIT_OK

    emit_json(
        login_error_payload(
            reason=probe.get("reason", "login_page_detected"),
            hint="运行 bootstrap_auth.sh --te-login --skip-feishu 重新登录",
            probe=probe,
        )
    )
    return EXIT_LOGIN_REQUIRED


if __name__ == "__main__":
    raise SystemExit(main())
