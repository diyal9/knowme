"""受控调用 lark-cli 的飞书填表适配器；stdout 只输出 JSON。"""
from __future__ import annotations

import argparse
import json
import subprocess
from typing import Any


READ_ACTIONS = {"sheet-info", "sheet-read", "sheet-dropdown", "base-field-list"}
WRITE_ACTIONS = {"sheet-append", "sheet-write", "base-record-create", "base-record-update"}


def json_value(raw: str, label: str) -> Any:
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"{label} 必须是合法 JSON: {exc.msg}") from exc


def require(value: str | None, label: str) -> str:
    text = str(value or "").strip()
    if not text:
        raise ValueError(f"缺少 {label}")
    return text


def build_command(args: argparse.Namespace) -> list[str]:
    action = args.action
    if action.startswith("sheet-"):
        command = ["lark-cli", "sheets", {
            "sheet-info": "+info",
            "sheet-read": "+read",
            "sheet-dropdown": "+get-dropdown",
            "sheet-append": "+append",
            "sheet-write": "+write",
        }[action], "--url", require(args.url, "--url")]
        if args.sheet_id:
            command += ["--sheet-id", args.sheet_id]
        if action in {"sheet-read", "sheet-dropdown", "sheet-write"}:
            command += ["--range", require(args.range, "--range")]
        if action in {"sheet-append", "sheet-write"}:
            values = json_value(require(args.values_json, "--values-json"), "--values-json")
            if not isinstance(values, list) or len(values) > 5000:
                raise ValueError("--values-json 必须是最多 5000 行的二维数组")
            command += ["--values", json.dumps(values, ensure_ascii=False, separators=(",", ":"))]
        return command

    command = [
        "lark-cli", "base", {
            "base-field-list": "+field-list",
            "base-record-create": "+record-create",
            "base-record-update": "+record-update",
        }[action],
        "--app-token", require(args.app_token, "--app-token"),
        "--table-id", require(args.table_id, "--table-id"),
    ]
    if action == "base-record-create":
        records = json_value(require(args.records_json, "--records-json"), "--records-json")
        if not isinstance(records, list) or len(records) > 1000:
            raise ValueError("--records-json 必须是最多 1000 条的数组")
        command += ["--records", json.dumps(records, ensure_ascii=False, separators=(",", ":"))]
    if action == "base-record-update":
        fields = json_value(require(args.fields_json, "--fields-json"), "--fields-json")
        if not isinstance(fields, dict):
            raise ValueError("--fields-json 必须是对象")
        command += ["--record-id", require(args.record_id, "--record-id"), "--fields", json.dumps(fields, ensure_ascii=False, separators=(",", ":"))]
    return command


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=sorted(READ_ACTIONS | WRITE_ACTIONS))
    parser.add_argument("--url")
    parser.add_argument("--sheet-id")
    parser.add_argument("--range")
    parser.add_argument("--values-json")
    parser.add_argument("--app-token")
    parser.add_argument("--table-id")
    parser.add_argument("--records-json")
    parser.add_argument("--record-id")
    parser.add_argument("--fields-json")
    args = parser.parse_args()

    try:
        completed = subprocess.run(build_command(args), capture_output=True, text=True, encoding="utf-8", timeout=120, check=False)
        stdout = completed.stdout.strip()
        try:
            data: Any = json.loads(stdout) if stdout else None
        except json.JSONDecodeError:
            data = stdout
        print(json.dumps({
            "ok": completed.returncode == 0,
            "action": args.action,
            "write": args.action in WRITE_ACTIONS,
            "exit_code": completed.returncode,
            "data": data,
            "stderr": completed.stderr.strip()[-4000:],
        }, ensure_ascii=False))
        return completed.returncode
    except (ValueError, FileNotFoundError, subprocess.TimeoutExpired) as exc:
        print(json.dumps({"ok": False, "action": args.action, "error": str(exc)}, ensure_ascii=False))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
