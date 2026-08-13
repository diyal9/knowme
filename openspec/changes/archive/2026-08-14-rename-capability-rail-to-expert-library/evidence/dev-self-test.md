# 开发自测报告

- 日期：2026-08-11
- Change：`rename-capability-rail-to-expert-library`
- npm test: PASS（1641/1641）
- npm run lint: PASS
- 手动冒烟: 静态契约已覆盖 rail / Hub 标题 / CTA；未强制重启 Electron（文案改动，刷新/重启后可见）
- 备注：
  - 左侧 rail、Hub 顶栏、设置引导、工作台 CTA 统一为「专家库」
  - 工程 id（`btnRailCapabilities` / `capability-hub`）未改
  - 条目级「添加能力」保留
