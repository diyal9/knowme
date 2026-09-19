# RQA188：隔离批量复核与历史授权边界

日期：2026-09-10

## 结论

用户在 KnowMe 正常桌面运行中测试过的 Feishu/Pango 授权，不会自动出现在隔离资格批量的 QA `userData` 中。批量测试使用独立目录，生产配置只允许受控复制非敏感配置和加密字段；当前执行身份无法读取原桌面进程的系统安全存储，因此实时探针不能把“未读到凭据”解释成“从未授权”。

## 历史运行证据

从 `%APPDATA%\KnowMe\agent-runs\*/events.jsonl` 和完成运行的 `checkpoints/latest.json` 脱敏账本读取，不读取或输出令牌、密钥及工具参数：

| 连接器 | 完成运行 | 成功调用 | 失败调用 | 成功工具 |
| --- | ---: | ---: | ---: | --- |
| Feishu | 4 | 7 | 0 | `feishu.meeting_candidates`、`feishu.meeting_read`、`feishu.today_priority` |
| Pango | 4 | 7 | 3 | `generate_image`、`list_paint_models` |

这证明历史运行确实曾在已授权上下文调用过两类连接器，但 Pango 历史上同时存在 `generate_image` 失败，不能直接推导为当前连接器健康或生图质量合格。

## 隔离批量复核

- 范围：6 位保留专家、10 个来源套件、51 个案例。
- 完整覆盖：10/10 套件、51/51 案例均生成独立报告。
- 结果：41 个环境阻塞、4 个真实执行失败；没有把环境阻塞或历史成功升级成专业资格。
- 修复：`expert-qualification-live` 现在先按矩阵传入的案例 ID 筛选，再校验选中案例；混有旧格式案例的来源套件不再因未选中的历史案例阻断当前复核。

## 验证门禁

- `npm run check`：后端 `3518/3569` 通过、`51` 跳过、`0` 失败。
- Renderer：`633/633` 通过。
- lint、typecheck：通过。
- 批量报告：`qualification/rqa189-batch-live-20260910/qualification-batch-report.json`。

## 后续处理

要完成真实生产资格，必须在正常 KnowMe Electron 桌面进程中读取当前连接器授权并取得真实回执；或者由用户在该桌面进程中重新扫描授权后，再运行同一套资格案例。隔离批量仍用于发现编排、生命周期、错误闭环和 UI 回归，不应承担跨进程恢复系统密钥的职责。
