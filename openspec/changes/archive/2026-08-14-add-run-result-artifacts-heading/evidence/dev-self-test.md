# Dev self-test — add-run-result-artifacts-heading

Date: 2026-08-13

## Hard gates

- `npm test`：pass
- `npm run lint`：pass

## Code

- 结果页堆叠标题：`工作流` kicker + 工作流名主标题（16px/680）
- 产物次级小标题：`产物（N）`
- 右栏 `.wb-side-workflow-name` 改 `--wb-text`，字号对齐

## Manual

重启后打开已完成运行：确认顶部为「工作流 / 名称」层级，下列表上方有「产物（N）」。
