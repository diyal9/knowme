## Context

上一轮误把「填满高对比」做成珊瑚满底 redesign。用户纠正：只需**原设计放大填满 + 高清**。

## Goals / Non-Goals

**Goals**

- 保留 navy 载体 / ivory 路径 / coral 起点
- 标记放大、载体更贴槽、多尺寸直渲高清

**Non-Goals**

- 改色、换图、新图形语言

## Decisions

1. `CONNECTED_MARK_SCALE = 1.42` 绕 (0.5,0.5) 缩放基点坐标与半径。
2. 透明 inset `24/1024`，圆角略放大匹配更满的板。
3. 线宽 `68/1024`，与缩放后笔触一致。
4. 配色恢复 `NAVY` plate / `IVORY` path / `CORAL` origin。

## Migration

重生资源 → 完全退出并重启 KnowMe。
