## Why

KnowMe 曾在 Windows 无条件关 GPU，后改为依赖环境变量，仍需用户手工配置。应**自动判断**远程/崩溃并降级，同时对 UI 定时器**降频**，默认路径不依赖用户配置。

## What Changes

- 自动识别远程桌面（`SESSIONNAME` RDP 或 `CLIENTNAME`）→ 软件 GPU + UI 降频。
- GPU 子进程崩溃 → 落盘回退并自动 relaunch，下次走软件路径；稳定后自动清除再探测。
- 渲染层 `knowme.perf` 降频 live/telemetry 间隔。
- `KNOWME_*` 环境变量仅作隐藏逃生舱，非正常使用方式。

## Capabilities

### New Capabilities

- `windows-gpu-policy`: Windows GPU 自动降级与 UI 降频策略

### Modified Capabilities

- （无）

## Impact

- `src/lib/windows-gpu-policy.ts`、`windows-gpu-fallback.ts`、`boot.ts`、`process-guards.ts`、preload、助手/Run 定时器
- 本机健康会话保持硬件加速；远程/崩溃自动降级无需配置
