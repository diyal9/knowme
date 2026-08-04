#!/usr/bin/env python3
"""Cursor Hook：KnowMe 本地 Agent 记忆采集、模式计数、上下文注入。"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from memory_paths import (
    ensure_memory_layout,
    memory_buffer_dir,
    memory_enabled,
    memory_layout,
    repo_root_from_here,
)

try:
    import memory_rollup_llm as mrl
except ImportError:
    mrl = None  # type: ignore

MEMORY_HOOK_VERSION = "1.0.0"
_MAX_TEXT = 4000
_MAX_WORKING_LINES = 500
_PROMPT_THRESHOLD = int(
    (os.environ.get("STICKY_MEMORY_PROMPT_THRESHOLD") or "3").strip() or "3"
)
_PROMPT_COOLDOWN_DAYS = 7

_CORRECTION_RE = re.compile(
    r"不对|应该是|错了|纠正|指正|不是.+而是|别用|不要用|应该用|搞错",
    re.IGNORECASE,
)
_PRODUCT_RE = re.compile(
    r"便签|Electron|IPC|preload|OpenSpec|架构|性能|置顶|托盘|热键|"
    r"自动保存|验收|门禁|意思是|指的是|约定|规范",
    re.IGNORECASE,
)
_SENSITIVE_KEYS = frozenset(
    {
        "password",
        "secret",
        "token",
        "api_key",
        "apikey",
        "authorization",
        "credential",
    }
)

_TZ = timezone(timedelta(hours=8))
_CTX_HEADER = "## Agent 本地记忆（sticky-agent-memory）\n"


def _stdin_text() -> str:
    buf = sys.stdin.buffer.read()
    if not buf:
        return ""
    if buf.startswith(b"\xef\xbb\xbf"):
        buf = buf[3:]
    for enc in ("utf-8", "gbk"):
        try:
            return buf.decode(enc)
        except UnicodeDecodeError:
            continue
    return buf.decode("utf-8", errors="replace")


def _load_dotenv() -> None:
    path = repo_root_from_here() / ".env"
    if not path.is_file():
        return
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return
    for line in text.splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        key, _, val = s.partition("=")
        key = key.strip()
        if not key or key in os.environ:
            continue
        val = val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        os.environ[key] = val


def _truncate(s: str, limit: int = _MAX_TEXT) -> str:
    s = s.strip()
    if len(s) <= limit:
        return s
    return s[: limit - 3] + "..."


def _redact_str(s: str) -> str:
    s = re.sub(
        r"(?i)(api[_-]?key|secret|token|password|authorization)\s*[:=]\s*\S+",
        r"\1=<redacted>",
        s,
    )
    return _truncate(s)


def _redact_obj(obj: Any, depth: int = 0) -> Any:
    if depth > 8:
        return "<max_depth>"
    if isinstance(obj, dict):
        out: dict[str, Any] = {}
        for k, v in obj.items():
            if str(k).lower() in _SENSITIVE_KEYS:
                out[k] = "<redacted>"
            else:
                out[k] = _redact_obj(v, depth + 1)
        return out
    if isinstance(obj, list):
        return [_redact_obj(x, depth + 1) for x in obj[:50]]
    if isinstance(obj, str):
        return _redact_str(obj)
    return obj


def _parse_stdin(raw: str) -> dict[str, Any]:
    s = raw.strip()
    if not s:
        return {}
    try:
        data = json.loads(s)
        return data if isinstance(data, dict) else {"_raw": data}
    except json.JSONDecodeError:
        return {"_parse_error": True, "_raw_preview": _truncate(s, 500)}


def _conversation_id(payload: dict[str, Any]) -> str:
    for key in ("conversation_id", "conversationId"):
        v = payload.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return "unknown"


def _pick_str(payload: dict[str, Any], *keys: str) -> str:
    for key in keys:
        v = payload.get(key)
        if isinstance(v, str) and v.strip():
            return _redact_str(v.strip())
    return ""


def _classify_kind(user_text: str, tool_name: str = "") -> str:
    if _CORRECTION_RE.search(user_text):
        return "correction"
    tl = tool_name.lower()
    if tool_name and any(
        x in tl
        for x in (
            "shell",
            "npm",
            "electron",
            "opsx",
            "gate",
            "test",
            "lint",
            "harness",
        )
    ):
        return "dev_workflow"
    if _PRODUCT_RE.search(user_text):
        return "product_theory"
    if re.search(r"习惯|默认|偏好|以后都|每次", user_text):
        return "habit"
    return "general"


def _fingerprint(kind: str, user_text: str, meta: dict[str, Any]) -> str:
    parts = [kind]
    for key in ("change_name", "tool_name", "mcp_server", "file_path"):
        v = meta.get(key)
        if v:
            parts.append(f"{key}={v}")
    norm = re.sub(r"\s+", " ", user_text.lower().strip())[:200]
    blob = "|".join(parts) + "|" + norm
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]


def _today() -> str:
    return datetime.now(_TZ).strftime("%Y-%m-%d")


def _append_jsonl(path: Path, record: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    line = json.dumps(record, ensure_ascii=False, default=str) + "\n"
    with path.open("a", encoding="utf-8") as f:
        f.write(line)


def _trim_jsonl(path: Path, max_lines: int) -> None:
    if not path.is_file():
        return
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
        if len(lines) <= max_lines:
            return
        path.write_text("\n".join(lines[-max_lines:]) + "\n", encoding="utf-8")
    except OSError:
        pass


def _load_patterns(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict) and isinstance(data.get("patterns"), list):
            return data["patterns"]
    except (OSError, json.JSONDecodeError):
        pass
    return []


def _save_patterns(path: Path, patterns: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps({"patterns": patterns}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _update_pattern(
    patterns: list[dict[str, Any]],
    fp: str,
    kind: str,
    episode_id: str,
    summary: str,
    meta: dict[str, Any],
) -> dict[str, Any] | None:
    now = datetime.now(_TZ).isoformat()
    for p in patterns:
        if p.get("fingerprint") == fp:
            p["count"] = int(p.get("count") or 0) + 1
            p["last_seen"] = now
            eps = p.get("episodes") or []
            if episode_id not in eps:
                eps.append(episode_id)
            p["episodes"] = eps[-10:]
            if not p.get("summary"):
                p["summary"] = _truncate(summary, 300)
            return p
    entry = {
        "id": f"pat_{fp[:8]}",
        "kind": kind,
        "fingerprint": fp,
        "count": 1,
        "first_seen": now,
        "last_seen": now,
        "summary": _truncate(summary, 300),
        "meta": meta,
        "episodes": [episode_id],
        "prompt_state": "pending",
        "last_prompted": None,
    }
    patterns.append(entry)
    return entry


def _enqueue_prompt(layout: dict[str, Path], pattern: dict[str, Any]) -> None:
    entry = {
        "ts": datetime.now(_TZ).isoformat(),
        "pattern_id": pattern.get("id"),
        "kind": pattern.get("kind"),
        "count": pattern.get("count"),
        "summary": pattern.get("summary"),
    }
    _append_jsonl(layout["pending_prompts"], entry)


def _should_prompt_pattern(p: dict[str, Any]) -> bool:
    if int(p.get("count") or 0) < _PROMPT_THRESHOLD:
        return False
    if p.get("prompt_state") in ("dismissed", "promoted_kb", "promoted_skill"):
        return False
    last = p.get("last_prompted")
    if isinstance(last, str) and last:
        try:
            lp = datetime.fromisoformat(last.replace("Z", "+00:00"))
            if datetime.now(_TZ) - lp.astimezone(_TZ) < timedelta(
                days=_PROMPT_COOLDOWN_DAYS
            ):
                return False
        except ValueError:
            pass
    return True


def _write_episode(
    layout: dict[str, Path],
    conversation_id: str,
    kind: str,
    user_text: str,
    agent_text: str,
    meta: dict[str, Any],
) -> dict[str, Any]:
    episode_id = str(uuid.uuid4())
    ts = datetime.now(_TZ).isoformat()
    record: dict[str, Any] = {
        "id": episode_id,
        "ts": ts,
        "conversation_id": conversation_id,
        "kind": kind,
        "user_text": _truncate(user_text),
        "agent_summary": _truncate(agent_text, 800),
        "meta": _redact_obj(meta),
        "confidence": "user_stated" if kind == "correction" else "agent_inferred",
    }
    day_dir = layout["episodes"] / _today()
    _append_jsonl(day_dir / f"{conversation_id}.jsonl", record)
    if kind in ("correction", "product_theory", "habit", "dev_workflow"):
        _append_jsonl(layout["working_recent"], record)
        _trim_jsonl(layout["working_recent"], _MAX_WORKING_LINES)
    return record


def _rollup_daily(layout: dict[str, Path], day: str) -> dict[str, list[str]]:
    day_dir = layout["episodes"] / day
    sections: dict[str, list[str]] = {
        "用户指正": [],
        "产品 / 架构约定": [],
        "开发工作流": [],
    }
    if not day_dir.is_dir():
        return sections
    lines: list[str] = []
    for fp in sorted(day_dir.glob("*.jsonl")):
        try:
            for line in fp.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    lines.append(line)
        except OSError:
            continue
    for line in lines:
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            continue
        kind = rec.get("kind")
        text = rec.get("user_text") or rec.get("agent_summary") or ""
        if not text:
            continue
        if kind == "correction":
            sections["用户指正"].append(f"- {text}")
        elif kind == "product_theory":
            sections["产品 / 架构约定"].append(f"- {text}")
        elif kind == "dev_workflow":
            sections["开发工作流"].append(f"- {text}")
    if not any(sections.values()):
        return sections
    out = layout["summaries_daily"] / f"{day}.md"
    if not out.is_file():
        body = [f"# Daily Memory — {day}", ""]
        for title, items in sections.items():
            if items:
                body += [f"## {title}", *items[:20], ""]
        try:
            out.write_text("\n".join(body) + "\n", encoding="utf-8")
        except OSError:
            pass
    if mrl is not None:
        try:
            mrl.maybe_enhance_daily(out, day, sections)
        except Exception:
            pass
    return sections


def _rollup_weekly(layout: dict[str, Path]) -> None:
    today = datetime.now(_TZ).date()
    iso = today.isocalendar()
    week_key = f"{iso.year}-W{iso.week:02d}"
    out = layout["summaries_weekly"] / f"{week_key}.md"
    if out.is_file():
        return
    start = today - timedelta(days=today.weekday())
    chunks: list[str] = []
    for i in range(7):
        d = (start + timedelta(days=i)).isoformat()
        daily = layout["summaries_daily"] / f"{d}.md"
        if daily.is_file():
            try:
                chunks.append(daily.read_text(encoding="utf-8"))
            except OSError:
                pass
    if not chunks:
        return
    try:
        out.write_text(
            f"# Weekly Memory — {week_key}\n\n" + "\n\n---\n\n".join(chunks),
            encoding="utf-8",
        )
    except OSError:
        pass
    if mrl is not None:
        try:
            sources = [
                layout["summaries_daily"]
                / f"{(start + timedelta(days=i)).isoformat()}.md"
                for i in range(7)
            ]
            mrl.maybe_enhance_period(out, f"Weekly Memory — {week_key}", sources)
        except Exception:
            pass


def _rollup_monthly(layout: dict[str, Path]) -> None:
    month_key = datetime.now(_TZ).strftime("%Y-%m")
    out = layout["summaries_monthly"] / f"{month_key}.md"
    if out.is_file():
        return
    chunks: list[str] = []
    daily_dir = layout["summaries_daily"]
    if daily_dir.is_dir():
        for daily in sorted(daily_dir.glob(f"{month_key}-*.md")):
            try:
                chunks.append(daily.read_text(encoding="utf-8"))
            except OSError:
                pass
    if not chunks:
        return
    try:
        out.write_text(
            f"# Monthly Memory — {month_key}\n\n" + "\n\n---\n\n".join(chunks),
            encoding="utf-8",
        )
    except OSError:
        pass
    if mrl is not None:
        try:
            sources = sorted(layout["summaries_daily"].glob(f"{month_key}-*.md"))
            mrl.maybe_enhance_period(out, f"Monthly Memory — {month_key}", sources)
        except Exception:
            pass


def _search_context(layout: dict[str, Path], hint: str) -> str:
    parts: list[str] = []
    recent = layout["working_recent"]
    if recent.is_file() and hint:
        try:
            for line in recent.read_text(encoding="utf-8").splitlines()[-80:]:
                if not line.strip():
                    continue
                rec = json.loads(line)
                blob = (rec.get("user_text") or "") + (rec.get("agent_summary") or "")
                if any(tok in blob for tok in hint.split() if len(tok) > 1):
                    parts.append(
                        f"[{rec.get('kind')}] {rec.get('user_text') or rec.get('agent_summary')}"
                    )
        except (OSError, json.JSONDecodeError):
            pass
    bootstrap = layout.get("bootstrap") or (layout["root"] / "bootstrap.md")
    if bootstrap.is_file():
        try:
            parts.append(bootstrap.read_text(encoding="utf-8")[:2000])
        except OSError:
            pass
    else:
        daily = layout["summaries_daily"] / f"{_today()}.md"
        if daily.is_file():
            try:
                parts.append(daily.read_text(encoding="utf-8")[:1500])
            except OSError:
                pass
    patterns = _load_patterns(layout["patterns"])
    for p in patterns:
        if _should_prompt_pattern(p):
            parts.append(f"[重复×{p.get('count')}] {p.get('kind')}: {p.get('summary')}")
    if not parts:
        return ""
    return _truncate("\n".join(parts), 2000)


def _handle_event(event: str, payload: dict[str, Any]) -> dict[str, Any]:
    if not memory_enabled():
        return {}

    root = ensure_memory_layout()
    layout = memory_layout(root)
    cid = _conversation_id(payload)
    out: dict[str, Any] = {}

    if event == "sessionStart":
        memory_buffer_dir().mkdir(parents=True, exist_ok=True)
        if mrl is not None:
            try:
                mrl.write_bootstrap(layout)
            except Exception:
                pass
        bootstrap = layout["bootstrap"]
        if bootstrap.is_file():
            try:
                content = bootstrap.read_text(encoding="utf-8")[:2500]
                out["additional_context"] = _CTX_HEADER + content
            except OSError:
                pass
        return out

    if event == "beforeSubmitPrompt":
        user_text = _pick_str(payload, "prompt", "user_message", "text", "content")
        if user_text:
            kind = _classify_kind(user_text)
            meta: dict[str, Any] = {"hook_event": event}
            rec = _write_episode(layout, cid, kind, user_text, "", meta)
            fp = _fingerprint(kind, user_text, meta)
            patterns = _load_patterns(layout["patterns"])
            updated = _update_pattern(patterns, fp, kind, rec["id"], user_text, meta)
            _save_patterns(layout["patterns"], patterns)
            if updated and _should_prompt_pattern(updated):
                _enqueue_prompt(layout, updated)
                updated["last_prompted"] = datetime.now(_TZ).isoformat()
                _save_patterns(layout["patterns"], patterns)
        return out

    if event == "afterAgentResponse":
        agent_text = _pick_str(payload, "response", "text", "content", "agent_response")
        user_text = _pick_str(payload, "user_message", "prompt")
        if agent_text or user_text:
            kind = _classify_kind(user_text or agent_text)
            _write_episode(
                layout,
                cid,
                kind,
                user_text,
                agent_text,
                {"hook_event": event},
            )
        return out

    if event == "afterMCPExecution":
        tool = _pick_str(payload, "tool_name", "toolName", "name")
        mcp = _pick_str(payload, "mcp_server", "server", "mcpServer")
        meta = {"tool_name": tool, "mcp_server": mcp, "hook_event": event}
        summary = f"MCP {mcp} · {tool}"
        kind = "dev_workflow"
        rec = _write_episode(layout, cid, kind, summary, "", meta)
        fp = _fingerprint(kind, summary, meta)
        patterns = _load_patterns(layout["patterns"])
        updated = _update_pattern(patterns, fp, kind, rec["id"], summary, meta)
        _save_patterns(layout["patterns"], patterns)
        if updated and _should_prompt_pattern(updated):
            _enqueue_prompt(layout, updated)
            updated["last_prompted"] = datetime.now(_TZ).isoformat()
            _save_patterns(layout["patterns"], patterns)
        return out

    if event == "postToolUse":
        tool = _pick_str(payload, "tool_name", "toolName")
        hint = tool or _pick_str(payload, "prompt", "user_message")
        ctx = _search_context(layout, hint)
        if ctx:
            out["additional_context"] = _CTX_HEADER + ctx
        return out

    if event in ("sessionEnd", "stop", "preCompact"):
        day = _today()
        _rollup_daily(layout, day)
        _rollup_weekly(layout)
        _rollup_monthly(layout)
        return out

    return out


def main() -> None:
    _load_dotenv()
    event = sys.argv[1] if len(sys.argv) > 1 else "unknown"
    raw = _stdin_text()
    payload = _parse_stdin(raw)

    extra: dict[str, Any] = {}
    try:
        extra = _handle_event(event, payload)
    except Exception:
        extra = {}

    if extra:
        line = json.dumps(extra, ensure_ascii=False)
    else:
        line = "{}"

    sys.stdout.write(line + "\n")
    sys.stdout.flush()


if __name__ == "__main__":
    main()
