## Context

`refine-expert-detail-actions-by-surface` 已让工作台快捷卡深链打开 Hub 专家详情，但宿主仍走 `openCenterSurface` 能力 Hub 整页，用户先看到目录再叠详情。详见 proposal.md Why。

## Goals / Non-Goals

**Goals:**
- 工作台入口用透明叠层 + Hub `presentation=detail`，只露二级详情
- 工作台 surface 底栏收敛为单一开工 CTA
- 能力 rail / 能力整页入口不变

**Non-Goals:**
- 不复制专家详情 DOM
- 不改安装/绑定 IPC

## Decisions

1. **复用 Hub iframe，新增 presentation** — URL/`resume` 携带 `presentation=detail|hub`。detail 时 `body.hub-detail-only` 隐藏壳层并透明背景，仅保留已有 `secondary-dialog` 抽屉。备选：工作台自建 modal（放弃，双份维护）。

2. **宿主 `drawerKind=capability-hub-detail`** — 与整页 `capability-hub` 分离：透明覆盖、不抢工作台 rail 高亮、不计入 `overlayOn` 把工作台标为非激活。关闭仍 park iframe 以便复用。

3. **关闭即离场** — detail 下 `closeDrawer()` / Esc / 遮罩 → `capability-hub-close`；`startExpert` 成功后也关闭叠层再进对话。

4. **底栏裁剪** — `surface=workbench` 仅 `startExpert`；能力面逻辑不动。

## Risks / Trade-offs

- [Risk] 透明 iframe 点击穿透异常 → Mitigation：iframe 仍铺满主区，Hub 自带 backdrop 承接点击
- [Risk] 缓存旧 JS → Mitigation：bump `capability-hub.js/css` query 版本
- [Risk] 从 detail 叠层切到能力整页需切换 presentation → Mitigation：`openCapabilityHub` 无 detail 时走中心整页并 resume `presentation=hub`

## Migration Plan

纯前端；回滚恢复快捷卡 `openCapabilityHub(..., { surface:'workbench' })` 与三按钮底栏即可。
