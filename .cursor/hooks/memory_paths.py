#!/usr/bin/env python3
"""KnowMe Agent 记忆存储路径解析（Hook 与 Skill 共用）。"""
from __future__ import annotations

import hashlib
import os
import tempfile
from pathlib import Path


def repo_root_from_here() -> Path:
    return Path(__file__).resolve().parent.parent.parent


def workspace_id(repo_root: Path | None = None) -> str:
    root = (repo_root or repo_root_from_here()).resolve()
    digest = hashlib.sha256(str(root).encode("utf-8")).hexdigest()
    return digest[:12]


def memory_enabled() -> bool:
    return (os.environ.get("STICKY_MEMORY") or "1").strip().lower() not in (
        "0",
        "false",
        "no",
    )


def memory_root(repo_root: Path | None = None) -> Path:
    override = (os.environ.get("STICKY_MEMORY_ROOT") or "").strip()
    if override:
        base = Path(override).expanduser()
        if "{workspace_id}" in str(base):
            base = Path(str(base).replace("{workspace_id}", workspace_id(repo_root)))
        return base
    ws = workspace_id(repo_root)
    if os.name == "nt":
        local = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
        return Path(local) / "knowme" / "memory" / ws
    xdg = os.environ.get("XDG_DATA_HOME") or str(Path.home() / ".local" / "share")
    return Path(xdg) / "knowme" / "memory" / ws


def memory_buffer_dir(repo_root: Path | None = None) -> Path:
    override = (os.environ.get("STICKY_MEMORY_BUFFER") or "").strip()
    if override:
        return Path(override).expanduser()
    return (
        Path(tempfile.gettempdir())
        / "knowme"
        / "memory-buffer"
        / workspace_id(repo_root)
    )


def memory_layout(root: Path) -> dict[str, Path]:
    patterns_dir = root / "patterns"
    return {
        "root": root,
        "profile": root / "profile.yaml",
        "index": root / "index.md",
        "episodes": root / "episodes",
        "working": root / "working",
        "working_recent": root / "working" / "recent.jsonl",
        "patterns_dir": patterns_dir,
        "patterns": patterns_dir / "registry.json",
        "pending_prompts": patterns_dir / "pending_prompts.jsonl",
        "bootstrap": root / "bootstrap.md",
        "summaries_daily": root / "summaries" / "daily",
        "summaries_weekly": root / "summaries" / "weekly",
        "summaries_monthly": root / "summaries" / "monthly",
    }


def ensure_memory_layout(repo_root: Path | None = None) -> Path:
    root = memory_root(repo_root)
    layout = memory_layout(root)
    for key in (
        "episodes",
        "working",
        "patterns_dir",
        "summaries_daily",
        "summaries_weekly",
        "summaries_monthly",
    ):
        layout[key].mkdir(parents=True, exist_ok=True)
    if not layout["index"].is_file():
        layout["index"].write_text(
            "# KnowMe Agent Memory Index\n\n"
            f"- workspace_id: `{workspace_id(repo_root)}`\n"
            f"- root: `{root}`\n"
            "- skill: `.cursor/skills/sticky-agent-memory/SKILL.md`\n"
            "- team OKF: `brain/knowledge/`（须用户确认后 ingest）\n",
            encoding="utf-8",
        )
    if not layout["patterns"].is_file():
        layout["patterns"].write_text('{"patterns": []}\n', encoding="utf-8")
    return root
