#!/usr/bin/env python3
"""可选 LLM 摘要与 session bootstrap（stdlib，OpenAI 兼容 API）。"""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

_TZ = timezone(timedelta(hours=8))
_LLM_SECTION = "## LLM 摘要"
_TIMEOUT = int((os.environ.get("STICKY_MEMORY_LLM_TIMEOUT") or "45").strip() or "45")


def llm_enabled() -> bool:
    return (os.environ.get("STICKY_MEMORY_LLM") or "").strip().lower() in (
        "1",
        "true",
        "yes",
    )


def _api_key() -> str:
    return (
        (os.environ.get("STICKY_MEMORY_LLM_API_KEY") or "").strip()
        or (os.environ.get("OPENAI_API_KEY") or "").strip()
    )


def _base_url() -> str:
    raw = (
        os.environ.get("STICKY_MEMORY_LLM_BASE_URL") or "https://api.openai.com/v1"
    ).strip()
    return raw.rstrip("/")


def _model() -> str:
    return (os.environ.get("STICKY_MEMORY_LLM_MODEL") or "gpt-4o-mini").strip()


def chat_complete(system: str, user: str) -> str | None:
    key = _api_key()
    if not key:
        return None
    url = f"{_base_url()}/chat/completions"
    body = {
        "model": _model(),
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        choices = data.get("choices") or []
        if choices and isinstance(choices[0], dict):
            msg = choices[0].get("message") or {}
            content = msg.get("content")
            if isinstance(content, str) and content.strip():
                return content.strip()
    except (
        urllib.error.URLError,
        urllib.error.HTTPError,
        TimeoutError,
        json.JSONDecodeError,
        OSError,
    ):
        return None
    return None


def synthesize_daily(day: str, sections: dict[str, list[str]]) -> str | None:
    if not any(sections.values()):
        return None
    bullets = []
    for title, items in sections.items():
        if items:
            bullets.append(f"### {title}\n" + "\n".join(items[:25]))
    user = (
        f"日期：{day}\n\n"
        "以下为 KnowMe 项目 Agent 记忆片段。"
        "请用中文输出 200～400 字结构化摘要：\n"
        "1. 用户纠正了什么\n"
        "2. 产品/架构约定\n"
        "3. 重复出现的开发或测试操作\n"
        "4. 待确认是否写入 OKF 的项\n"
        "不要编造未出现的事实。\n\n" + "\n\n".join(bullets)
    )
    return chat_complete(
        "你是 KnowMe 桌面便签项目的记忆整理员，只基于给定片段摘要，不臆测。",
        user,
    )


def synthesize_period(period_label: str, daily_bodies: list[str]) -> str | None:
    if not daily_bodies:
        return None
    joined = "\n\n---\n\n".join(d[:6000] for d in daily_bodies[:14])
    user = (
        f"周期：{period_label}\n\n"
        "以下是多个日摘要。请合并为 300～600 字中文周报式记忆摘要：\n"
        "- 持续有效的产品/技术约定\n"
        "- 用户习惯与偏好\n"
        "- 高频开发/测试任务\n"
        "- 仍待写入 brain/knowledge 的事项\n"
        "不要编造。\n\n" + joined
    )
    return chat_complete(
        "你是 KnowMe 项目的记忆整理员，合并日摘要为周期摘要。",
        user,
    )


def append_llm_section(path: Path, llm_text: str) -> None:
    if _LLM_SECTION in path.read_text(encoding="utf-8") if path.is_file() else "":
        return
    block = f"\n{_LLM_SECTION}\n\n{llm_text.strip()}\n"
    if path.is_file():
        path.write_text(path.read_text(encoding="utf-8").rstrip() + block, encoding="utf-8")
    else:
        path.write_text(block.lstrip(), encoding="utf-8")


def _read_jsonl_tail(path: Path, n: int = 20) -> list[dict[str, Any]]:
    if not path.is_file():
        return []
    try:
        lines = [ln for ln in path.read_text(encoding="utf-8").splitlines() if ln.strip()]
    except OSError:
        return []
    out: list[dict[str, Any]] = []
    for line in lines[-n:]:
        try:
            rec = json.loads(line)
            if isinstance(rec, dict):
                out.append(rec)
        except json.JSONDecodeError:
            continue
    return out


def _pending_for_bootstrap(layout: dict[str, Path]) -> list[dict[str, Any]]:
    pending_path = layout["pending_prompts"]
    seen: set[str] = set()
    items: list[dict[str, Any]] = []
    for rec in _read_jsonl_tail(pending_path, 30):
        pid = str(rec.get("pattern_id") or "")
        if pid and pid in seen:
            continue
        if pid:
            seen.add(pid)
        items.append(rec)
    return items[-5:]


def _recent_high_value(layout: dict[str, Path], n: int = 8) -> list[str]:
    lines: list[str] = []
    for rec in _read_jsonl_tail(layout["working_recent"], n * 2):
        kind = rec.get("kind")
        if kind not in ("correction", "product_theory", "habit"):
            continue
        text = rec.get("user_text") or rec.get("agent_summary") or ""
        if text:
            lines.append(f"- [{kind}] {text}")
        if len(lines) >= n:
            break
    return lines


def build_bootstrap_markdown(layout: dict[str, Path]) -> str:
    now = datetime.now(_TZ).isoformat()
    day = datetime.now(_TZ).strftime("%Y-%m-%d")
    parts = [
        f"# Session Bootstrap — {now}",
        "",
        "由 `memory_cursor_hook.py` 在 sessionStart 生成。",
        "升库目标：`brain/knowledge/`（OKF），须用户确认。",
        "",
    ]
    pending = _pending_for_bootstrap(layout)
    if pending:
        parts += ["## 待处理（≥3 次重复 · 须询问用户）", ""]
        for p in pending:
            parts.append(
                f"- **[{p.get('kind')} ×{p.get('count')}]** {p.get('summary')} "
                f"(pattern_id: `{p.get('pattern_id')}`)"
            )
        parts += [
            "",
            "→ 按 `sticky-agent-memory` references/promotion.md 询问：升 OKF / 建 Skill / 暂不。",
            "",
        ]
    recent = _recent_high_value(layout)
    if recent:
        parts += ["## 近期指正 / 约定 / 习惯", "", *recent, ""]
    daily = layout["summaries_daily"] / f"{day}.md"
    if daily.is_file():
        try:
            body = daily.read_text(encoding="utf-8")
            m = re.search(rf"{re.escape(_LLM_SECTION)}\n+(.*)", body, re.DOTALL)
            excerpt = (m.group(1) if m else body)[:1200]
            parts += ["## 今日记忆摘录", "", excerpt.strip(), ""]
        except OSError:
            pass
    if len(parts) <= 5:
        parts += ["_（暂无高价值记忆片段）_", ""]
    parts += [
        "---",
        f"- memory_root: `{layout['root']}`",
        "- skill: `.cursor/skills/sticky-agent-memory/SKILL.md`",
        "- team OKF: `brain/knowledge/index.md`",
    ]
    return "\n".join(parts)


def write_bootstrap(layout: dict[str, Path]) -> None:
    path = layout["root"] / "bootstrap.md"
    try:
        path.write_text(build_bootstrap_markdown(layout), encoding="utf-8")
    except OSError:
        pass


def maybe_enhance_daily(path: Path, day: str, sections: dict[str, list[str]]) -> None:
    if not llm_enabled() or not path.is_file():
        return
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return
    if _LLM_SECTION in text:
        return
    llm = synthesize_daily(day, sections)
    if llm:
        append_llm_section(path, llm)


def maybe_enhance_period(path: Path, label: str, source_paths: list[Path]) -> None:
    if path.is_file() and _LLM_SECTION in path.read_text(encoding="utf-8"):
        return
    if not llm_enabled():
        return
    bodies: list[str] = []
    for p in source_paths:
        if p.is_file():
            try:
                bodies.append(p.read_text(encoding="utf-8"))
            except OSError:
                pass
    if not bodies:
        return
    llm = synthesize_period(label, bodies)
    if not llm:
        return
    header = f"# {label}\n\n"
    if path.is_file():
        append_llm_section(path, llm)
    else:
        path.write_text(header + f"{_LLM_SECTION}\n\n{llm.strip()}\n", encoding="utf-8")


def _cli_bootstrap() -> None:
    import sys

    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from memory_paths import ensure_memory_layout, memory_layout

    root = ensure_memory_layout()
    layout = memory_layout(root)
    write_bootstrap(layout)
    print(layout["root"] / "bootstrap.md")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "bootstrap":
        _cli_bootstrap()
    else:
        print("Usage: python memory_rollup_llm.py bootstrap", file=sys.stderr)
