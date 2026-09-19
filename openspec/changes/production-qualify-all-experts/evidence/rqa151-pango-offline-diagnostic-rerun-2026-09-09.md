# RQA151：Pango 离线异常诊断重放

日期：2026-09-09

## 场景

使用隔离 Electron 资格入口执行 `FIXTURE-IP01`，将 `pango-image-mcp` 指向不可连接的本地端口，验证生图连接器失败时是否直接停在用户可理解的待处理状态。

## 结果

- 任务状态：`needs_input`
- attention：`capability_unavailable`
- 用户标题：`需要启用任务能力`
- 失败详情：`fetch failed`
- 诊断项：`pango-image-mcp`、`generate_image`
- 图片成果物：`0`
- 伪造成功/文档替代结果：无
- 无关可选连接器 `photoshop-mcp`：不再出现在诊断项中

资格命令按预期以环境阻塞退出（`environmentBlocked=1`），这不是产品执行成功，也不是专业资格通过；它证明当前异常路径会直接停在真实能力不可用边界，并向用户保留可重试的任务状态。

## 修正

`preflightExpertTools` 现在只将当前路线的必需连接器和声明的 Provider Adapter 纳入失败诊断；绑定但未参与当前路线的可选连接器不会污染用户提示。
