"""TE 导出技能 CLI 输出约定：stdout 仅 JSON，人类可读进度/提示走 stderr。"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

OUTPUT_INFO_DIRNAME = "output-info"


def output_info_dir(output_dir: Path) -> Path:
    """CSV 以外的元数据（manifest、截图、批量汇总）写入 output-dir/output-info/。"""
    d = output_dir / OUTPUT_INFO_DIRNAME
    d.mkdir(parents=True, exist_ok=True)
    return d


def log_progress(message: str) -> None:
    print(f"[TE导出] {message}", file=sys.stderr, flush=True)


def log_login(message: str) -> None:
    print(f"[TE登录] {message}", file=sys.stderr, flush=True)


def emit_json(payload: dict[str, Any]) -> None:
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def sanitize_feishu_check(data: dict[str, Any]) -> dict[str, Any]:
    """去掉 lark-cli auth check 附带的版本更新通知，避免 Agent 误当错误展示。"""
    out = {k: v for k, v in data.items() if k != "_notice"}
    return out


def login_error_payload(
    *,
    reason: str,
    hint: str,
    probe: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "ok": False,
        "login_required": True,
        "reason": reason,
        "hint": hint,
    }
    if probe:
        payload["probe"] = {
            k: probe[k]
            for k in ("reason", "title", "final_url", "error")
            if k in probe
        }
    return payload
