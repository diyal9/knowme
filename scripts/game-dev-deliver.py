#!/usr/bin/env python3
"""Generate reviewable delivery artifacts from an approved requirement brief."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

MIN_BRIEF_CHARS = 40


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _extract_title(brief: str, fallback: str) -> str:
    for pattern in (
        r"游戏需求研发[：:]\s*(.+)",
        r"^#\s+Brief\s*\n+\s*(.+)",
        r"^#\s+(.+)",
    ):
        match = re.search(pattern, brief, re.M)
        if match:
            return match.group(1).strip()[:120]
    return fallback


def _acceptance_rows(brief: str) -> list[str]:
    rows: list[str] = []
    for line in brief.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if re.search(r"验收|acceptance|测试点", stripped, re.I):
            rows.append(stripped.lstrip("-* ").strip())
        elif stripped.startswith(("-", "*")) and len(rows) < 8:
            rows.append(stripped.lstrip("-* ").strip())
    if not rows:
        rows = ["核心流程可完成且无阻断缺陷", "异常态有明确提示", "关键埋点可观测（若需求案包含）"]
    return rows[:8]


def main() -> int:
    parser = argparse.ArgumentParser(description="KnowMe game dev delivery pack generator")
    parser.add_argument("--task", required=True, help="workflow task slug")
    parser.add_argument("--root", default=os.environ.get("WORKFLOW_ROOT", "."), help="workbench repo root")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    task_base = root / "workflow-spec" / args.task
    brief_path = task_base / "ingest" / "brief.md"
    artifacts = task_base / "artifacts"
    artifacts.mkdir(parents=True, exist_ok=True)

    mode = os.environ.get("KNOWME_DELIVER_MODE", "").strip().lower()
    if mode == "fail":
        print("KNOWME_DELIVER_MODE=fail: 模拟交付失败，可用于恢复/重试验证", file=sys.stderr)
        return 1

    if not brief_path.is_file():
        print(f"缺少需求案 brief: {brief_path}", file=sys.stderr)
        return 1

    brief = brief_path.read_text(encoding="utf-8", errors="replace").strip()
    if len(brief) < MIN_BRIEF_CHARS:
        print(
            f"需求案内容过短（{len(brief)} 字符，至少需要 {MIN_BRIEF_CHARS}）："
            "请通过 KnowMe handoff 写入完整结构化需求案后再重试",
            file=sys.stderr,
        )
        return 1

    title = _extract_title(brief, args.task)
    now = _utc_now()

    delivery = artifacts / "delivery-pack.md"
    checklist = artifacts / "implementation-checklist.md"
    matrix = artifacts / "acceptance-matrix.md"

    delivery.write_text(
        "\n".join([
            f"# 研发交付包 — {title}",
            "",
            f"- 任务: `{args.task}`",
            f"- 生成时间: {now}",
            "- 来源: ingest/brief.md",
            "",
            "## 需求摘要",
            "",
            brief[:6000],
            "",
            "## 交付范围",
            "",
            "1. 客户端：核心玩法/奖励 UI 与状态同步",
            "2. 服务端：接口契约、幂等与错误码",
            "3. QA：对照 acceptance-matrix.md 执行冒烟",
            "",
            "## 审阅指引",
            "",
            "- 实现清单：`implementation-checklist.md`",
            "- 验收矩阵：`acceptance-matrix.md`",
        ]),
        encoding="utf-8",
    )

    checklist.write_text(
        "\n".join([
            f"# 实现清单 — {title}",
            "",
            "- [ ] 对照需求案梳理影响模块",
            "- [ ] 定义/更新 API 契约（请求、响应、错误码）",
            "- [ ] 客户端联调：主路径 + 空态/异常态",
            "- [ ] 服务端幂等与并发边界",
            "- [ ] 埋点与日志（若需求案包含）",
            "- [ ] 回归：核心路径无控制台报错",
        ]),
        encoding="utf-8",
    )

    rows = _acceptance_rows(brief)
    matrix.write_text(
        "\n".join([
            f"# 验收矩阵 — {title}",
            "",
            "| 项 | 预期 | 状态 |",
            "| --- | --- | --- |",
            *[f"| {row[:60]} | 通过 | 待验 |" for row in rows],
        ]),
        encoding="utf-8",
    )

    manifest = {
        "task": args.task,
        "title": title,
        "generatedAt": now,
        "artifacts": [
            "artifacts/delivery-pack.md",
            "artifacts/implementation-checklist.md",
            "artifacts/acceptance-matrix.md",
        ],
    }
    (artifacts / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(manifest, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
