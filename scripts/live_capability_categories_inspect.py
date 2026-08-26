"""Verify Capability Hub connector chips use business-domain categories."""

import json
from pathlib import Path

from playwright.sync_api import sync_playwright


REPO_ROOT = Path(__file__).resolve().parent.parent
SCREENSHOT = (
    REPO_ROOT
    / "openspec"
    / "changes"
    / "build-managed-connector-tool-platform"
    / "evidence"
    / "connector-business-categories.png"
)
EXPECTED = ["全部", "收藏", "办公协作", "视觉创作", "游戏研发", "通用连接"]


def visible_card_titles(hub) -> list[str]:
    return hub.locator("#hubGrid .hub-card-title").all_inner_texts()


def main() -> None:
    with sync_playwright() as playwright:
        browser = playwright.chromium.connect_over_cdp("http://127.0.0.1:9222")
        if not browser.contexts or not browser.contexts[0].pages:
            raise RuntimeError("未找到运行中的 KnowMe 页面")
        page = browser.contexts[0].pages[0]
        try:
            page.wait_for_load_state("networkidle", timeout=10_000)
        except Exception:
            # Vite HMR keeps a websocket open; the app-shell locator is the readiness check.
            pass
        page.locator("#appShell").wait_for(timeout=30_000)
        page.get_by_role("button", name="能力中心：Agent、Skill 与 MCP 连接器").click()
        hub = page.get_by_test_id("capability-hub-surface")
        hub.wait_for(state="visible", timeout=30_000)
        hub.get_by_role("tab", name="连接器").click()
        hub.get_by_role("searchbox", name="搜索能力").fill("")

        chips = hub.get_by_test_id("hub-chips").get_by_role("button").all_inner_texts()
        if chips != EXPECTED:
            raise AssertionError(f"连接器大类不匹配：{chips}")

        results = {}
        for category in ["办公协作", "视觉创作", "游戏研发", "通用连接"]:
            hub.get_by_role("button", name=category, exact=True).click()
            results[category] = visible_card_titles(hub)

        if "飞书" not in results["办公协作"]:
            raise AssertionError("飞书未归入办公协作")
        if "Photoshop MCP" not in results["视觉创作"]:
            raise AssertionError("Photoshop MCP 未归入视觉创作")
        if "Cocos Creator MCP" not in results["游戏研发"]:
            raise AssertionError("Cocos Creator MCP 未归入游戏研发")
        if not {"通用 MCP", "mcp-default"}.issubset(set(results["通用连接"])):
            raise AssertionError("通用 MCP 连接器未归入通用连接")

        hub.get_by_role("button", name="全部", exact=True).click()
        SCREENSHOT.parent.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(SCREENSHOT), full_page=True)
        print(json.dumps({"ok": True, "chips": chips, "groups": results, "screenshot": str(SCREENSHOT)}, ensure_ascii=False, indent=2))
        browser.close()


if __name__ == "__main__":
    main()
