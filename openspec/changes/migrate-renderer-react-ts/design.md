## Context

KnowMe 为 Electron 31 多窗体应用；workspace 由巨型 `workspace.html` + `workbench.js` / `workspace-agent.js` 驱动。目标是在**不改变产品行为**的前提下，将渲染实现换到 React + TypeScript，并在分支上与主线对比后合入。

## Goals / Non-Goals

**Goals**

- Vite 多入口渲染工程；workspace 优先。
- `KNOWME_RENDERER` 双加载路径（legacy HTML vs Vite dist/dev）。
- Typed `window.api`；UI 与领域逻辑分离（`src/lib` allowJs 复用）。
- Surface 级迁移与 parity 勾选。

**Non-Goals**

- 主进程/IPC 重写；产品功能变更；一次性删除全部 legacy HTML。

## Decisions

1. **React 19 + Vite + TS strict** — 生态与长期维护成本最优。
2. **双入口默认 legacy** — 合入后可回滚；对比期安全。
3. **蚕食替换** — React 壳先接管 layout/rail/路由；复杂 surface 经 LegacyHost 挂载现有控制器 DOM，再逐面 React 化，保证过程中能力不掉。
4. **构建产物** — `dist/renderer/<entry>/`；`prebuild` 调用 `vite build`；dev 用 `http://127.0.0.1:5173/workspace/`。
5. **次要窗体** — 同 Vite 工程多 page，首 PR 不阻塞。

## Electron 边界

```text
main.js  --preload-->  window.api  -->  React renderer
                 \-->  legacy HTML/JS (同一 preload)
```

- `contextIsolation: true` 不变。
- Renderer 不得 `require('electron')` / 直接 `ipcRenderer`。

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| 双轨漂移 | 主线少改渲染；分支定期同步 |
| LegacyHost 与 React 生命周期冲突 | 单次 mount、surface 切换时显式 dispose |
| 打包体积 | 仅打 workspace 入口；code split |
| 性能回退 | 聊天/日志列表虚拟化后再勾 parity |

## Migration Plan

1. Scaffold + 开关 + 空壳 React workspace。
2. Shell/rail 对等 → shelf → taskhome → run/daemon → manage → studio → 助理壳。
3. Parity + 制作人验收 → PR。
4. 次要窗体；稳定后 `retire-legacy-workspace-renderer`。

## Open Questions

- （无；合入范围已定为 workspace 优先。）
