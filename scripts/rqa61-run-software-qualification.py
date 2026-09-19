import argparse
import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright


TERMINAL = {"review", "needs_input", "failed", "cancelled", "completed"}


def wait_for_status(page, task_id, accepted, timeout_seconds):
    deadline = time.monotonic() + timeout_seconds
    last = None
    while time.monotonic() < deadline:
        result = page.evaluate("async id => window.api.expertTaskGet(id)", task_id)
        task = (result or {}).get("task") or {}
        status = str(task.get("status") or "")
        if status != last:
            print(json.dumps({"event": "status", "taskId": task_id, "status": status}, ensure_ascii=False), flush=True)
            last = status
        if status in accepted:
            return task
        if status in {"needs_input", "failed", "cancelled"} and status not in accepted:
            return task
        time.sleep(2)
    result = page.evaluate("async id => window.api.expertTaskGet(id)", task_id)
    return (result or {}).get("task") or {}


def create_task(page, case):
    return page.evaluate(
        """async item => window.api.expertTaskCreateStart({
          title: `[RQA61 ${item.id}] ${item.title}`,
          expertId: item.expertId,
          expertName: item.expertId,
          knowledgeRefs: [],
          brief: {
            goal: item.prompt,
            materials: [{ id: 'provided-context', type: 'text', title: '冻结验收题', content: item.prompt }],
            requiresMaterials: false,
            constraints: ['不得执行外部写入。', '不得调用工具。', '不得声称已运行测试。'],
            deliverables: [{ id: 'primary', title: '专业答复', type: 'answer', required: true }],
          },
        })""",
        case,
    )


def review(page, task_id, deliverable_id, action, comment):
    return page.evaluate(
        """async input => window.api.expertTaskReviewDeliverable(input)""",
        {"taskId": task_id, "deliverableId": deliverable_id, "action": action, "comment": comment},
    )


def compact(task):
    evidence_rows = task.get("executionEvidence") or []
    evidence = evidence_rows[-1] if isinstance(evidence_rows, list) and evidence_rows else (
        evidence_rows if isinstance(evidence_rows, dict) else {}
    )
    return {
        "id": task.get("id"),
        "status": task.get("status"),
        "resultSummary": task.get("resultSummary"),
        "deliverables": task.get("deliverables"),
        "events": task.get("events"),
        "configurationId": ((evidence.get("qualificationContext") or {}).get("configurationId")),
        "qualificationContext": evidence.get("qualificationContext"),
        "qualityGuardrail": evidence.get("qualityGuardrail"),
        "updatedAt": task.get("updatedAt"),
    }


def run_case(page, case, timeout_seconds):
    created = create_task(page, case)
    task = (created or {}).get("task") or {}
    task_id = task.get("id")
    row = {"evalId": case["id"], "scenario": case["scenario"], "lifecycle": case["lifecycle"], "create": created, "steps": []}
    if not (created or {}).get("ok") or not task_id:
        return row
    print(json.dumps({"event": "created", "evalId": case["id"], "taskId": task_id}, ensure_ascii=False), flush=True)

    if case["lifecycle"] == "cancel_then_retry":
        cancelled = page.evaluate("async id => window.api.expertTaskCancel(id)", task_id)
        row["steps"].append({"action": "cancel", "result": cancelled})
        retried = page.evaluate("async id => window.api.expertTaskRetry(id)", task_id)
        row["steps"].append({"action": "retry", "result": retried})

    task = wait_for_status(page, task_id, {"review"}, timeout_seconds)
    row["steps"].append({"action": "first_delivery", "task": compact(task)})
    deliverable_id = ((task.get("deliverables") or [{}])[0]).get("deliverableId") or "primary"

    if case["lifecycle"] == "request_changes" and task.get("status") == "review":
        revised = review(page, task_id, deliverable_id, "changes_requested", case["reviewComment"])
        row["steps"].append({"action": "changes_requested", "result": revised})
        task = wait_for_status(page, task_id, {"review"}, timeout_seconds)
        row["steps"].append({"action": "revised_delivery", "task": compact(task)})

    if case["lifecycle"] == "accept_then_reopen" and task.get("status") == "review":
        accepted = review(page, task_id, deliverable_id, "accept", "初次验收通过，用于验证完成后重开")
        row["steps"].append({"action": "accept", "result": accepted})
        reopened = review(page, task_id, deliverable_id, "changes_requested", case["reviewComment"])
        row["steps"].append({"action": "reopen", "result": reopened})
        task = wait_for_status(page, task_id, {"review"}, timeout_seconds)
        row["steps"].append({"action": "reopened_delivery", "task": compact(task)})

    row["final"] = compact(task)
    return row


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("evals")
    parser.add_argument("--out", required=True)
    parser.add_argument("--cdp", default="http://127.0.0.1:9223")
    parser.add_argument("--max-wait-seconds", type=int, default=180)
    parser.add_argument("--only", default="", help="Comma-separated eval IDs")
    args = parser.parse_args()
    suite = json.loads(Path(args.evals).read_text(encoding="utf-8"))
    if suite.get("status") != "frozen_before_execution":
        raise RuntimeError("Refusing to run a suite that was not frozen before execution")
    with sync_playwright() as playwright:
        browser = playwright.chromium.connect_over_cdp(args.cdp)
        contexts = browser.contexts
        if len(contexts) != 1 or len(contexts[0].pages) != 1:
            raise RuntimeError("Expected exactly one isolated KnowMe page")
        page = contexts[0].pages[0]
        page.wait_for_load_state("domcontentloaded")
        selected = {value.strip() for value in args.only.split(",") if value.strip()}
        cases = [case for case in suite.get("evals") or [] if not selected or case.get("id") in selected]
        missing = selected.difference(case.get("id") for case in cases)
        if missing:
            raise RuntimeError("Unknown eval IDs: " + ", ".join(sorted(missing)))
        results = [run_case(page, case, args.max_wait_seconds) for case in cases]
        payload = {"suite": suite.get("suite"), "executedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "results": results}
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({"event": "complete", "out": args.out, "tasks": [row.get("final", {}).get("id") for row in results]}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
