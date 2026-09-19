import argparse
import json
import time

from playwright.sync_api import sync_playwright


def main():
    parser = argparse.ArgumentParser(description="Submit revision feedback through an isolated KnowMe expert-room UI")
    parser.add_argument("task_id")
    parser.add_argument("feedback")
    parser.add_argument("--cdp", default="http://127.0.0.1:9223")
    parser.add_argument("--max-wait-seconds", type=int, default=150)
    args = parser.parse_args()

    with sync_playwright() as playwright:
        browser = playwright.chromium.connect_over_cdp(args.cdp)
        page = browser.contexts[0].pages[0]
        page.get_by_role("button", name="工作台", exact=True).click()
        page.wait_for_timeout(500)
        target = page.get_by_test_id(f"task-open-{args.task_id}")
        if not target.count():
            toggle = page.get_by_test_id("wbTaskInboxToggle")
            if toggle.count() and toggle.is_visible():
                toggle.click()
                page.wait_for_timeout(500)
        target = page.get_by_test_id(f"task-open-{args.task_id}")
        if not target.count():
            raise RuntimeError(f"Target expert task is not visible: {args.task_id}")
        target.click()
        page.wait_for_timeout(1000)

        before = page.evaluate("async id => await window.api.expertTaskGet(id)", args.task_id)
        before_task = before.get("task") if isinstance(before, dict) else None
        baseline_version = max(
            [int(item.get("version") or 0) for item in ((before_task or {}).get("deliverables") or [])],
            default=0,
        )
        baseline_updated_at = str((before_task or {}).get("updatedAt") or "")
        if not page.locator("textarea").count():
            raise RuntimeError("Expert-room textarea is not visible")
        textarea = page.locator("textarea").first
        textarea.fill(args.feedback)
        page.get_by_role("button", name="发送").click()
        print(json.dumps({"event": "feedback_sent", "taskId": args.task_id}, ensure_ascii=False), flush=True)

        deadline = time.monotonic() + args.max_wait_seconds
        last_status = None
        task = None
        saw_change = False
        while time.monotonic() < deadline:
            result = page.evaluate("async id => await window.api.expertTaskGet(id)", args.task_id)
            task = result.get("task") if isinstance(result, dict) else None
            status = str((task or {}).get("status") or "")
            if status != last_status:
                print(json.dumps({"event": "status", "status": status}, ensure_ascii=False), flush=True)
                last_status = status
            version = max(
                [int(item.get("version") or 0) for item in ((task or {}).get("deliverables") or [])],
                default=0,
            )
            updated_at = str((task or {}).get("updatedAt") or "")
            saw_change = saw_change or status not in {"review", "needs_input", "failed", "cancelled", "completed"} \
                or updated_at != baseline_updated_at
            if version > baseline_version and status in {"review", "completed"}:
                break
            if saw_change and status in {"needs_input", "failed", "cancelled"}:
                break
            time.sleep(2)

        page.wait_for_timeout(500)
        print("RQA37_REVISION=" + json.dumps({
            "taskId": args.task_id,
            "status": (task or {}).get("status"),
            "deliverables": (task or {}).get("deliverables") or [],
            "executionEvidence": (task or {}).get("executionEvidence") or [],
            "resultSummary": (task or {}).get("resultSummary") or "",
            "feedbackVisible": args.feedback in page.locator("body").inner_text(),
            "textareaCount": page.locator("textarea").count(),
            "bodyTail": page.locator("body").inner_text()[-8000:],
        }, ensure_ascii=False), flush=True)
        browser.close()


if __name__ == "__main__":
    main()
