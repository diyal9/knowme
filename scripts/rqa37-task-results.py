import argparse
import json

from playwright.sync_api import sync_playwright


def main():
    parser = argparse.ArgumentParser(description="Read compact evidence for isolated KnowMe expert tasks")
    parser.add_argument("task_ids")
    parser.add_argument("--cdp", default="http://127.0.0.1:9223")
    args = parser.parse_args()
    task_ids = [value.strip() for value in args.task_ids.split(",") if value.strip()]

    with sync_playwright() as playwright:
        browser = playwright.chromium.connect_over_cdp(args.cdp)
        page = browser.contexts[0].pages[0]
        results = []
        for task_id in task_ids:
            results.append(page.evaluate(
                """async id => {
                    const taskResult = await window.api.expertTaskGet(id)
                    const task = taskResult?.task || null
                    const sessionId = task?.execRef?.id || ''
                    const transcript = sessionId ? await window.api.agentSessionTranscript(sessionId) : null
                    return {
                        taskId: id,
                        ok: taskResult?.ok,
                        status: task?.status,
                        resultSummary: task?.resultSummary || '',
                        attention: task?.attention || null,
                        assignmentSnapshot: task?.assignmentSnapshot || null,
                        deliverables: task?.deliverables || [],
                        executionEvidence: task?.executionEvidence || [],
                        transcript: transcript?.text || '',
                    }
                }""",
                task_id,
            ))
        print(json.dumps(results, ensure_ascii=False, indent=2))
        browser.close()


if __name__ == "__main__":
    main()
