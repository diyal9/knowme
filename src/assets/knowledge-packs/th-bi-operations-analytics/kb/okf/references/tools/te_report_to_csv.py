#!/usr/bin/env python3
"""
将 TE query_report_data 响应转为与 BI 页面「导出 CSV」相同格式的文件。

⚠️ 完整一致性（含 YYYY-MM月 行）无法仅靠 query_report_data 实现；
   见 kb/okf/references/te-report-csv-export.md（Playwright / 用户提供 CSV 等方案）。

用法:
  python te_report_to_csv.py \\
    --definition report_def.json \\
    --data report_data.json \\
    --output out.csv \\
    [--reference page_export.csv]   # 可选：对比校验

MCP 工作流（Agent）:
  1. get_report_definition(projectId, reportId)
  2. query_report_data(projectId, reportIds, startDate?, endDate?)
  3. 落盘 JSON 后调用本脚本；未来改调 export_report_csv 一步到位。
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path
from typing import Any

# 页面导出使用的留存节点（来自报表 uiCommonConfig.keyDateSets.T1，跳过次日等未展示列）
DEFAULT_EXPORT_DAY_NUMS = (0, 3, 7, 14, 21, 30, 60, 90, 120, 150, 180, 360)

DISPLAY_TO_EXPORT_BUCKET = {
    "总体": "总体",
    "1~7": "[1, 7)",
    "7~101": "[7, 101)",
    "101~501": "[101, 501)",
    "501~1501": "[501, 1501)",
    "1501~+∞": "[1501, +∞)",
}

METRIC_ORDER = ("留存人数", "留存率")
MONTH_LABEL_RE = re.compile(r"^\d{4}-\d{2}月$")


def day_num_to_title_label(day_num: int) -> str:
    return "当日" if day_num == 0 else f"{day_num}日"


def parse_export_day_nums(definition: dict[str, Any]) -> tuple[int, ...]:
    """从报表定义 uiCommonConfig 解析导出列（留存日序号）。"""
    event_view = definition.get("eventView") or {}
    ui_raw = event_view.get("uiCommonConfig")
    if not ui_raw:
        return DEFAULT_EXPORT_DAY_NUMS
    try:
        ui = json.loads(ui_raw) if isinstance(ui_raw, str) else ui_raw
    except json.JSONDecodeError:
        return DEFAULT_EXPORT_DAY_NUMS
    key_sets = (ui.get("retentionDisplaySet") or {}).get("keyDateSets") or {}
    t1 = key_sets.get("T1") or key_sets.get("t1")
    if not t1:
        return DEFAULT_EXPORT_DAY_NUMS
    nums: list[int] = []
    for part in str(t1).split(","):
        part = part.strip()
        if not part:
            continue
        try:
            nums.append(int(part))
        except ValueError:
            continue
    # 页面 CSV 不导出次日(1)、2日(2)；T1 含 1 但导出列从 当日→3日 起跳
    filtered = tuple(n for n in nums if n not in (1, 2))
    return filtered if filtered else DEFAULT_EXPORT_DAY_NUMS


def bucket_order(definition: dict[str, Any]) -> list[str]:
    """displayGroups 顺序 → 页面导出分组名（MCP 侧为 1~7 等）。"""
    event_view = definition.get("eventView") or {}
    groups = event_view.get("displayGroups") or []
    order: list[str] = []
    for g in groups:
        if not g.get("checked", "1") in ("1", 1, True):
            continue
        names = g.get("groups") or []
        if names:
            order.append(str(names[0]))
    return order or list(DISPLAY_TO_EXPORT_BUCKET.keys())


def build_header(title: list[str], export_day_nums: tuple[int, ...]) -> list[str]:
    """表头前 4 列固定为 title[0..3]，其后为导出留存列。"""
    base = title[:4] if len(title) >= 4 else ["初始事件的发生时间", "分组", "pay用户数", "指标"]
    day_labels = [day_num_to_title_label(n) for n in export_day_nums]
    return base + day_labels


def title_day_indices(title: list[str], export_day_nums: tuple[int, ...]) -> dict[int, int]:
    """留存日序号 → title 列下标。"""
    mapping: dict[int, int] = {}
    for n in export_day_nums:
        label = day_num_to_title_label(n)
        if label in title:
            mapping[n] = title.index(label)
    return mapping


def export_bucket(display_bucket: str) -> str:
    return DISPLAY_TO_EXPORT_BUCKET.get(display_bucket, display_bucket)


def row_key(time_label: str, bucket: str, metric: str) -> tuple[str, str, str]:
    return (time_label, export_bucket(bucket), metric)


def extract_rows_from_group(
    group: dict[str, Any],
    export_day_nums: tuple[int, ...],
) -> dict[tuple[str, str, str], list[Any]]:
    title = group.get("title") or []
    day_idx = title_day_indices(title, export_day_nums)
    table: dict[tuple[str, str, str], list[Any]] = {}

    for raw in group.get("rows") or []:
        if len(raw) < 4:
            continue
        time_label, bucket, pay_cnt, metric = raw[0], raw[1], raw[2], raw[3]
        if time_label != "阶段值" and not MONTH_LABEL_RE.match(str(time_label)):
            # 跳过分日行；页面导出为按月汇总
            continue
        key = row_key(str(time_label), str(bucket), str(metric))
        out = [
            time_label,
            export_bucket(str(bucket)),
            pay_cnt,
            metric,
        ]
        for n in export_day_nums:
            idx = day_idx.get(n)
            out.append(raw[idx] if idx is not None and idx < len(raw) else "-")
        table[key] = out
    return table


def assemble_csv_rows(
    definition: dict[str, Any],
    data_groups: list[dict[str, Any]],
    export_day_nums: tuple[int, ...],
) -> list[list[Any]]:
    title = (data_groups[0].get("title") if data_groups else None) or []
    header = build_header(title, export_day_nums)
    merged: dict[tuple[str, str, str], list[Any]] = {}
    for g in data_groups:
        merged.update(extract_rows_from_group(g, export_day_nums))

    buckets = bucket_order(definition)
    rows: list[list[Any]] = [header]

    def append_block(time_label: str) -> None:
        for b in buckets:
            for metric in METRIC_ORDER:
                key = row_key(time_label, b, metric)
                if key in merged:
                    rows.append(merged[key])

    append_block("阶段值")
    months = sorted({k[0] for k in merged if MONTH_LABEL_RE.match(k[0])})
    for m in months:
        append_block(m)
    return rows


def write_csv(path: Path, rows: list[list[Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f, quoting=csv.QUOTE_ALL)
        writer.writerows(rows)


def compare_csv(generated: Path, reference: Path) -> tuple[int, list[str]]:
    gen = list(csv.reader(generated.read_text(encoding="utf-8-sig").splitlines()))
    ref = list(csv.reader(reference.read_text(encoding="utf-8-sig").splitlines()))
    issues: list[str] = []
    if len(gen) != len(ref):
        issues.append(f"行数不一致: 生成 {len(gen)} vs 参考 {len(ref)}")
    for i, (g, r) in enumerate(zip(gen, ref)):
        if g != r:
            issues.append(f"第 {i + 1} 行不一致")
            if len(issues) >= 10:
                issues.append("…（更多差异已省略）")
                break
    return len(issues), issues


def convert(
    definition: dict[str, Any],
    data_payload: dict[str, Any],
) -> list[list[Any]]:
    if not data_payload.get("success", True):
        raise ValueError(data_payload.get("message") or "query_report_data 失败")
    groups = data_payload.get("data") or []
    if not groups:
        raise ValueError("query_report_data 返回空 data")
    export_day_nums = parse_export_day_nums(definition)
    return assemble_csv_rows(definition, groups, export_day_nums)


def main() -> int:
    parser = argparse.ArgumentParser(description="TE 报表数据 → 页面同款 CSV")
    parser.add_argument("--definition", required=True, type=Path, help="get_report_definition JSON")
    parser.add_argument("--data", required=True, type=Path, help="query_report_data JSON")
    parser.add_argument("--output", required=True, type=Path, help="输出 CSV 路径")
    parser.add_argument("--reference", type=Path, help="页面导出参考 CSV，用于校验")
    args = parser.parse_args()

    definition = json.loads(args.definition.read_text(encoding="utf-8"))
    if "data" in definition and "reportId" in (definition.get("data") or {}):
        definition = definition["data"]
    data_payload = json.loads(args.data.read_text(encoding="utf-8"))

    rows = convert(definition, data_payload)
    write_csv(args.output, rows)
    print(f"已写入 {args.output}（{len(rows)} 行）", file=sys.stderr)

    if args.reference:
        n_issues, issues = compare_csv(args.output, args.reference)
        if n_issues:
            print(f"与参考文件存在 {n_issues} 处差异:", file=sys.stderr)
            for line in issues:
                print(f"  - {line}", file=sys.stderr)
            return 2
        print("与参考 CSV 完全一致", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
