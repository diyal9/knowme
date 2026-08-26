"""Inspect the running KnowMe Capability Hub through its local Electron CDP port."""

import json
from pathlib import Path

from playwright.sync_api import sync_playwright


REPO_ROOT = Path(__file__).resolve().parent.parent
EVIDENCE_DIR = REPO_ROOT / "openspec" / "changes" / "build-managed-connector-tool-platform" / "evidence"


def probe_connector(page, name: str, screenshot_name: str) -> dict:
    hub = page.get_by_test_id("capability-hub-surface")
    search = hub.get_by_role("searchbox", name="搜索能力")
    search.fill(name)
    hub.get_by_role("button", name=f"管理连接器：{name}").click()

    drawer = page.get_by_test_id("hub-detail-drawer")
    manager = drawer.get_by_test_id("hub-connector-manager")
    manager.wait_for(state="visible", timeout=20_000)

    manager.get_by_role("button", name="测试连接").click()
    status = manager.get_by_role("status")
    status.filter(has_text="MCP 在线").wait_for(timeout=45_000)
    online = status.inner_text()

    manager.get_by_role("button", name="发现工具").click()
    status.filter(has_text="已发现").wait_for(timeout=45_000)
    discovered = status.inner_text()
    selected = manager.get_by_role("checkbox").count()

    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    screenshot = EVIDENCE_DIR / screenshot_name
    page.screenshot(path=str(screenshot), full_page=True)
    drawer.get_by_role("button", name="关闭详情").click()
    drawer.wait_for(state="hidden")
    return {
        "online": online,
        "discovered": discovered,
        "visibleTools": selected,
        "screenshot": str(screenshot),
    }


def main() -> None:
    with sync_playwright() as playwright:
        browser = playwright.chromium.connect_over_cdp("http://127.0.0.1:9222")
        contexts = browser.contexts
        if not contexts or not contexts[0].pages:
            raise RuntimeError("未找到运行中的 KnowMe 页面")
        page = contexts[0].pages[0]
        try:
            page.wait_for_load_state("networkidle", timeout=10_000)
        except Exception:
            # Vite keeps an HMR websocket open; the UI locator below is the readiness source of truth.
            pass
        page.locator("#appShell").wait_for(timeout=30_000)
        page.get_by_role("button", name="能力中心：Agent、Skill 与 MCP 连接器").click()
        hub = page.get_by_test_id("capability-hub-surface")
        hub.wait_for(state="visible", timeout=30_000)
        hub.get_by_role("tab", name="连接器").click()

        result = {
            "ok": True,
            "photoshop": probe_connector(page, "Photoshop MCP", "live-photoshop-connector.png"),
            "creator": probe_connector(page, "Cocos Creator MCP", "live-cocos-connector.png"),
        }
        print(json.dumps(result, ensure_ascii=False, indent=2))
        browser.close()


if __name__ == "__main__":
    main()
