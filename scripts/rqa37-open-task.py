import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright


def main():
    parser = argparse.ArgumentParser(description="Open and inspect one isolated KnowMe expert task room")
    parser.add_argument("task_id")
    parser.add_argument("--cdp", default="http://127.0.0.1:9223")
    parser.add_argument("--screenshot", default="")
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
        page.get_by_test_id(f"task-open-{args.task_id}").click()
        page.wait_for_timeout(1200)
        screenshot = ""
        if args.screenshot:
            screenshot = str(Path(args.screenshot).resolve())
            page.screenshot(path=screenshot, full_page=False)
        controls = []
        locator = page.locator("button,input,textarea,[contenteditable=true]")
        for index in range(min(locator.count(), 160)):
            item = locator.nth(index)
            if not item.is_visible():
                continue
            controls.append({
                "tag": item.evaluate("element => element.tagName"),
                "text": item.inner_text()[:300],
                "placeholder": item.get_attribute("placeholder"),
                "testId": item.get_attribute("data-testid"),
                "ariaLabel": item.get_attribute("aria-label"),
                "disabled": item.is_disabled(),
            })
        print(json.dumps({
            "taskId": args.task_id,
            "url": page.url,
            "body": page.locator("body").inner_text()[:30000],
            "controls": controls,
            "screenshot": screenshot,
        }, ensure_ascii=False, indent=2))
        browser.close()


if __name__ == "__main__":
    main()
