import argparse
import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright


TERMINAL = {"review", "needs_input", "failed", "cancelled", "completed"}


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("task_id")
    parser.add_argument("--out", required=True)
    parser.add_argument("--cdp", default="http://127.0.0.1:9223")
    parser.add_argument("--max-wait-seconds", type=int, default=180)
    args = parser.parse_args()

    with sync_playwright() as playwright:
        browser = playwright.chromium.connect_over_cdp(args.cdp)
        page = browser.contexts[0].pages[0]
        before = page.evaluate("async id => window.api.expertTaskGet(id)", args.task_id)
        result = page.evaluate("async id => window.api.expertTaskRetry(id)", args.task_id)
        print(json.dumps({"event": "retry", "taskId": args.task_id, "ok": result.get("ok"), "started": result.get("started"), "error": result.get("error")}, ensure_ascii=False), flush=True)
        deadline = time.monotonic() + args.max_wait_seconds
        last_status = None
        task = (result or {}).get("task") or {}
        while time.monotonic() < deadline:
            current = page.evaluate("async id => window.api.expertTaskGet(id)", args.task_id)
            task = (current or {}).get("task") or task
            status = str(task.get("status") or "")
            if status != last_status:
                print(json.dumps({"event": "status", "taskId": args.task_id, "status": status}, ensure_ascii=False), flush=True)
                last_status = status
            if status in TERMINAL:
                break
            time.sleep(2)
        session_id = ((task.get("execRef") or {}).get("id"))
        transcript = page.evaluate("async id => window.api.agentSessionTranscript(id)", session_id) if session_id else None
        payload = {
            "taskId": args.task_id,
            "before": (before or {}).get("task"),
            "retry": result,
            "after": task,
            "transcript": transcript,
        }
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        evidence = task.get("executionEvidence") or []
        last_evidence = evidence[-1] if evidence else {}
        print(json.dumps({
            "event": "complete",
            "taskId": args.task_id,
            "status": task.get("status"),
            "configurationId": ((last_evidence.get("qualificationContext") or {}).get("configurationId")),
            "out": args.out,
        }, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
