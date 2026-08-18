# Dev self-test — narrow-windows-gpu-disable (auto throttle)

## Unit

- `node -r ./scripts/register-ts.js --test tests/windows-gpu-policy.test.js tests/windows-gpu-fallback.test.js` → 10/10 pass

## Runtime

- 无需设置 `KNOWME_*`
- 本机：硬件加速保留
- 远程：自动 UI 降频 + `in-process-gpu`，默认不关硬件加速
- GPU 崩溃：自动落盘并 relaunch → 软件路径；稳定后自动清除再探测
