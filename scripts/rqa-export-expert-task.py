import argparse
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright


def artifact_refs(task):
    refs = []
    for deliverable in task.get("deliverables") or []:
        values = deliverable.get("artifactRefs") or [deliverable.get("artifactRef")]
        for value in values:
            ref = str(value or "").strip()
            if ref and ref not in refs:
                refs.append(ref)
    return refs


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("task_id")
    parser.add_argument("--out", required=True)
    parser.add_argument("--cdp", default="http://127.0.0.1:9223")
    args = parser.parse_args()

    with sync_playwright() as playwright:
        browser = playwright.chromium.connect_over_cdp(args.cdp)
        page = browser.contexts[0].pages[0]
        result = page.evaluate("async id => window.api.expertTaskGet(id)", args.task_id)
        task = (result or {}).get("task") or {}
        sessions = {}
        artifacts = {}
        for ref in artifact_refs(task):
            session_id, _, artifact_id = ref.partition("#")
            if not session_id or not artifact_id:
                continue
            session_result = page.evaluate("async id => window.api.agentSessionGet(id)", session_id)
            session = (session_result or {}).get("session") or session_result or {}
            sessions[session_id] = session
            for artifact in ((session.get("run") or {}).get("artifacts") or []):
                if artifact.get("id") == artifact_id:
                    artifacts[ref] = artifact
                    break
        execution_session_id = str(((task.get("execRef") or {}).get("id")) or "").strip()
        transcript = (
            page.evaluate("async id => window.api.agentSessionTranscript(id)", execution_session_id)
            if execution_session_id
            else None
        )
        payload = {
            "taskId": args.task_id,
            "task": task,
            "artifacts": artifacts,
            "sessions": sessions,
            "transcript": transcript,
        }
        output = Path(args.out)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({
            "event": "exported",
            "taskId": args.task_id,
            "status": task.get("status"),
            "artifacts": len(artifacts),
            "out": str(output),
        }, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
