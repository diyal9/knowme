"""Browser geometry regression for the real reusable image preview components."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    results = []
    for width, height in [(1280, 820), (835, 680), (390, 650)]:
        page.set_viewport_size({"width": width, "height": height})
        page.goto("http://127.0.0.1:5184/test/image-preview.html")
        page.wait_for_load_state("networkidle")
        previews = page.locator('[data-testid="artifact-preview"]')
        assert previews.count() == 3
        assert page.locator('.km-artifact-preview-state').count() == 0
        bounds = [previews.nth(i).bounding_box() for i in range(3)]
        assert all(bounds[i + 1]["y"] >= bounds[i]["y"] + bounds[i]["height"] for i in range(2))
        for i in range(3):
            previews.nth(i).get_by_role("button").click()
            picture = page.locator('.wb-expert-image-dialog-body > img')
            picture.wait_for()
            picture.evaluate("img => img.decode()")
            geometry = picture.evaluate("""img => {
                const box = img.getBoundingClientRect();
                const stage = img.parentElement.getBoundingClientRect();
                const style = getComputedStyle(img);
                return {left: box.left, top: box.top, right: box.right, bottom: box.bottom,
                    stageLeft: stage.left, stageTop: stage.top, stageRight: stage.right, stageBottom: stage.bottom,
                    fit: style.objectFit, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight,
                    portal: img.closest('[role="dialog"]').parentElement.parentElement === document.body};
            }""")
            assert geometry["portal"] and geometry["fit"] == "contain"
            assert geometry["naturalWidth"] > 0 and geometry["naturalHeight"] > 0
            assert 0 <= geometry["left"] <= geometry["right"] <= width
            assert 0 <= geometry["top"] <= geometry["bottom"] <= height
            assert geometry["stageTop"] <= geometry["top"] < geometry["bottom"] <= geometry["stageBottom"]
            dialog = page.get_by_role('dialog').bounding_box()
            assert dialog['x'] >= 10 and dialog['y'] >= 10
            assert dialog['x'] + dialog['width'] <= width - 10
            assert dialog['y'] + dialog['height'] <= height - 10
            results.append({"viewport": [width, height], "image": i, "passed": True})
            if width == 835 and i == 1:
                page.screenshot(path=str(Path(__file__).resolve().parents[1] / '.playwright-mcp/image-preview-portrait.png'))
            page.get_by_role('button', name='关闭图片预览').click()
    print(json.dumps(results))
    browser.close()
