## 1. Policy + fallback

- [x] 1.1 Auto remote detect + UI throttle intervals in `windows-gpu-policy`
- [x] 1.2 Persist crash fallback / TTL / stable recovery in `windows-gpu-fallback`
- [x] 1.3 Unit tests for policy and fallback

## 2. Wiring

- [x] 2.1 `boot.ts` applies auto policy + throttle env for preload
- [x] 2.2 `process-guards` marks crash and relaunches
- [x] 2.3 preload `knowme.perf` + renderer timer降频

## 3. Verify

- [x] 3.1 Unit tests pass
- [x] 3.2 Restart and confirm auto behavior (no user env required)
