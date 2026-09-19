import argparse
import json

from playwright.sync_api import sync_playwright


def element_snapshot(page):
    rows = []
    locator = page.locator("button,input,textarea,a,[role=button]")
    for index in range(min(locator.count(), 240)):
        item = locator.nth(index)
        tag = item.evaluate("element => element.tagName")
        rows.append({
            "index": index,
            "tag": tag,
            "text": item.inner_text() if tag not in ("INPUT", "TEXTAREA") else "",
            "placeholder": item.get_attribute("placeholder"),
            "ariaLabel": item.get_attribute("aria-label"),
            "testId": item.get_attribute("data-testid"),
            "disabled": item.is_disabled(),
            "visible": item.is_visible(),
        })
    return rows


def main():
    parser = argparse.ArgumentParser(description="Inspect or run RQA37 against an existing isolated KnowMe renderer.")
    parser.add_argument("--cdp", default="http://127.0.0.1:9223")
    parser.add_argument("--inspect", action="store_true")
    parser.add_argument("--workspace", action="store_true")
    parser.add_argument("--globals", action="store_true")
    parser.add_argument("--settings", action="store_true")
    parser.add_argument("--snapshots", default="")
    parser.add_argument("--update", default="")
    args = parser.parse_args()

    with sync_playwright() as playwright:
        browser = playwright.chromium.connect_over_cdp(args.cdp)
        contexts = browser.contexts
        if len(contexts) != 1 or len(contexts[0].pages) != 1:
            raise RuntimeError("Expected exactly one isolated KnowMe page")
        page = contexts[0].pages[0]
        page.wait_for_load_state("domcontentloaded")
        if args.update:
            results = []
            for capability_id in [value.strip() for value in args.update.split(",") if value.strip()]:
                result = page.evaluate("""async id => {
                    const value = await window.api.capabilityUpdate({ id, riskConfirmed: true })
                    return { id, value }
                }""", capability_id)
                results.append(result)
            print(json.dumps(results, ensure_ascii=False, indent=2))
        if args.snapshots:
            rows = []
            for expert_id in [value.strip() for value in args.snapshots.split(",") if value.strip()]:
                result = page.evaluate("""async expertId => {
                    const sessionId = `rqa37-probe-${expertId}`
                    const value = await window.api.expertSnapshot({ sessionId, expertId })
                    const snapshot = value?.snapshot || {}
                    return {
                        ok: value?.ok,
                        code: value?.code,
                        message: value?.message,
                        expertId,
                        version: snapshot?.capabilityManifest?.version || snapshot?.persona?.version,
                        skills: snapshot?.bindings?.skills || [],
                        hashes: snapshot?.hashes || {},
                        issues: value?.issues || [],
                    }
                }""", expert_id)
                rows.append(result)
            print(json.dumps(rows, ensure_ascii=False, indent=2))
        if args.globals:
            print(json.dumps(page.evaluate("""() => {
                const windowKeys = Object.keys(window).filter(key => /expert|workbench|capab|electron|api/i.test(key)).sort()
                const apiCandidates = ['electronAPI', 'api', 'knowme', 'desktopAPI']
                const APIs = {}
                for (const name of apiCandidates) {
                    const value = window[name]
                    if (value && typeof value === 'object') APIs[name] = Object.keys(value).sort()
                }
                return { windowKeys, APIs }
            }"""), ensure_ascii=False, indent=2))
        if args.settings:
            print(json.dumps(page.evaluate("""() => {
                const settings = window.api.getSettings()
                return {
                    apiEndpoint: settings?.apiEndpoint || '',
                    model: settings?.model || '',
                    llmProvider: settings?.llmProvider || '',
                    apiKeyConfigured: settings?.apiKeyConfigured === true,
                    hasApiKey: Boolean(settings?.apiKey),
                }
            }"""), ensure_ascii=False, indent=2))
        if args.workspace:
            close = page.get_by_role("button", name="关闭")
            if close.count() and close.first.is_visible():
                close.first.click()
            page.get_by_role("button", name="工作台", exact=True).click()
            page.wait_for_timeout(800)
            print(json.dumps({
                "url": page.url,
                "body": page.locator("body").inner_text()[:30000],
                "elements": element_snapshot(page),
            }, ensure_ascii=False, indent=2))
        if args.inspect:
            print(json.dumps({
                "title": page.title(),
                "url": page.url,
                "body": page.locator("body").inner_text()[:30000],
                "elements": element_snapshot(page),
            }, ensure_ascii=False, indent=2))
        browser.close()


if __name__ == "__main__":
    main()
