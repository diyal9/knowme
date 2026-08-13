## Context

管线 daemon 审阅右栏已有顶栏 `#wbRunBack`，「过程日志」在 `wb-daemon-review-foot`，「刷新 / 返回」又在 `#wbRunnerActions` 底栏，形成双返回与双底栏。

## Goals / Non-Goals

- Goals：底栏返回去掉；刷新与过程日志并排；无必要动作时隐藏底栏；过程日志按钮不再通栏。
- Non-Goals：不改 gate/clarify/restart 语义；不改左栏过程 feed。

## Decisions

1. 「刷新」静态放在 `wb-daemon-review-foot`，有 `run.slug` 时显示；点击仍走 `data-run-action="refresh-task"`。
2. `renderDaemonRunner` 不再向 `#wbRunnerActions` 注入 refresh/back；仅注入审批/澄清/重跑。
3. `#wbRunnerActions` 在空内容时 `hidden`，并用 CSS 去掉空态边框占位。
4. foot 改为横向 `flex`，按钮 `width:auto`，过程日志不再 `width:100%`。

## Risks / Trade-offs

- 用户习惯点底栏返回：顶栏仍有返回；可接受。
- 审批态仍会出现底栏：故意保留，避免动作埋在别处。
