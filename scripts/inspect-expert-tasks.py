import argparse
import json
import sys

from playwright.sync_api import sync_playwright


def main():
    parser = argparse.ArgumentParser(description="Read isolated KnowMe expert tasks and transcripts by exact task ID.")
    parser.add_argument("task_ids", help="Comma-separated task IDs")
    parser.add_argument("--cdp", default="http://127.0.0.1:9223")
    parser.add_argument(
        "--mode",
        choices=("full", "shape", "summary"),
        default="full",
        help="Choose full JSON, a key/type shape, or a compact task/transcript summary.",
    )
    args = parser.parse_args()
    task_ids = [value.strip() for value in args.task_ids.split(",") if value.strip()]
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    with sync_playwright() as playwright:
        browser = playwright.chromium.connect_over_cdp(args.cdp)
        contexts = browser.contexts
        if len(contexts) != 1 or len(contexts[0].pages) != 1:
            raise RuntimeError("Expected exactly one isolated KnowMe page")
        page = contexts[0].pages[0]
        rows = page.evaluate(
            """async ids => {
                const rows = []
                for (const id of ids) {
                    const result = await window.api.expertTaskGet(id)
                    const task = result?.task || null
                    const sessionId = task?.execRef?.id || ''
                    const transcript = sessionId
                        ? await window.api.agentSessionTranscript(sessionId)
                        : null
                    const sessionResult = sessionId
                        ? await window.api.agentSessionGet(sessionId)
                        : null
                    const session = sessionResult?.session || sessionResult || null
                    rows.push({ id, ok: result?.ok, error: result?.error || result?.message || null, task, session, transcript })
                }
                return rows
            }""",
            task_ids,
        )
        if args.mode == "shape":
            rows = [_shape(row) for row in rows]
        elif args.mode == "summary":
            rows = [_summarize(row) for row in rows]
        print(json.dumps(rows, ensure_ascii=False, indent=2))
        browser.close()


def _shape(value, depth=0):
    if depth >= 4:
        return type(value).__name__
    if isinstance(value, dict):
        return {key: _shape(item, depth + 1) for key, item in value.items()}
    if isinstance(value, list):
        return {
            "type": "list",
            "length": len(value),
            "item": _shape(value[0], depth + 1) if value else None,
        }
    if isinstance(value, str):
        return {"type": "str", "length": len(value), "preview": value[:120]}
    return {"type": type(value).__name__, "value": value}


def _summarize(row):
    task = row.get("task") or {}
    transcript = row.get("transcript") or {}
    session = row.get("session") or {}
    return {
        "id": row.get("id"),
        "ok": row.get("ok"),
        "error": row.get("error"),
        "task": {
            key: task.get(key)
            for key in (
                "status",
                "goal",
                "progress",
                "attention",
                "execRef",
                "deliverables",
                "events",
                "executionEvidence",
                "resultSummary",
                "updatedAt",
            )
            if key in task
        },
        "transcript": {
            key: transcript.get(key)
            for key in ("ok", "status", "text", "messages", "events", "artifacts", "error")
            if key in transcript
        },
        "session": {
            key: session.get(key)
            for key in ("id", "expertId", "personaExpertId", "executionPolicy", "run", "contextInfo")
            if key in session
        },
    }


if __name__ == "__main__":
    main()
