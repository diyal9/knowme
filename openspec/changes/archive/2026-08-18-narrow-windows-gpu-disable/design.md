## Context

`boot.ts` 在所有 `win32` 上调用 `disable-gpu` / `disableHardwareAcceleration`。本机卡顿，RDP 白屏风险仍在。

## Goals / Non-Goals

- Goals：本机默认硬件加速；RDP / 显式开关保留软件路径；策略可单测。
- Non-Goals：不改 macOS/Linux；不引入设置页 UI；不自动探测白屏后降级。

## Decisions

1. **纯函数 `resolveWindowsGpuPolicy(env)`** 放 `src/lib/windows-gpu-policy.ts`，`boot.ts` 只应用开关。
2. **优先级**：`KNOWME_FORCE_GPU=1` > `KNOWME_DISABLE_GPU=1` > RDP 检测。
3. **RDP 附加**：仅在决定关 GPU 且判定为 RDP 时追加 `in-process-gpu` + `use-angle=swiftshader`。
4. **非 win32**：策略返回不禁用（boot 侧仍仅在 win32 分支调用）。

## Risks / Trade-offs

- 本机白屏回潮 → 文档化 `KNOWME_DISABLE_GPU=1`。
- `SESSIONNAME` 与实际会话偶发不一致 → 环境变量逃生舱覆盖。

## Migration Plan

无数据迁移。重启应用即生效。
