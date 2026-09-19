"""输出目录已有文件时的扫描与处理策略。"""
from __future__ import annotations

import json
import shutil
import time
from pathlib import Path
from typing import Any

from te_cli_util import OUTPUT_INFO_DIRNAME, output_info_dir
from te_export_core import url_slug

EXIT_NEEDS_USER_CHOICE = 30
ON_EXISTING_CHOICES = ("overwrite", "skip", "archive", "abort")


def list_existing_exports(output_dir: Path) -> dict[str, Any]:
    output_dir = Path(output_dir)
    csv_files = sorted(output_dir.glob("*.csv"))
    info = output_dir / OUTPUT_INFO_DIRNAME
    manifests: list[Path] = []
    png_files: list[Path] = []
    batch_summary: Path | None = None
    if info.is_dir():
        manifests = sorted(info.glob("export_manifest_*.json"))
        png_files = sorted(info.glob("*.png"))
        candidate = info / "_batch_summary.json"
        if candidate.exists():
            batch_summary = candidate

    legacy_summary = output_dir / "_batch_summary.json"
    has_files = bool(csv_files or manifests or png_files or batch_summary or legacy_summary.exists())

    return {
        "has_files": has_files,
        "output_dir": str(output_dir.resolve()),
        "csv_count": len(csv_files),
        "csv_samples": [p.name for p in csv_files[:12]],
        "manifest_count": len(manifests),
        "screenshot_count": len(png_files),
        "has_batch_summary": batch_summary is not None or legacy_summary.exists(),
        "choices": list(ON_EXISTING_CHOICES),
    }


def needs_user_choice_payload(scan: dict[str, Any]) -> dict[str, Any]:
    return {
        "ok": False,
        "needs_user_choice": True,
        "reason": "output_dir_not_empty",
        "message": (
            f"输出目录已有 {scan['csv_count']} 个 CSV"
            f"（及 {scan['manifest_count']} 份 manifest），请选择处理方式"
        ),
        "scan": scan,
        "choices": list(ON_EXISTING_CHOICES),
        "hint": "Agent 须 AskQuestion 后带 --on-existing <choice> 重新执行",
    }


def archive_existing(output_dir: Path) -> Path:
    """将现有 CSV 与 output-info 内容归档到 output-info/archive_<ts>/。"""
    output_dir = Path(output_dir)
    info = output_info_dir(output_dir)
    ts = time.strftime("%Y%m%d_%H%M%S")
    archive_root = info / f"archive_{ts}"
    archive_root.mkdir(parents=True, exist_ok=True)

    for csv in output_dir.glob("*.csv"):
        shutil.move(str(csv), str(archive_root / csv.name))

    for item in list(info.iterdir()):
        if item.name.startswith("archive_"):
            continue
        dest = archive_root / item.name
        if item.is_dir():
            shutil.move(str(item), str(dest))
        else:
            shutil.move(str(item), str(dest))

    legacy_summary = output_dir / "_batch_summary.json"
    if legacy_summary.exists():
        shutil.move(str(legacy_summary), str(archive_root / legacy_summary.name))

    return archive_root


def should_skip_url(output_dir: Path, report_url: str) -> bool:
    info = output_dir / OUTPUT_INFO_DIRNAME
    manifest_path = info / f"export_manifest_{url_slug(report_url)}.json"
    if not manifest_path.exists():
        return False
    try:
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return False
    if not data.get("ok"):
        return False
    for item in data.get("files") or []:
        path = item.get("path")
        if path and Path(path).exists():
            return True
    return False


def resolve_on_existing(
    output_dir: Path,
    policy: str | None,
) -> tuple[str | None, dict[str, Any]]:
    """
    返回 (effective_policy, scan)。
    policy 为 None 或 prompt 且目录非空时返回 (None, scan) 表示须询问用户。
    """
    scan = list_existing_exports(output_dir)
    if not scan["has_files"]:
        return policy or "overwrite", scan

    if policy is None or policy == "prompt":
        return None, scan

    if policy not in ON_EXISTING_CHOICES:
        raise ValueError(f"无效的 --on-existing: {policy}")

    if policy == "abort":
        raise OutputDirNotEmptyError(scan)

    if policy == "archive":
        archive_path = archive_existing(output_dir)
        scan["archived_to"] = str(archive_path)
        return policy, scan

    return policy, scan


class OutputDirNotEmptyError(Exception):
    def __init__(self, scan: dict[str, Any]) -> None:
        self.scan = scan
        super().__init__("output_dir_not_empty")
