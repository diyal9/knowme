#!/usr/bin/env python3
"""Headless visual smoke test for the real expert-room renderer with an isolated API seam."""

import base64
import json
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parent.parent
EVIDENCE = ROOT / "openspec" / "changes" / "generalize-expert-agent-collaboration" / "evidence"
IMAGE_PATH = ROOT / "assets" / "brand-src" / "preview" / "fab-ink-final.png"


def init_script() -> str:
    image_url = "data:image/png;base64," + base64.b64encode(IMAGE_PATH.read_bytes()).decode("ascii")
    task = {
        "id": "task-expert-visual-smoke",
        "kind": "expert",
        "title": "运行态图片预览验收",
        "goal": "生成一张简洁、可用于桌面应用的机器人伙伴图标",
        "expertId": "image-producer",
        "expertName": "生图执行专家",
        "status": "review",
        "execRef": {"kind": "session", "id": "session-expert-visual-smoke"},
        "brief": {
            "goal": "生成一张简洁、可用于桌面应用的机器人伙伴图标",
            "plan": {
                "goal": "生成一张简洁、可用于桌面应用的机器人伙伴图标",
                "deliverables": ["机器人伙伴图标"],
                "acceptanceCriteria": ["缩略图完整显示", "可打开适配窗口的大图"],
                "steps": ["确认方向", "生成图像", "交付验收"],
            },
            "deliverables": [{"id": "generated-image", "title": "生成图片", "type": "image", "required": True}],
            "materials": [],
            "constraints": [],
        },
        "assignmentSnapshot": {"bindings": {"skills": ["th-art-prompt-enrich"], "connectors": ["pango-image-mcp"]}},
        "events": [
            {"id": "event-started", "type": "task_started", "summary": "已确认视觉方向，开始执行。", "createdAt": "2026-09-05T06:00:00.000Z"},
            {"id": "event-ready", "type": "deliverable_ready", "summary": "图片已生成，等待验收。", "createdAt": "2026-09-05T06:00:02.000Z"},
        ],
        "deliverables": [{
            "deliverableId": "generated-image",
            "title": "机器人伙伴图标",
            "type": "image",
            "version": 1,
            "artifactRef": "session-expert-visual-smoke#robot-preview",
            "artifactRefs": ["session-expert-visual-smoke#robot-preview"],
            "acceptanceStatus": "pending",
            "evidenceStatus": "verified",
            "comments": [],
        }],
        "executionEvidence": [],
        "resultSummary": "已生成机器人伙伴图标，等待验收。",
        "createdAt": "2026-09-05T06:00:00.000Z",
        "updatedAt": "2026-09-05T06:00:02.000Z",
    }
    session = {
        "id": "session-expert-visual-smoke",
        "agentId": "general",
        "expertId": "image-producer",
        "messages": [
            {"id": "msg-plan", "role": "assistant", "text": "我会采用干净的深色轮廓和高辨识度构图，生成完成后直接给你预览。", "createdAt": "2026-09-05T06:00:01.000Z"},
            {"id": "msg-result", "role": "assistant", "text": "图片已经生成。你可以打开大图查看，也可以直接在下方输入修改意见。", "createdAt": "2026-09-05T06:00:02.000Z"},
        ],
        "run": {
            "goal": task["goal"], "role": "general", "status": "completed", "toolsUsed": ["generate_image"],
            "steps": [], "applyLog": [],
            "artifacts": [{
                "id": "robot-preview", "type": "text", "title": "机器人伙伴图标",
                "body": "已按确认的视觉方向生成首版图标。", "status": "draft",
                "targetPath": image_url, "meta": {"mimeType": "image/png", "artifactType": "image"},
            }],
        },
    }
    expert = {
        "id": "image-producer", "kind": "expert", "name": "生图执行专家",
        "description": "按已确认的视觉方案生成并迭代图像。", "installed": True, "enabled": True,
        "source": "installed", "bindings": {"skills": ["th-art-prompt-enrich"], "connectors": ["pango-image-mcp"]},
    }
    payload = json.dumps({"task": task, "session": session, "expert": expert}, ensure_ascii=False)
    return f"""
      (() => {{
        const data = {payload};
        const handlers = {{
          workbenchLoad: async () => ({{ workflows: [], workflowPackages: [], daemon: {{ online: true }} }}),
          workbenchModeList: async () => ({{ ok: true, modes: [], activeModeId: '' }}),
          workbenchTaskList: async () => ({{ ok: true, items: [data.task] }}),
          workbenchTaskGet: async () => ({{ ok: true, task: data.task }}),
          expertTaskList: async () => ({{ ok: true, items: [data.task] }}),
          expertTaskGet: async () => ({{ ok: true, task: data.task }}),
          agentSessionGet: async () => ({{ ok: true, session: data.session }}),
          agentSessionList: async () => ({{ items: [data.session] }}),
          capabilityList: async () => ({{ ok: true, items: [data.expert] }}),
          expertGet: async () => ({{ ok: true, expert: data.expert }}),
          knowledgeProviderList: async () => ({{ ok: true, providers: [] }}),
          workbenchAutomationList: async () => ({{ ok: true, jobs: [], templates: [] }}),
          getSettings: () => ({{}}),
          llmProfile: async () => ({{}}),
          llmModels: async () => ({{ presets: [] }}),
          sourcesList: async () => ({{ sources: [], activeSourceId: null }}),
          knowledgeOsList: async () => ({{ ok: true, wiki: [], okf: [] }}),
          memoryOverview: async () => ({{ patterns: [], recent: [], stats: {{}} }}),
          onAiStreamChunk: () => () => undefined,
          onAiStreamEvent: () => () => undefined,
          onWorkbenchTaskScheduleDue: () => () => undefined,
          onWorkbenchAuthChanged: () => () => undefined,
          onWorkspaceOpenSettings: () => () => undefined,
        }};
        window.api = new Proxy(handlers, {{
          get(target, property) {{
            if (property in target) return target[property];
            if (String(property).startsWith('on')) return () => () => undefined;
            return async () => ({{ ok: true, items: [], tasks: [], modes: [], workflows: [] }});
          }},
        }});
      }})();
    """


def main() -> None:
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    console_errors = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1600, "height": 1000}, device_scale_factor=1)
        page.add_init_script(script=init_script())
        page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
        page.goto("http://127.0.0.1:5173/workspace/", wait_until="networkidle")
        page.get_by_text("工作台", exact=True).first.click()
        page.get_by_text("运行态图片预览验收", exact=True).first.click()
        page.get_by_test_id("expert-room").wait_for()
        page.get_by_test_id("artifact-preview").wait_for()
        page.screenshot(path=str(EVIDENCE / "expert-room-runtime.png"), full_page=True)

        preview = page.get_by_role("button", name="查看机器人伙伴图标原图")
        thumb = preview.locator("img")
        result = {
            "ok": True,
            "expertRoomVisible": page.get_by_test_id("expert-room").is_visible(),
            "composerCount": page.locator("#agentInput").count(),
            "nestedReviewInputCount": page.locator(".wb-deliverable-review textarea, .wb-deliverable-review input").count(),
            "primaryStatusCount": page.get_by_test_id("expert-primary-status").count(),
            "imagePreviewCount": page.locator('[data-artifact-kind="image"]').count(),
            "thumbnail": thumb.evaluate("el => ({ naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight, objectFit: getComputedStyle(el).objectFit })"),
            "dialog": None,
            "consoleErrors": console_errors,
        }
        preview.click()
        dialog = page.get_by_role("dialog")
        dialog.wait_for()
        dialog_image = dialog.locator("img").first
        result["dialog"] = dialog_image.evaluate(
            "el => ({ naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight, objectFit: getComputedStyle(el).objectFit, clientWidth: el.clientWidth, clientHeight: el.clientHeight })"
        )
        page.screenshot(path=str(EVIDENCE / "expert-room-runtime-dialog.png"), full_page=True)
        browser.close()

    (EVIDENCE / "expert-room-runtime.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
