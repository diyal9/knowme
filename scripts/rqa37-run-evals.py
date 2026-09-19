import argparse
import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright


TERMINAL_STATUSES = {"review", "needs_input", "failed", "cancelled", "completed"}


def install_context_trace(page):
    page.evaluate(
        """() => {
            if (window.__rqaContextUnsubscribe) return
            window.__rqaContextTrace = []
            window.__rqaContextUnsubscribe = window.api.onAiStreamEvent(event => {
                const payload = event?.payload && typeof event.payload === 'object' ? event.payload : event
                const info = payload?.contextInfo
                const manifest = info?.contextManifest
                if (!manifest) return
                window.__rqaContextTrace.push({
                    runId: String(payload?.runId || event?.runId || ''),
                    scene: String(manifest.scene || ''),
                    phase: String(manifest.phase || ''),
                    identity: String(manifest.identity || ''),
                    estimatedTokens: Number(manifest.estimatedTokens || 0),
                    included: (manifest.included || []).map(item => ({
                        id: String(item.id || ''),
                        kind: String(item.kind || ''),
                        usedTokens: Number(item.usedTokens || 0),
                        truncated: item.truncated === true,
                    })),
                    omitted: (manifest.omitted || []).map(item => ({
                        id: String(item.id || ''),
                        reason: String(item.reason || ''),
                    })),
                })
            })
        }"""
    )


def load_eval_cases(path):
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if payload.get("status") != "frozen_before_execution":
        raise RuntimeError("Refusing to run an eval set that was not frozen before execution")
    cases = payload.get("evals") or []
    if not cases:
        raise RuntimeError("No eval cases found")
    return cases


def create_task(page, case):
    return page.evaluate(
        """async ({ item }) => window.api.expertTaskCreateStart({
            title: `[RQA37 ${item.id}] ${item.title}`,
            expertId: item.expertId,
            expertName: item.expertId,
            knowledgeRefs: [],
            brief: {
                goal: item.prompt,
                materials: [{
                    id: 'provided-context',
                    type: 'text',
                    title: '用户提供的材料',
                    content: item.prompt,
                }],
                requiresMaterials: false,
                constraints: Array.isArray(item.constraints) && item.constraints.length
                    ? item.constraints
                    : ['不得执行外部写入。'],
                deliverables: [{
                    id: 'primary',
                    title: '专业答复',
                    type: 'answer',
                    required: true,
                }],
            },
        })""",
        {"item": case},
    )


def task_probe(page, task_id):
    return page.evaluate(
        """async id => {
            const result = await window.api.expertTaskGet(id)
            const task = result?.task || null
            return {
                ok: result?.ok,
                error: result?.error || result?.message || null,
                task,
            }
        }""",
        task_id,
    )


def transcript_probe(page, session_id):
    if not session_id:
        return None
    return page.evaluate(
        """async id => {
            try {
                return await window.api.agentSessionTranscript(id)
            } catch (error) {
                return { ok: false, error: String(error?.message || error) }
            }
        }""",
        session_id,
    )


def run_case(page, case, max_wait_seconds):
    page.evaluate("window.__rqaContextTrace = []")
    created = create_task(page, case)
    task = created.get("task") if isinstance(created, dict) else None
    task_id = (task or {}).get("id")
    if not created.get("ok") or not task_id:
        return {"case": case, "create": created, "task": task, "transcript": None}

    print(json.dumps({"event": "created", "evalId": case["id"], "taskId": task_id}, ensure_ascii=False), flush=True)
    deadline = time.monotonic() + max_wait_seconds
    last_status = None
    probe = {"task": task}
    while time.monotonic() < deadline:
        probe = task_probe(page, task_id)
        task = probe.get("task") or task
        status = str((task or {}).get("status") or "")
        if status != last_status:
            print(json.dumps({"event": "status", "evalId": case["id"], "taskId": task_id, "status": status}, ensure_ascii=False), flush=True)
            last_status = status
        if status in TERMINAL_STATUSES:
            break
        time.sleep(2)

    session_id = ((task or {}).get("execRef") or {}).get("id")
    context_trace = page.evaluate("window.__rqaContextTrace || []")
    return {
        "case": case,
        "create": {
            "ok": created.get("ok"),
            "error": created.get("error") or created.get("message"),
        },
        "task": task,
        "transcript": transcript_probe(page, session_id),
        "contextTrace": context_trace,
        "timedOut": str((task or {}).get("status") or "") not in TERMINAL_STATUSES,
    }


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Run frozen RQA37 holdouts in an existing isolated KnowMe renderer")
    parser.add_argument("evals")
    parser.add_argument("--cdp", default="http://127.0.0.1:9223")
    parser.add_argument("--max-wait-seconds", type=int, default=150)
    parser.add_argument("--only", default="", help="Comma-separated eval IDs to run")
    args = parser.parse_args()

    cases = load_eval_cases(args.evals)
    selected = {value.strip() for value in args.only.split(",") if value.strip()}
    if selected:
        cases = [case for case in cases if case.get("id") in selected]
        missing = selected.difference(case.get("id") for case in cases)
        if missing:
            raise RuntimeError(f"Unknown eval IDs: {', '.join(sorted(missing))}")
    with sync_playwright() as playwright:
        browser = playwright.chromium.connect_over_cdp(args.cdp)
        contexts = browser.contexts
        if len(contexts) != 1 or len(contexts[0].pages) != 1:
            raise RuntimeError("Expected exactly one isolated KnowMe page")
        page = contexts[0].pages[0]
        page.wait_for_load_state("domcontentloaded")
        install_context_trace(page)
        results = [run_case(page, case, args.max_wait_seconds) for case in cases]
        print("RQA37_RESULT=" + json.dumps(results, ensure_ascii=False), flush=True)
        browser.close()


if __name__ == "__main__":
    main()
