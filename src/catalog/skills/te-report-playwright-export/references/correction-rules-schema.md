```yaml
version: 1
rules:
  - id: export-wait-ms
    summary: 报表加载后多等 8 秒再开始找导出按钮
    apply:
      type: post_load_wait_ms
      value: 8000
  - id: export-button-poll
    summary: 轮询等待导出按钮最长 90 秒
    apply:
      type: export_button_wait_ms
      value: 90000
  - id: export-poll-interval
    summary: 每 2 秒检查一次导出按钮
    apply:
      type: poll_ms
      value: 2000
  - id: network-idle-ms
    summary: networkidle 最长等待 60 秒（保证报表请求基本完成）
    apply:
      type: network_idle_ms
      value: 60000
```

`te_export_core.py` / `export_te_report_csv.py` / `batch_export_te_report_csv.py` 读取上述规则；CLI `--post-load-wait-ms` 等可覆盖。
