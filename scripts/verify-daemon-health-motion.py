import json
from pathlib import Path

from playwright.sync_api import sync_playwright


css_path = Path(__file__).resolve().parents[1] / "src" / "renderer" / "features" / "run" / "console.css"

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(reduced_motion="reduce")
    page.set_content(
        '<span class="wb-daemon-compose-status is-live">'
        '<span class="wb-daemon-health-signal"><i></i><i></i><i></i><i></i></span>'
        '运行正常</span>'
    )
    page.add_style_tag(path=str(css_path))
    bar = page.locator(".wb-daemon-health-signal i").first

    def snapshot():
        return bar.evaluate(
            """element => {
              const style = getComputedStyle(element)
              return {
                animationName: style.animationName,
                animationDuration: style.animationDuration,
                animationIterationCount: style.animationIterationCount,
                animationPlayState: style.animationPlayState,
                transform: style.transform,
              }
            }"""
        )

    samples = [snapshot()]
    page.wait_for_timeout(180)
    samples.append(snapshot())
    page.wait_for_timeout(180)
    samples.append(snapshot())
    browser.close()

print(json.dumps(samples, ensure_ascii=False, indent=2))

if len({sample["transform"] for sample in samples}) < 2:
    raise SystemExit("health signal transform did not change")
