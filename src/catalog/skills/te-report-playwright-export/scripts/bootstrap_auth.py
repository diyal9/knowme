#!/usr/bin/env python3
"""
一键引导：飞书 docs 授权 + TE BI 登录态保存。

Agent 在 Git Bash 中执行：
  bash scripts/bootstrap_auth.sh --initiate
  bash scripts/bootstrap_auth.sh --complete-feishu   # 用户完成飞书授权后
  bash scripts/bootstrap_auth.sh --te-login          # 仅 TE 浏览器登录

退出码:
  0  全部就绪
  10 TE 需登录（未执行 --te-login）
  11 TE 无 storage_state
  20 飞书授权已发起，待用户在浏览器完成
  21 飞书 scope 仍缺失
  22 未找到 lark-cli
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import webbrowser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lark_cli_util import find_lark_cli, run_lark_cli  # noqa: E402
from te_auth import (  # noqa: E402
    EXIT_LOGIN_REQUIRED,
    EXIT_NO_STORAGE_STATE,
    load_profile,
    probe_te_login,
    resolve_storage_state,
)
from te_cli_util import emit_json, log_login, sanitize_feishu_check  # noqa: E402

FEISHU_DOC_SCOPE = "docx:document:readonly"
EXIT_ALL_OK = 0
EXIT_FEISHU_PENDING = 20
EXIT_FEISHU_STILL_MISSING = 21
EXIT_LARK_CLI_MISSING = 22

DEFAULT_TE_PROBE = "https://bi.forevernine.net/#/tga/retention/2_86037?fromPanel=2_10790"
DEFAULT_BROWSER_CHANNEL = "chrome"


def memory_root_from_env() -> Path:
    try:
        hooks = Path(__file__).resolve().parents[3] / "hooks"
        sys.path.insert(0, str(hooks))
        import memory_paths as m  # type: ignore

        return m.memory_root()
    except Exception:
        local = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
        return Path(local) / "th-bi" / "memory"


def skill_memory_dir(memory_root: Path) -> Path:
    d = memory_root / "te-report-playwright-export"
    d.mkdir(parents=True, exist_ok=True)
    return d


def feishu_pending_path(memory_root: Path) -> Path:
    return skill_memory_dir(memory_root) / "feishu_auth_pending.json"


def storage_state_path(memory_root: Path) -> Path:
    return skill_memory_dir(memory_root) / "storage_state.json"


def check_feishu_scope() -> dict:
    if not find_lark_cli():
        return {"ok": False, "error": "lark_cli_not_found"}
    proc = run_lark_cli(["auth", "check", "--scope", FEISHU_DOC_SCOPE])
    try:
        data = json.loads(proc.stdout) if proc.stdout.strip() else {}
    except json.JSONDecodeError:
        data = {"ok": proc.returncode == 0, "raw": proc.stdout[:500]}
    data.setdefault("ok", proc.returncode == 0)
    return data


def initiate_feishu_auth(memory_root: Path, *, open_browser: bool) -> dict:
    proc = run_lark_cli(
        ["auth", "login", "--scope", FEISHU_DOC_SCOPE, "--no-wait", "--json"]
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr[:500] or proc.stdout[:500] or "飞书授权发起失败")
    data = json.loads(proc.stdout)
    pending = {
        "device_code": data.get("device_code"),
        "verification_url": data.get("verification_url"),
        "user_code": _user_code_from_url(data.get("verification_url", "")),
        "scope": FEISHU_DOC_SCOPE,
    }
    feishu_pending_path(memory_root).write_text(
        json.dumps(pending, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    if open_browser and pending.get("verification_url"):
        webbrowser.open(pending["verification_url"])
    # 可选二维码（lark-cli 要求相对路径，先 chdir）
    qr_path = skill_memory_dir(memory_root) / "feishu_auth_qr.png"
    try:
        import os

        prev = os.getcwd()
        os.chdir(skill_memory_dir(memory_root))
        run_lark_cli(
            [
                "auth",
                "qrcode",
                pending["verification_url"],
                "--output",
                "feishu_auth_qr.png",
            ]
        )
        os.chdir(prev)
        pending["qrcode_png"] = str(qr_path)
    except Exception:
        try:
            os.chdir(prev)
        except Exception:
            pass
    return pending


def _user_code_from_url(url: str) -> str:
    if "user_code=" in url:
        return url.split("user_code=", 1)[-1].split("&", 1)[0]
    return ""


def complete_feishu_auth(memory_root: Path, device_code: str | None) -> dict:
    pending_file = feishu_pending_path(memory_root)
    code = device_code
    if not code and pending_file.exists():
        code = json.loads(pending_file.read_text(encoding="utf-8")).get("device_code")
    if not code:
        raise RuntimeError("无 device_code，请先 --initiate")
    proc = run_lark_cli(["auth", "login", "--device-code", code], timeout=300)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr[:500] or proc.stdout[:500] or "飞书授权轮询失败")
    check = check_feishu_scope()
    if check.get("ok"):
        if pending_file.exists():
            pending_file.unlink()
    return check


def check_te(memory_root: Path, probe_url: str) -> dict:
    storage = resolve_storage_state(memory_root, load_profile(memory_root))
    if not storage:
        return {"logged_in": False, "reason": "no_storage_state", "storage_state": None}
    probe = probe_te_login(probe_url, storage)
    probe["storage_state"] = str(storage)
    return probe


def run_te_login(
    memory_root: Path,
    probe_url: str,
    *,
    wait_seconds: int = 600,
    browser_channel: str = DEFAULT_BROWSER_CHANNEL,
    connect_cdp: str | None = None,
) -> int:
    out = storage_state_path(memory_root)
    script = Path(__file__).resolve().parent / "save_te_storage_state.py"
    cmd = [
        sys.executable,
        str(script),
        "--url",
        "https://bi.forevernine.net/",
        "--probe-url",
        probe_url,
        "--output",
        str(out),
        "--wait-seconds",
        str(wait_seconds),
    ]
    if not connect_cdp:
        cmd.extend(["--browser-channel", browser_channel])
    if connect_cdp:
        cmd.extend(["--connect-cdp", connect_cdp])
    return subprocess.call(cmd)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="飞书授权 + TE 登录态引导")
    p.add_argument("--memory-root", type=Path, help="Agent memory 根；默认自动解析")
    p.add_argument("--probe-te-url", default=DEFAULT_TE_PROBE, help="TE 登录验证报表 URL")
    p.add_argument("--initiate", action="store_true", help="检测并发起缺失的授权（飞书 URL + TE 浏览器）")
    p.add_argument("--complete-feishu", action="store_true", help="飞书授权完成后轮询 device_code")
    p.add_argument("--device-code", help="覆盖 pending 中的 device_code")
    p.add_argument("--te-login", action="store_true", help="仅打开浏览器保存 TE storage_state")
    p.add_argument("--check-only", action="store_true", help="只检测，不发起授权")
    p.add_argument("--no-open-browser", action="store_true", help="不自动打开飞书授权页")
    p.add_argument("--skip-feishu", action="store_true")
    p.add_argument("--skip-te", action="store_true")
    p.add_argument(
        "--browser-channel",
        choices=["chrome", "msedge", "chromium"],
        default=DEFAULT_BROWSER_CHANNEL,
        help="TE 登录浏览器（默认本机 Chrome；msedge/chromium 可覆盖）",
    )
    p.add_argument(
        "--connect-cdp",
        metavar="URL",
        help="TE 登录连接已打开的本地浏览器，如 http://127.0.0.1:9222",
    )
    return p.parse_args()


def main() -> int:
    args = parse_args()
    mem = args.memory_root or memory_root_from_env()
    result: dict = {"memory_root": str(mem), "feishu": {}, "te": {}}
    feishu_ok = args.skip_feishu

    if not find_lark_cli() and not args.skip_feishu:
        emit_json({"ok": False, "error": "lark_cli_not_found", "hint": "npm install -g @larksuiteoapi/lark-cli"})
        return EXIT_LARK_CLI_MISSING

    if args.complete_feishu:
        try:
            result["feishu"] = complete_feishu_auth(mem, args.device_code)
        except Exception as e:
            emit_json({"ok": False, "feishu_error": str(e), "hint": "重新运行 bootstrap_auth.sh --initiate"})
            return EXIT_FEISHU_STILL_MISSING
        print(json.dumps({"ok": True, **result}, ensure_ascii=False))
        return EXIT_ALL_OK if result["feishu"].get("ok") else EXIT_FEISHU_STILL_MISSING

    if args.te_login and args.skip_feishu:
        pass  # 仅 TE，跳过飞书检测
    elif not args.skip_feishu:
        feishu = check_feishu_scope()
        result["feishu"] = sanitize_feishu_check(feishu)
        feishu_ok = bool(feishu.get("ok"))
        if not feishu_ok and not args.check_only and (args.initiate or args.te_login):
            pending = initiate_feishu_auth(mem, open_browser=not args.no_open_browser)
            result["feishu_pending"] = pending
            log_login("飞书授权：请在浏览器完成授权，然后运行 bootstrap_auth.sh --complete-feishu")
        elif not feishu_ok and args.check_only:
            print(json.dumps({"ok": False, **result}, ensure_ascii=False))
            return EXIT_FEISHU_PENDING

    if not args.skip_te:
        te = check_te(mem, args.probe_te_url)
        result["te"] = te
        if te.get("logged_in"):
            all_ok = feishu_ok
            print(json.dumps({"ok": all_ok, **result}, ensure_ascii=False))
            return EXIT_ALL_OK if all_ok else EXIT_FEISHU_PENDING
        if args.check_only:
            print(json.dumps({"ok": False, **result}, ensure_ascii=False))
            return (
                EXIT_NO_STORAGE_STATE
                if te.get("reason") == "no_storage_state"
                else EXIT_LOGIN_REQUIRED
            )
        if args.initiate or args.te_login:
            channel = args.browser_channel
            if args.connect_cdp:
                log_login("连接本地浏览器，请确认已登录 bi.forevernine.net…")
            else:
                log_login(f"正在打开本机 {channel}，请登录 bi.forevernine.net…")
            run_te_login(
                mem,
                args.probe_te_url,
                browser_channel=channel,
                connect_cdp=args.connect_cdp,
            )
            te = check_te(mem, args.probe_te_url)
            result["te"] = te

    te_ok = result.get("te", {}).get("logged_in", args.skip_te)
    all_ok = feishu_ok and te_ok
    print(json.dumps({"ok": all_ok, **result}, ensure_ascii=False))
    if all_ok:
        return EXIT_ALL_OK
    if not feishu_ok:
        return EXIT_FEISHU_PENDING
    if not te_ok:
        return (
            EXIT_NO_STORAGE_STATE
            if result.get("te", {}).get("reason") == "no_storage_state"
            else EXIT_LOGIN_REQUIRED
        )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
